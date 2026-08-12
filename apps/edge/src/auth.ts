import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { signJwt, verifyJwt } from '@gysapp/core';
import { parseAccountProfile, type AccountProfile } from '@gysapp/contracts';

const SESSION_COOKIE = 'gys_session';
const SESSION_TTL_S = 60 * 60 * 24 * 30; // 30 hari

function decodeIdTokenPayload(idToken: string): AccountProfile {
  const [, payloadB64] = idToken.split('.');
  if (!payloadB64) throw new Error('id_token tidak valid');
  const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(padded)) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    sub: claims.sub ?? 'unknown',
    name: claims.name ?? null,
    email: claims.email ?? null,
    picture: claims.picture ?? null,
  };
}

/**
 * Auth OAuth Google + session JWT via cookie HttpOnly.
 * GOOGLE_CLIENT_ID/SECRET/SESSION_SECRET dari env (secrets Cloudflare).
 * Catatan hardening: verifikasi id_token via JWKS Google menyusul.
 */
export function createAuthApp(opts: {
  fetchImpl?: typeof fetch;
  sessionSecret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  secureCookie?: boolean;
}): Hono {
  const app = new Hono();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  app.get('/oauth/google/start', (c) => {
    if (!opts.googleClientId) {
      c.status(503);
      return c.json({ error: 'google-login-not-configured' });
    }
    const state = crypto.randomUUID();
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/oauth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', opts.googleClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    c.header('Cache-Control', 'no-store');
    return c.json({ url: url.toString(), state });
  });

  app.get('/oauth/google/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) {
      c.status(400);
      return c.json({ error: 'missing-code' });
    }
    if (!opts.googleClientId || !opts.googleClientSecret) {
      c.status(503);
      return c.json({ error: 'google-login-not-configured' });
    }
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/oauth/google/callback`;
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: opts.googleClientId,
        client_secret: opts.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) {
      c.status(502);
      return c.json({ error: 'token-exchange-failed' });
    }
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) {
      c.status(502);
      return c.json({ error: 'missing-id-token' });
    }

    const profile = decodeIdTokenPayload(body.id_token);
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        sub: profile.sub,
        name: profile.name ?? undefined,
        email: profile.email ?? undefined,
        picture: profile.picture ?? undefined,
        iat: now,
        exp: now + SESSION_TTL_S,
      },
      opts.sessionSecret,
    );
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: opts.secureCookie ?? false,
      path: '/',
      maxAge: SESSION_TTL_S,
    });
    const fallback = `${new URL(c.req.url).origin}/account`;
    return c.redirect(c.req.query('redirect') ?? fallback);
  });

  app.get('/me', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) {
      c.status(401);
      return c.json({ error: 'unauthenticated' });
    }
    try {
      const payload = await verifyJwt(token, opts.sessionSecret);
      const profile = parseAccountProfile({
        sub: payload.sub,
        name: payload.name ?? null,
        email: payload.email ?? null,
        picture: payload.picture ?? null,
      });
      return c.json(profile);
    } catch {
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      c.status(401);
      return c.json({ error: 'session-invalid' });
    }
  });

  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return app;
}
