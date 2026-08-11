import { describe, expect, it } from 'vitest';
import {
  BackupError,
  decryptBackup,
  encryptBackup,
  type BackupEnvelope,
} from '../../src/backup/encrypt';

const envelope: BackupEnvelope = {
  schemaVersion: 1,
  appVersion: '0.1.0',
  exportedAt: '2026-08-11T12:00:00.000Z',
  data: { settings: { theme: 'dark', fontSize: 1.1 }, playlists: [] },
};

describe('backup encryption (AES-GCM + PBKDF2)', () => {
  it('round-trips with correct password', async () => {
    const bytes = await encryptBackup('rahasia-123', envelope);
    expect(bytes.length).toBeGreaterThan(50);
    const decrypted = await decryptBackup(bytes, 'rahasia-123');
    expect(decrypted.envelope).toEqual(envelope);
  });

  it('produces different ciphertext each time (random salt + iv)', async () => {
    const a = await encryptBackup('pw', envelope);
    const b = await encryptBackup('pw', envelope);
    expect(a).not.toEqual(b);
  });

  it('rejects wrong password', async () => {
    const bytes = await encryptBackup('benar', envelope);
    await expect(decryptBackup(bytes, 'salah')).rejects.toThrow(BackupError);
  });

  it('rejects non-backup bytes and unsupported versions', async () => {
    await expect(decryptBackup(new Uint8Array([1, 2, 3]), 'pw')).rejects.toThrow(
      'bukan file backup',
    );
    const bytes = await encryptBackup('pw', envelope);
    bytes[8] = 2; // versi 2
    await expect(decryptBackup(bytes, 'pw')).rejects.toThrow('versi backup');
  });
});
