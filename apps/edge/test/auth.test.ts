import { afterEach, describe, expect, it, vi } from 'vitest';
import { signJwt } from '@gysapp/core';
import { createApp } from '../src/index';

const SECRET = 'test-session-secret';
const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const CLIENT_SECRET = 'secret-xyz';

function tokenExchangeMock() {
  const idToken =
    'eyJhbGciOiJSUzI1NiJ9.' +
    btoa(
      JSON.stringify({
        sub: 'g-123',
        name: 'Budi',
        email: 'budi@example.com',
        picture: 'https://p.example/b.png',
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '') +
    '.sig';
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ id_token: idToken }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('auth routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('start returns Google authorization URL with state', async () => {
    const app = createApp({ sessionSecret: SECRET, googleClientId: CLIENT_ID });
    const res = await app.request('/api/auth/oauth/google/start');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; state: string };
    expect(body.url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(body.url).toContain(`client_id=${CLIENT_ID}`);
    expect(body.state.length).toBeGreaterThan(10);
  });

  it('returns 503 when google not configured', async () => {
    const app = createApp({ sessionSecret: SECRET });
    const res = await app.request('/api/auth/oauth/google/start');
    expect(res.status).toBe(503);
  });

  it('callback exchanges code, sets session cookie, and /me returns profile', async () => {
    const fetchMock = tokenExchangeMock();
    const app = createApp({
      sessionSecret: SECRET,
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const cb = await app.request(
      '/api/auth/oauth/google/callback?code=abc&redirect=https%3A%2F%2Fapp.test%2Faccount',
      { headers: { origin: 'https://bff.test' } },
      { origin: 'https://bff.test' },
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.get('location')).toBe('https://app.test/account');
    const cookie = cb.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('gys_session=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');

    const me = await app.request('/api/auth/me', {
      headers: { cookie: cookie.split(';')[0] as string },
    });
    expect(me.status).toBe(200);
    const profile = (await me.json()) as { sub: string; name: string };
    expect(profile.sub).toBe('g-123');
    expect(profile.name).toBe('Budi');
  });

  it('me returns 401 without session', async () => {
    const app = createApp({ sessionSecret: SECRET });
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
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
