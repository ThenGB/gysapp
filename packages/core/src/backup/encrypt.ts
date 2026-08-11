import { z } from 'zod';

/**
 * Format backup GYSApp (`.gysapp`):
 * 16 byte magic "GYSAPPBK" + version u32 + payload (AES-GCM ciphertext).
 * Payload terdekripsi adalah JSON: { schemaVersion, appVersion, exportedAt, data }.
 */

export const BACKUP_MAGIC = 'GYSAPPBK';
export const BACKUP_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = 1;

export const BackupEnvelope = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  appVersion: z.string(),
  exportedAt: z.string(),
  data: z.unknown(),
});
export type BackupEnvelope = z.infer<typeof BackupEnvelope>;

const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 310_000;

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Enkripsi payload dengan password -> byte file `.gysapp`. */
export async function encryptBackup(
  password: string,
  envelope: BackupEnvelope,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const payload = new TextEncoder().encode(JSON.stringify(envelope));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, payload),
  );
  const magic = new TextEncoder().encode(BACKUP_MAGIC);
  const version = new Uint8Array([0, 0, 0, BACKUP_VERSION]);
  return concatBytes(magic, version, salt, iv, cipher);
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface DecryptedBackup {
  envelope: BackupEnvelope;
  salt: Uint8Array;
  iv: Uint8Array;
}

/** Dekripsi byte file `.gysapp`. */
export async function decryptBackup(bytes: Uint8Array, password: string): Promise<DecryptedBackup> {
  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  if (magic !== BACKUP_MAGIC) throw new BackupError('bukan file backup GYSApp');
  const version = (bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!;
  if (version !== BACKUP_VERSION) throw new BackupError(`versi backup tidak didukung: ${version}`);
  const salt = bytes.slice(12, 12 + SALT_LENGTH);
  const iv = bytes.slice(12 + SALT_LENGTH, 12 + SALT_LENGTH + IV_LENGTH);
  const cipher = bytes.slice(12 + SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    );
  } catch {
    throw new BackupError('password salah atau file rusak');
  }
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
  const envelope = BackupEnvelope.parse(parsed);
  return { envelope, salt, iv };
}
