import { sha256Hex } from '@gysapp/core';
import {
  decodeBiblePackage,
  type BiblePackageDownloadSource,
} from '../bible/bible-pack-manager';
import { resolveBiblePackageDownloadSource } from '../bible/github-release-download';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';

export type HymnalPackCode = 'KR' | 'HYMNE' | 'MDR' | 'ASM-I' | 'ASM-M' | 'ASM-P';

export interface HymnalRemotePackage {
  code: HymnalPackCode;
  version: string;
  fileName: string;
  downloadUrl: string;
  installFileName: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface HymnalPackManifest {
  track: 'hymnals';
  releaseTag: string;
  publishedAt: string;
  packages: HymnalRemotePackage[];
}

export interface InstalledHymnalPack {
  code: HymnalPackCode;
  version: string;
  checksumSha256: string;
  installFileName: string;
  packageSizeBytes: number;
  pdfSizeBytes: number;
  installedAt: number;
}

export type HymnalPackAvailability = 'not-installed' | 'installed' | 'update-available';

export interface HymnalPackStatus {
  code: HymnalPackCode;
  label: string;
  installed: InstalledHymnalPack | null;
  remote: HymnalRemotePackage | null;
  availability: HymnalPackAvailability;
}

export type HymnalDownloadPhase =
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface HymnalDownloadTask {
  code: HymnalPackCode;
  phase: HymnalDownloadPhase;
  receivedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface HymnalPackManagerOptions {
  store?: IndexedDbBlobStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
  manifestUrl?: string;
  resolveDownloadSource?: (
    downloadUrl: string,
    signal: AbortSignal,
  ) => Promise<BiblePackageDownloadSource>;
}

const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/ThenGB/GYSApp-Data/main/latest/hymnals-manifest.json';
const CODES: HymnalPackCode[] = ['KR', 'HYMNE', 'MDR', 'ASM-I', 'ASM-M', 'ASM-P'];
const LABELS: Record<HymnalPackCode, string> = {
  KR: 'Kidung Rohani',
  HYMNE: 'Hymns of Praise',
  MDR: 'Mandarin',
  'ASM-I': 'Anak Sekolah Minggu I',
  'ASM-M': 'Anak Sekolah Minggu M',
  'ASM-P': 'Anak Sekolah Minggu P',
};

function isCode(value: unknown): value is HymnalPackCode {
  return typeof value === 'string' && CODES.includes(value as HymnalPackCode);
}

function parseRemotePackage(value: unknown): HymnalRemotePackage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<HymnalRemotePackage>;
  if (
    !isCode(item.code) ||
    typeof item.version !== 'string' ||
    typeof item.fileName !== 'string' ||
    typeof item.downloadUrl !== 'string' ||
    typeof item.installFileName !== 'string' ||
    typeof item.sizeBytes !== 'number' ||
    !Number.isFinite(item.sizeBytes) ||
    item.sizeBytes <= 0 ||
    typeof item.checksumSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(item.checksumSha256)
  ) {
    return null;
  }
  return item as HymnalRemotePackage;
}

export function parseHymnalPackManifest(value: unknown): HymnalPackManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest Pujian tidak valid.');
  const raw = value as Partial<HymnalPackManifest>;
  if (raw.track !== 'hymnals' || !Array.isArray(raw.packages)) {
    throw new Error('Manifest Pujian tidak valid.');
  }
  const packages = raw.packages.map(parseRemotePackage).filter((item) => item !== null);
  if (packages.length === 0) throw new Error('Manifest Pujian tidak memiliki paket valid.');
  return {
    track: 'hymnals',
    releaseTag: typeof raw.releaseTag === 'string' ? raw.releaseTag : '',
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : '',
    packages,
  };
}

function metaPath(code: HymnalPackCode): string {
  return `meta/${code}.json`;
}

function pdfPath(checksumSha256: string): string {
  return `pdf/${checksumSha256.toLowerCase()}.pdf`;
}

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  return new TextDecoder().decode(bytes.slice(0, 32)).includes('%PDF-');
}

function parseInstalled(value: Uint8Array | null): InstalledHymnalPack | null {
  if (!value) return null;
  try {
    const item = JSON.parse(new TextDecoder().decode(value)) as Partial<InstalledHymnalPack>;
    if (
      !isCode(item.code) ||
      typeof item.version !== 'string' ||
      typeof item.checksumSha256 !== 'string' ||
      typeof item.installFileName !== 'string' ||
      typeof item.packageSizeBytes !== 'number' ||
      typeof item.pdfSizeBytes !== 'number' ||
      typeof item.installedAt !== 'number'
    ) {
      return null;
    }
    return item as InstalledHymnalPack;
  } catch {
    return null;
  }
}

export class HymnalPackManager {
  private readonly store: IndexedDbBlobStore;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly manifestUrl: string;
  private readonly resolveDownloadSource: NonNullable<
    HymnalPackManagerOptions['resolveDownloadSource']
  >;
  private manifestPromise: Promise<HymnalPackManifest> | null = null;
  private readonly tasks = new Map<HymnalPackCode, HymnalDownloadTask>();
  private readonly controllers = new Map<HymnalPackCode, AbortController>();
  private readonly listeners = new Set<() => void>();

  constructor(options: HymnalPackManagerOptions = {}) {
    this.store = options.store ?? new IndexedDbBlobStore('gysapp-hymnal-packs-v1');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.manifestUrl = options.manifestUrl ?? DEFAULT_MANIFEST_URL;
    this.resolveDownloadSource =
      options.resolveDownloadSource ?? resolveBiblePackageDownloadSource;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getTaskSnapshot = (code: HymnalPackCode): HymnalDownloadTask | null =>
    this.tasks.get(code) ?? null;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private updateTask(code: HymnalPackCode, task: HymnalDownloadTask): void {
    this.tasks.set(code, task);
    this.emit();
  }

  async manifest(force = false): Promise<HymnalPackManifest> {
    if (force) this.manifestPromise = null;
    this.manifestPromise ??= this.fetchImpl(this.manifestUrl, {
      cache: force ? 'reload' : 'default',
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Manifest Pujian gagal dimuat (${response.status}).`);
      return parseHymnalPackManifest(await response.json());
    });
    return this.manifestPromise;
  }

  async installed(code: HymnalPackCode): Promise<InstalledHymnalPack | null> {
    return parseInstalled(await this.store.read(metaPath(code)));
  }

  async pdfBytes(code: string): Promise<Uint8Array | null> {
    const normalized = code.toUpperCase();
    if (!isCode(normalized)) return null;
    const installed = await this.installed(normalized);
    if (!installed) return null;
    const bytes = await this.store.read(pdfPath(installed.checksumSha256));
    if (bytes && isPdf(bytes)) return bytes;
    await this.store.remove(metaPath(normalized)).catch(() => undefined);
    return null;
  }

  async statuses(forceManifest = false): Promise<HymnalPackStatus[]> {
    const manifest = await this.manifest(forceManifest);
    return Promise.all(
      CODES.map(async (code) => {
        const installed = await this.installed(code);
        const remote = manifest.packages.find((item) => item.code === code) ?? null;
        const availability: HymnalPackAvailability = !installed
          ? 'not-installed'
          : remote && remote.checksumSha256.toLowerCase() !== installed.checksumSha256.toLowerCase()
            ? 'update-available'
            : 'installed';
        return { code, label: LABELS[code], installed, remote, availability };
      }),
    );
  }

  private async download(
    pkg: HymnalRemotePackage,
    controller: AbortController,
  ): Promise<Uint8Array> {
    const source = await this.resolveDownloadSource(pkg.downloadUrl, controller.signal);
    const response = await this.fetchImpl(source.url, {
      signal: controller.signal,
      headers: source.headers,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Unduhan Pujian gagal (${response.status}).`);

    const totalBytes = Number(response.headers.get('content-length')) || pkg.sizeBytes;
    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      this.updateTask(pkg.code, {
        code: pkg.code,
        phase: 'downloading',
        receivedBytes: bytes.byteLength,
        totalBytes: totalBytes || bytes.byteLength,
      });
      return bytes;
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      receivedBytes += value.byteLength;
      this.updateTask(pkg.code, {
        code: pkg.code,
        phase: 'downloading',
        receivedBytes,
        totalBytes,
      });
    }

    const output = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  async install(code: HymnalPackCode): Promise<void> {
    if (this.controllers.has(code)) return;
    const manifest = await this.manifest(true);
    const pkg = manifest.packages.find((item) => item.code === code);
    if (!pkg) throw new Error(`Paket ${code} tidak tersedia.`);

    const controller = new AbortController();
    this.controllers.set(code, controller);
    this.updateTask(code, {
      code,
      phase: 'downloading',
      receivedBytes: 0,
      totalBytes: pkg.sizeBytes,
    });

    try {
      const packageBytes = await this.download(pkg, controller);
      this.updateTask(code, {
        code,
        phase: 'verifying',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
      });
      const checksum = await sha256Hex(packageBytes);
      if (checksum !== pkg.checksumSha256.toLowerCase()) {
        throw new Error('Checksum paket Pujian tidak cocok. Unduhan dibatalkan.');
      }

      this.updateTask(code, {
        code,
        phase: 'installing',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
      });
      const pdf = await decodeBiblePackage(packageBytes);
      if (!isPdf(pdf)) throw new Error('Isi paket Pujian bukan PDF yang valid.');

      const previous = await this.installed(code);
      await this.store.write(pdfPath(pkg.checksumSha256), pdf);
      const installed: InstalledHymnalPack = {
        code,
        version: pkg.version,
        checksumSha256: pkg.checksumSha256.toLowerCase(),
        installFileName: pkg.installFileName,
        packageSizeBytes: packageBytes.byteLength,
        pdfSizeBytes: pdf.byteLength,
        installedAt: this.now(),
      };
      await this.store.write(
        metaPath(code),
        new TextEncoder().encode(JSON.stringify(installed)),
      );
      if (previous && previous.checksumSha256 !== installed.checksumSha256) {
        await this.store.remove(pdfPath(previous.checksumSha256)).catch(() => undefined);
      }
      this.updateTask(code, {
        code,
        phase: 'complete',
        receivedBytes: packageBytes.byteLength,
        totalBytes: packageBytes.byteLength,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        this.updateTask(code, {
          code,
          phase: 'cancelled',
          receivedBytes: this.tasks.get(code)?.receivedBytes ?? 0,
          totalBytes: this.tasks.get(code)?.totalBytes ?? pkg.sizeBytes,
        });
        return;
      }
      this.updateTask(code, {
        code,
        phase: 'error',
        receivedBytes: this.tasks.get(code)?.receivedBytes ?? 0,
        totalBytes: this.tasks.get(code)?.totalBytes ?? pkg.sizeBytes,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.controllers.delete(code);
    }
  }

  cancel(code: HymnalPackCode): void {
    this.controllers.get(code)?.abort();
  }

  async remove(code: HymnalPackCode): Promise<void> {
    this.cancel(code);
    const installed = await this.installed(code);
    if (installed) await this.store.remove(pdfPath(installed.checksumSha256));
    await this.store.remove(metaPath(code));
    this.tasks.delete(code);
    this.emit();
  }
}

export const hymnalPackManager = new HymnalPackManager();
