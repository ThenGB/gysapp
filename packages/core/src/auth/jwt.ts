/**
 * JWT HS256 minimal (pure WebCrypto) untuk session cookie BFF.
 * Bukan library penuh — cukup untuk session yang ditandatangani.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface JwtPayload {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  iat: number;
  exp: number;
}

async function hmacSha256(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign('HMAC', key, data as BufferSource);
  return new Uint8Array(sig);
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = await hmacSha256(key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

/** Verifikasi + parse. Menolak expired / signature salah / format invalid. */
export async function verifyJwt(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('format jwt tidak valid');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signature = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    signature as BufferSource,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource,
  );
  if (!ok) throw new JwtError('signature tidak cocok');

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  ) as Partial<JwtPayload>;
  if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
    throw new JwtError('payload tidak valid');
  }
  if (payload.exp * 1000 < nowMs) throw new JwtError('session kedaluwarsa');
  return payload as JwtPayload;
}
