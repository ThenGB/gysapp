import { afterEach, describe, expect, it, vi } from 'vitest';
import { signJwt } from '@gysapp/core';
import { createApp } from '../src/index';

const SECRET = 'test-session-secret-long-enough';
const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const CLIENT_SECRET = 'secret-xyz';
const APP_ORIGIN = 'https://app.test';

function googleMock() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/tokeninfo')) {
      return new Response(
        JSON.stringify({
          aud: CLIENT_ID,
          iss: 'https://accounts.google.com',
          sub: 'g-123',
          name: 'Budi',
          email: 'budi@example.com',
          picture: 'https://p.example/b.png',
          exp: String(Math.floor(Date.now() / 1000) + 3600),
        }),
        { status: 200 },
      );
    }
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ id_token: 'signed-google-id-token' }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('auth routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('start returns Google authorization URL, stores state, and accepts allowlisted redirect', async () => {
    const app = createApp({
      sessionSecret: SECRET,
      googleClientId: CLIENT_ID,
      appOrigins: [APP_ORIGIN],
    });
    const res = await app.request(
      `/api/auth/oauth/google/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/account`)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    const authUrl = new URL(body.url);
    expect(authUrl.origin).toBe('https://accounts.google.com');
    expect(authUrl.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authUrl.searchParams.get('state')?.length).toBeGreaterThan(10);
    expect(res.headers.get('set-cookie') ?? '').toContain('gys_oauth_');
  });

  it('returns 503 when google not configured', async () => {
    const app = createApp({ sessionSecret: SECRET });
    const res = await app.request('/api/auth/oauth/google/start');
    expect(res.status).toBe(503);
  });

  it('rejects callback without a matching OAuth state', async () => {
    const app = createApp({
      sessionSecret: SECRET,
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
    });
    const res = await app.request('/api/auth/oauth/google/callback?code=abc&state=wrong');
    expect(res.status).toBe(400);
  });

  it('callback verifies Google token, sets session cookie, and /me returns profile', async () => {
    const fetchMock = googleMock();
    const app = createApp({
      sessionSecret: SECRET,
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      fetchImpl: fetchMock as unknown as typeof fetch,
      appOrigins: [APP_ORIGIN],
    });

    const start = await app.request(
      `/api/auth/oauth/google/start?redirect=${encodeURIComponent(`${APP_ORIGIN}/account`)}`,
    );
    const startBody = (await start.json()) as { url: string };
    const state = new URL(startBody.url).searchParams.get('state') as string;
    const oauthCookie = `gys_oauth_state=${state}; gys_oauth_redirect=${encodeURIComponent(`${APP_ORIGIN}/account`)}`;

    const cb = await app.request(
      `/api/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`,
      {
        headers: { cookie: oauthCookie },
      },
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.get('location')).toBe(`${APP_ORIGIN}/account`);
    const cookie = cb.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('gys_session=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/tokeninfo'),
      expect.anything(),
    );

    const sessionMatch = cookie.match(/gys_session=([^;]+)/);
    expect(sessionMatch?.[1]).toBeTruthy();
    const me = await app.request('/api/auth/me', {
      headers: { cookie: `gys_session=${sessionMatch?.[1]}` },
    });
    expect(me.status).toBe(200);
    const profile = (await me.json()) as { sub: string; name: string };
    expect(profile.sub).toBe('g-123');
    expect(profile.name).toBe('Budi');
  });

  it('me returns 401 without session', async () => {
    const app = createApp({ sessionSecret: SECRET });
    expect((await app.request('/api/auth/me')).status).toBe(401);
  });

  it('me rejects invalid session', async () => {
    const app = createApp({ sessionSecret: SECRET });
    const token = await signJwt({ sub: 'x', iat: 1, exp: 9999999999 }, 'secret-lain');
    const res = await app.request('/api/auth/me', { headers: { cookie: `gys_session=${token}` } });
    expect(res.status).toBe(401);
  });

  it('logout clears session cookie', async () => {
    const app = createApp({ sessionSecret: SECRET });
    const res = await app.request('/api/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    expect((res.headers.get('set-cookie') ?? '').toLowerCase()).toContain('gys_session=;');
  });
});
