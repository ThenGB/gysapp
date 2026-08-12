import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearEgysToken,
  exchangeGoogleCredentialForEgysToken,
  fetchEgysProfile,
  readEgysToken,
  restoreEgysProfile,
  writeEgysToken,
} from './egys-session';

afterEach(() => {
  clearEgysToken();
  vi.restoreAllMocks();
});

describe('e-GYS session adapter', () => {
  it('exchanges a Google credential directly with e-GYS', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://e.gys.or.id/auth/google/callbackgis');
      expect(init?.method).toBe('POST');
      expect(String(init?.body)).toContain('credential=google-id-token');
      return new Response(JSON.stringify({ token: 'egys-token' }), { status: 200 });
    });
    await expect(
      exchangeGoogleCredentialForEgysToken('google-id-token', {
        clientId: 'public-client-id',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBe('egys-token');
  });

  it('loads and normalizes member type and branch', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: 1,
              name: 'Budi',
              status: 'ACTIVE',
              baptized: true,
              branchname: 'Pontianak',
            },
          }),
          { status: 200 },
        ),
    );
    const profile = await fetchEgysProfile('token', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(profile.memberType).toBe('Jemaat');
    expect(profile.branchName).toBe('Pontianak');
  });

  it('stores tokens only in session storage and clears invalid restored sessions', async () => {
    writeEgysToken('temporary-token');
    expect(readEgysToken()).toBe('temporary-token');
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    await expect(
      restoreEgysProfile({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).resolves.toBeNull();
    expect(readEgysToken()).toBeNull();
  });
});
