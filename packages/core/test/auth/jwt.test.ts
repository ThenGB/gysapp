import { describe, expect, it } from 'vitest';
import { JwtError, signJwt, verifyJwt } from '../../src/auth/jwt';

const SECRET = 'session-secret-uji';

describe('jwt hs256', () => {
  it('signs and verifies a payload', async () => {
    const token = await signJwt(
      { sub: 'user-1', name: 'Budi', email: 'b@x.id', iat: 1, exp: 9999999999 },
      SECRET,
    );
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.name).toBe('Budi');
  });

  it('rejects tampered tokens', async () => {
    const token = await signJwt({ sub: 'a', iat: 1, exp: 9999999999 }, SECRET);
    const tampered = `${token.slice(0, -3)}abc`;
    await expect(verifyJwt(tampered, SECRET)).rejects.toThrow(JwtError);
  });

  it('rejects expired tokens', async () => {
    const token = await signJwt({ sub: 'a', iat: 1, exp: 1 }, SECRET);
    await expect(verifyJwt(token, SECRET, 2_000_000)).rejects.toThrow('kedaluwarsa');
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await signJwt({ sub: 'a', iat: 1, exp: 9999999999 }, 'rahasia-lain');
    await expect(verifyJwt(token, SECRET)).rejects.toThrow(JwtError);
  });

  it('rejects malformed tokens', async () => {
    await expect(verifyJwt('not-a-jwt', SECRET)).rejects.toThrow(JwtError);
  });
});
