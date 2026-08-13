import {
  biblePackAvailability,
  getBiblePack,
  parseBiblePackManifest,
  sha256Hex,
  type BiblePackAvailability,
  type BiblePackCode,
  type BiblePackManifest,
  type BiblePackPackage,
} from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';
import { resolveBiblePackageDownloadSource } from './github-release-download';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/ThenGB/GYSApp-Data/main/latest/bibles-manifest.json';
const DB_NAME = 'gysapp-bible-packs';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_META = 'meta';
const GYSPKG_MAGIC = new TextEncoder().encode('GYSPKG1');
const LEGACY_PACKAGE_KEY_BASE64 = 'yrvxIa8zgtn6cxTLH/+BsLjx5SrgGRQN7IVhK0ufB1Y=';
const BUILTIN_DB_URLS: Partial<Record<BiblePackCode, string>> = {
  b_tb: '/data/bible/b_tb/b_tb.db',
};

export interface InstalledBiblePack {
  code: BiblePackCode;
  version: string;
  checksumSha256: string;
  installFileName: string;
  packageSizeBytes: number;
  databaseSizeBytes: number;
  installedAt: number;
}

export interface BiblePackStatus {
  code: BiblePackCode;
  label: string;
  builtIn: boolean;
  availability: BiblePackAvailability;
  installed: InstalledBiblePack | null;
  remote: BiblePackPackage | null;
}

export type BibleDownloadPhase =
  'downloading' | 'verifying' | 'installing' | 'complete' | 'cancelled' | 'error';

export interface BibleDownloadTask {
  code: BiblePackCode;
  phase: BibleDownloadPhase;
  receivedBytes: number;
  totalBytes: number;
  resumable: boolean;
  error?: string;
}

const LABELS: Record<BiblePackCode, string> = {
  b_tb: 'Terjemahan Baru',
  b_kjv: 'King James Version',
  b_cuv: 'Chinese Union Version',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

async function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    });
  } finally {
    db.close();
  }
}

function fileKey(checksum: string): string {
  return `db:${checksum.toLowerCase()}`;
}

function partialKey(checksum: string): string {
  return `partial:${checksum.toLowerCase()}`;
}

function metaKey(code: BiblePackCode): string {
  return `installed:${code}`;
}

function bytesEqualPrefix(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.byteLength < prefix.byteLength) return false;
  for (let i = 0; i < prefix.byteLength; i += 1) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function base64Bytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser ini belum mendukung dekompresi paket Alkitab.');
  }
  const source = new Blob([new Uint8Array(bytes)]).stream();
  const stream = source.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodeBiblePackage(packageBytes: Uint8Array): Promise<Uint8Array> {
  if (!bytesEqualPrefix(packageBytes, GYSPKG_MAGIC)) return new Uint8Array(packageBytes);
  const ivOffset = GYSPKG_MAGIC.byteLength;
  if (packageBytes.byteLength <= ivOffset + 16) throw new Error('Paket Alkitab terpotong.');

  const iv = packageBytes.slice(ivOffset, ivOffset + 16);
  const ciphertext = packageBytes.slice(ivOffset + 16);
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(base64Bytes(LEGACY_PACKAGE_KEY_BASE64)).buffer,
    'AES-CTR',
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: new Uint8Array(iv).buffer, length: 128 },
    key,
    new Uint8Array(ciphertext).buffer,
  );
  return gunzip(new Uint8Array(decrypted));
}

async function fetchPackageWithResume(
  pkg: BiblePackPackage,
  signal: AbortSignal,
  onProgress: (received: number, total: number, resumable: boolean) => void,
): Promise<Uint8Array> {
  const saved = await idbGet<Uint8Array>(STORE_FILES, partialKey(pkg.checksumSha256));
  let prefix = saved ? new Uint8Array(saved) : new Uint8Array();
  let response: Response;
  const source = await resolveBiblePackageDownloadSource(pkg.downloadUrl, signal);

  const request = async (rangeStart?: number) => {
    const headers = new Headers(source.headers);
    if (rangeStart) headers.set('Range', `bytes=${rangeStart}-`);
    return fetch(source.url, {
      signal,
      headers,
      cache: 'no-store',
    });
  };

  try {
    response = await request(prefix.byteLength || undefined);
  } catch (error) {
    if (signal.aborted) throw error;
    prefix = new Uint8Array();
    response = await request();
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Unduhan Alkitab gagal (${response.status}).`);
  }

  const resumed = prefix.byteLength > 0 && response.status === 206;
  if (!resumed && prefix.byteLength > 0) prefix = new Uint8Array();
  const contentLength = Number(response.headers.get('content-length')) || 0;
  const total = resumed ? prefix.byteLength + contentLength : contentLength || pkg.sizeBytes;
  const resumable = response.headers.get('accept-ranges') === 'bytes' || response.status === 206;

  const chunks: Uint8Array[] = prefix.byteLength ? [prefix] : [];
  let received = prefix.byteLength;
  let checkpoint = received;
  onProgress(received, total, resumable);

  const reader = response.body?.getReader();
  if (!reader) {
    const body = new Uint8Array(await response.arrayBuffer());
    chunks.push(body);
    received += body.byteLength;
  } else {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, total, resumable);
      if (resumable && received - checkpoint >= 512 * 1024) {
        checkpoint = received;
        const partial = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          partial.set(chunk, offset);
          offset += chunk.byteLength;
        }
        await idbPut(STORE_FILES, partialKey(pkg.checksumSha256), partial);
      }
    }
  }

  const output = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export class BiblePackManager {
  private listeners = new Set<() => void>();
  private tasks = new Map<BiblePackCode, BibleDownloadTask>();
  private controllers = new Map<BiblePackCode, AbortController>();
  private manifestPromise: Promise<BiblePackManifest> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getTaskSnapshot = (code: BiblePackCode): BibleDownloadTask | null => this.tasks.get(code) ?? null;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private updateTask(code: BiblePackCode, update: BibleDownloadTask): void {
    this.tasks.set(code, update);
    this.emit();
  }

  async manifest(force = false): Promise<BiblePackManifest> {
    if (force) this.manifestPromise = null;
    this.manifestPromise ??= fetch(MANIFEST_URL, { cache: force ? 'reload' : 'default' }).then(
      async (response) => {
        if (!response.ok) throw new Error(`Manifest Alkitab gagal dimuat (${response.status}).`);
        return parseBiblePackManifest(await response.json());
      },
    );
    return this.manifestPromise;
  }

  async installed(code: BiblePackCode): Promise<InstalledBiblePack | null> {
    return (await idbGet<InstalledBiblePack>(STORE_META, metaKey(code))) ?? null;
  }

  async statuses(forceManifest = false): Promise<BiblePackStatus[]> {
    const manifest = await this.manifest(forceManifest);
    return Promise.all(
      (['b_tb', 'b_kjv', 'b_cuv'] as const).map(async (code) => {
        const installed = await this.installed(code);
        const remote = getBiblePack(manifest, code) ?? null;
        const builtIn = Boolean(BUILTIN_DB_URLS[code]);
        return {
          code,
          label: LABELS[code],
          builtIn,
          installed,
          remote,
          availability: biblePackAvailability({
            code,
            builtIn,
            installedChecksum: installed?.checksumSha256,
            remoteChecksum: remote?.checksumSha256,
          }),
        } satisfies BiblePackStatus;
      }),
    );
  }

  async databaseBytes(code: BiblePackCode): Promise<Uint8Array> {
    const installed = await this.installed(code);
    if (installed) {
      const bytes = await idbGet<Uint8Array>(STORE_FILES, fileKey(installed.checksumSha256));
      if (bytes) return new Uint8Array(bytes);
    }

    const bundled = BUILTIN_DB_URLS[code];
    if (bundled) {
      const response = await fetch(assetUrl(bundled));
      if (!response.ok) throw new Error(`Database bawaan ${code} tidak dapat dimuat.`);
      return new Uint8Array(await response.arrayBuffer());
    }
    throw new Error(`${LABELS[code]} belum diunduh.`);
  }

  async install(code: BiblePackCode): Promise<void> {
    if (this.controllers.has(code)) return;
    const manifest = await this.manifest(true);
    const pkg = getBiblePack(manifest, code);
    if (!pkg) throw new Error(`Paket ${code} tidak tersedia.`);

    const controller = new AbortController();
    this.controllers.set(code, controller);
    this.updateTask(code, {
      code,
      phase: 'downloading',
      receivedBytes: 0,
      totalBytes: pkg.sizeBytes,
      resumable: false,
    });

    try {
      const packageBytes = await fetchPackageWithResume(
        pkg,
        controller.signal,
        (receivedBytes, totalBytes, resumable) =>
          this.updateTask(code, {
            code,
            phase: 'downloading',
            receivedBytes,
            totalBytes,
            resumable,
          }),
      );

      this.updateTask(code, {
        code,
        phase: 'verifying',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
        resumable: false,
      });
      const checksum = await sha256Hex(packageBytes);
      if (checksum !== pkg.checksumSha256.toLowerCase()) {
        throw new Error('Checksum paket Alkitab tidak cocok. Unduhan dibatalkan.');
      }

      this.updateTask(code, {
        code,
        phase: 'installing',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
        resumable: false,
      });
      const database = await decodeBiblePackage(packageBytes);
      if (
        database.byteLength < 16 ||
        new TextDecoder().decode(database.slice(0, 15)) !== 'SQLite format 3'
      ) {
        throw new Error('Isi paket Alkitab bukan database SQLite yang valid.');
      }

      const previous = await this.installed(code);
      await idbPut(STORE_FILES, fileKey(pkg.checksumSha256), database);
      await idbPut(STORE_META, metaKey(code), {
        code,
        version: pkg.version,
        checksumSha256: pkg.checksumSha256,
        installFileName: pkg.installFileName,
        packageSizeBytes: pkg.sizeBytes,
        databaseSizeBytes: database.byteLength,
        installedAt: Date.now(),
      } satisfies InstalledBiblePack);
      await idbDelete(STORE_FILES, partialKey(pkg.checksumSha256));
      if (previous && previous.checksumSha256 !== pkg.checksumSha256) {
        await idbDelete(STORE_FILES, fileKey(previous.checksumSha256));
      }

      this.updateTask(code, {
        code,
        phase: 'complete',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
        resumable: false,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        this.updateTask(code, {
          code,
          phase: 'cancelled',
          receivedBytes: this.tasks.get(code)?.receivedBytes ?? 0,
          totalBytes: this.tasks.get(code)?.totalBytes ?? pkg.sizeBytes,
          resumable: this.tasks.get(code)?.resumable ?? false,
        });
        return;
      }
      this.updateTask(code, {
        code,
        phase: 'error',
        receivedBytes: this.tasks.get(code)?.receivedBytes ?? 0,
        totalBytes: this.tasks.get(code)?.totalBytes ?? pkg.sizeBytes,
        resumable: this.tasks.get(code)?.resumable ?? false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.controllers.delete(code);
      this.emit();
    }
  }

  cancel(code: BiblePackCode): void {
    this.controllers.get(code)?.abort();
  }

  retry(code: BiblePackCode): Promise<void> {
    return this.install(code);
  }

  async remove(code: BiblePackCode): Promise<void> {
    this.cancel(code);
    const installed = await this.installed(code);
    if (installed) await idbDelete(STORE_FILES, fileKey(installed.checksumSha256));
    await idbDelete(STORE_META, metaKey(code));
    this.tasks.delete(code);
    this.emit();
  }
}

export const biblePackManager = new BiblePackManager();
