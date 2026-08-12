import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { signJwt, verifyJwt } from '@gysapp/core';
import { parseAccountProfile, type AccountProfile } from '@gysapp/contracts';

const SESSION_COOKIE = 'gys_session';
const OAUTH_STATE_COOKIE = 'gys_oauth_state';
const OAUTH_REDIRECT_COOKIE = 'gys_oauth_redirect';
const SESSION_TTL_S = 60 * 60 * 24 * 30;
const OAUTH_TTL_S = 10 * 60;

const DEFAULT_APP_ORIGINS = [
  'https://thengb.github.io',
  'https://gyspnk.github.io',
  'https://gysapp.pages.dev',
  'http://localhost:5173',
];

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  iss?: string;
  exp?: string;
};

function safeRedirect(input: string | undefined, allowedOrigins: readonly string[]): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    return allowedOrigins.includes(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  fetchImpl: typeof fetch,
): Promise<AccountProfile> {
  const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  tokenInfoUrl.searchParams.set('id_token', idToken);
  const res = await fetchImpl(tokenInfoUrl.toString(), {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error('google-id-token-invalid');
  const claims = (await res.json()) as GoogleTokenInfo;
  if (claims.aud !== clientId) throw new Error('google-id-token-audience-mismatch');
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') {
    throw new Error('google-id-token-issuer-mismatch');
  }
  if (!claims.sub) throw new Error('google-id-token-missing-sub');
  const exp = Number(claims.exp ?? '0');
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('google-id-token-expired');
  }
  return parseAccountProfile({
    sub: claims.sub,
    name: claims.name ?? null,
    email: claims.email ?? null,
    picture: claims.picture ?? null,
  });
}

export function createAuthApp(opts: {
  fetchImpl?: typeof fetch;
  sessionSecret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  secureCookie?: boolean;
  appOrigins?: readonly string[];
}): Hono {
  const app = new Hono();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const allowedOrigins = opts.appOrigins ?? DEFAULT_APP_ORIGINS;
  const secureCookie = opts.secureCookie ?? false;

  app.get('/oauth/google/start', (c) => {
    if (!opts.googleClientId || opts.sessionSecret.length < 16) {
      c.status(503);
      return c.json({ error: 'google-login-not-configured' });
    }
    const state = crypto.randomUUID();
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/oauth/google/callback`;
    const requestedRedirect = safeRedirect(c.req.query('redirect'), allowedOrigins);
    const fallbackRedirect = `${allowedOrigins[0] ?? 'http://localhost:5173'}/account`;
    const postLoginRedirect = requestedRedirect ?? fallbackRedirect;

    setCookie(c, OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: secureCookie,
      path: '/api/auth/oauth/google',
      maxAge: OAUTH_TTL_S,
    });
    setCookie(c, OAUTH_REDIRECT_COOKIE, postLoginRedirect, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: secureCookie,
      path: '/api/auth/oauth/google',
      maxAge: OAUTH_TTL_S,
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', opts.googleClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    c.header('Cache-Control', 'no-store');
    return c.json({ url: url.toString() });
  });

  app.get('/oauth/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const expectedState = getCookie(c, OAUTH_STATE_COOKIE);
    const redirectTarget = safeRedirect(getCookie(c, OAUTH_REDIRECT_COOKIE), allowedOrigins);
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/api/auth/oauth/google' });
    deleteCookie(c, OAUTH_REDIRECT_COOKIE, { path: '/api/auth/oauth/google' });

    if (!code || !state || !expectedState || state !== expectedState) {
      c.status(400);
      return c.json({ error: 'oauth-state-invalid' });
    }
    if (!opts.googleClientId || !opts.googleClientSecret || opts.sessionSecret.length < 16) {
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

    let profile: AccountProfile;
    try {
      profile = await verifyGoogleIdToken(body.id_token, opts.googleClientId, fetchImpl);
    } catch {
      c.status(401);
      return c.json({ error: 'google-id-token-invalid' });
    }

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
      secure: secureCookie,
      path: '/',
      maxAge: SESSION_TTL_S,
    });
    return c.redirect(redirectTarget ?? `${allowedOrigins[0] ?? 'http://localhost:5173'}/account`);
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
