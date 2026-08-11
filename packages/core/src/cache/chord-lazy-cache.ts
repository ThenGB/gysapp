import { parseChordDocument, type ChordDocument, type ChordManifest } from '@gysapp/contracts';
import type { BlobStore } from './blob-store';
import {
  CHORD_BLOBS_PREFIX,
  CHORD_GRACE_PERIOD_MS,
  CHORD_INDEX_PATH,
  blobPathFor,
  chordId,
  emptyChordIndex,
  parseChordIndex,
  referencedBlobPaths,
  type ChordCacheIndexV1,
} from './chord-index';
import type { ManifestFetcher } from './manifest-fetcher';
import { sha256Hex } from '../util/sha256';

export type ChordEnsureStatus = 'cached' | 'updated' | 'missing' | 'offline';

export interface ChordEnsureResult {
  status: ChordEnsureStatus;
  document: ChordDocument | null;
  /** sha256 dari chord aktif (null bila missing/offline). */
  sha256: string | null;
  /** Alasan pengguna tidak melihat chord baru (untuk observability). */
  reason?: 'manifest-unreachable' | 'not-in-manifest' | 'download-invalid' | 'ttl-not-elapsed';
}

export interface GcResult {
  removed: number;
  freedBytes: number;
}

export interface ChordLazyCacheOptions {
  store: BlobStore;
  fetchManifest: ManifestFetcher;
  /** Base URL file chord immutable. `{sourceCommit}` dan `{path}` di-substitusi. */
  assetBaseUrl?: string;
  /** TTL cek ulang saat chord ada (default 6 jam, mengikuti perilaku Flutter). */
  ttlChordsMs?: number;
  /** TTL cek ulang saat chord tidak ada di manifest (default 5 menit). */
  ttlMissingMs?: number;
  /** Dedup window manifest check per sesi (default 60 detik). */
  manifestDedupMs?: number;
  /** Batas byte cache chord. Default 50 MB. */
  maxTotalBytes?: number;
  /** Umur minimum unreferenced blob sebelum dihapus GC. */
  gracePeriodMs?: number;
  now?: () => number;
}

const DEFAULT_ASSET_BASE_URL =
  'https://raw.githubusercontent.com/gyspnk/gyschordweb/{sourceCommit}/{path}';

/**
 * Lazy chord cache content-addressed (ADR-0002).
 *
 * Invariants:
 * - Instalasi baru tidak punya file chord; tidak ada sync startup.
 * - `ensureChordForSong` hanya memproses ID lagu aktif.
 * - Manifest dicek kondisional (ETag/304) + short-circuit SHA-256.
 * - Blob ditulis hanya bila SHA-256 berbeda; file lama tidak pernah ditimpa.
 * - Index adalah commit point; update pointer atomik setelah validasi lengkap.
 * - Offline memakai blob aktif yang sudah ada.
 */
export class ChordLazyCache {
  private readonly store: BlobStore;
  private readonly fetchManifest: ManifestFetcher;
  private readonly assetBaseUrl: string;
  private readonly ttlChordsMs: number;
  private readonly ttlMissingMs: number;
  private readonly manifestDedupMs: number;
  private readonly maxTotalBytes: number;
  private readonly gracePeriodMs: number;
  private readonly now: () => number;

  private indexCache: ChordCacheIndexV1 | null = null;
  private indexLoaded = false;
  private lastManifestCheckAt = 0;
  private manifestEtag: string | null = null;
  private lastManifest: ChordManifest | null = null;
  private readonly inFlight = new Map<string, Promise<ChordEnsureResult>>();

  constructor(options: ChordLazyCacheOptions) {
    this.store = options.store;
    this.fetchManifest = options.fetchManifest;
    this.assetBaseUrl = options.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL;
    this.ttlChordsMs = options.ttlChordsMs ?? 6 * 60 * 60 * 1000;
    this.ttlMissingMs = options.ttlMissingMs ?? 5 * 60 * 1000;
    this.manifestDedupMs = options.manifestDedupMs ?? 60_000;
    this.maxTotalBytes = options.maxTotalBytes ?? 50 * 1024 * 1024;
    this.gracePeriodMs = options.gracePeriodMs ?? CHORD_GRACE_PERIOD_MS;
    this.now = options.now ?? Date.now;
  }

  async ensureChordForSong(bookCode: string, songNumber: string): Promise<ChordEnsureResult> {
    const id = chordId(bookCode, songNumber);
    const existing = this.inFlight.get(id);
    if (existing) return existing;
    const task = this.doEnsure(id).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, task);
    return task;
  }

  private async doEnsure(id: string): Promise<ChordEnsureResult> {
    const index = await this.loadIndex();
    const now = this.now();

    const fromCache = async (): Promise<ChordEnsureResult | null> => {
      const entry = index.entries[id];
      if (!entry) return null;
      const document = await this.loadActiveDocument(index, id);
      return {
        status: 'cached',
        document,
        sha256: entry.activeSha256,
        ...(document === null ? { reason: 'download-invalid' as const } : {}),
      };
    };

    const cached = await fromCache();
    const missing = index.missing[id];
    const ttl = cached ? this.ttlChordsMs : this.ttlMissingMs;
    const checkedAt = index.entries[id]?.lastAccessedAt ?? missing?.checkedAt ?? 0;

    if (cached && now - checkedAt < ttl) {
      index.entries[id]!.lastAccessedAt = now;
      await this.persistIndex(index);
      return cached;
    }
    if (missing && now - missing.checkedAt < ttl) {
      return { status: 'missing', document: null, sha256: null, reason: 'ttl-not-elapsed' };
    }

    let manifest: ChordManifest | null = null;
    if (this.shouldCheckManifest(now)) {
      const fetched = await this.fetchManifest(this.manifestEtag);
      if (fetched === null) {
        // Jaringan gagal: pakai cache lama; jangan sentuh index.
        if (cached) return cached;
        if (missing)
          return {
            status: 'missing',
            document: null,
            sha256: null,
            reason: 'manifest-unreachable',
          };
        return { status: 'offline', document: null, sha256: null, reason: 'manifest-unreachable' };
      }
      this.lastManifestCheckAt = now;
      if (fetched.etag !== null) this.manifestEtag = fetched.etag;
      if (fetched.manifest !== null) this.lastManifest = fetched.manifest;
      manifest = fetched.manifest ?? this.lastManifest;
    } else {
      // Window dedup: reuse manifest terakhir dari memori (nol jaringan).
      manifest = this.lastManifest;
    }

    if (manifest === null) {
      // Belum pernah berhasil fetch manifest di sesi ini: hanya cache lama.
      index.lastCheckedAt = now;
      if (cached) {
        index.entries[id]!.lastAccessedAt = now;
        await this.persistIndex(index);
        return cached;
      }
      if (missing)
        return { status: 'missing', document: null, sha256: null, reason: 'ttl-not-elapsed' };
      return { status: 'offline', document: null, sha256: null, reason: 'manifest-unreachable' };
    }

    const manifestSha = await sha256Hex(new TextEncoder().encode(JSON.stringify(manifest)));
    // Catat untuk observability, TAPI jangan short-circuit: manifest yang sama
    // tetap harus diterapkan ke ID lagu yang baru dibuka (mungkin belum di-cache).
    index.manifestSha256 = manifestSha;

    const entry = manifest.files.find((f) => f.id === id);
    if (!entry) {
      // Lagu tidak ada di manifest: negative-cache per sourceCommit.
      delete index.entries[id];
      index.missing[id] = { sourceCommit: manifest.sourceCommit, checkedAt: now };
      index.sourceCommit = manifest.sourceCommit;
      index.lastCheckedAt = now;
      await this.persistIndex(index);
      return { status: 'missing', document: null, sha256: null, reason: 'not-in-manifest' };
    }
    delete index.missing[id];
    index.sourceCommit = manifest.sourceCommit;
    index.lastCheckedAt = now;

    const active = index.entries[id];
    if (active && active.activeSha256 === entry.sha256) {
      active.lastAccessedAt = now;
      await this.persistIndex(index);
      const document = await this.loadActiveDocument(index, id);
      return { status: 'cached', document, sha256: entry.sha256 };
    }

    const result = await this.downloadAndActivate(index, entry, id, now);
    await this.persistIndex(index);
    if (result.status === 'updated') {
      const document = await this.loadActiveDocument(index, id);
      return { status: 'updated', document, sha256: result.sha256 };
    }
    if (result.status === 'cached' && result.document === null) {
      // Download gagal: kembalikan dokumen lama yang masih aktif.
      const document = await this.loadActiveDocument(index, id);
      return { ...result, document };
    }
    return result;
  }

  private async downloadAndActivate(
    index: ChordCacheIndexV1,
    entry: { id: string; path: string; size: number; sha256: string },
    id: string,
    now: number,
  ): Promise<ChordEnsureResult> {
    // 1) Blob content-addressed: kalau sudah ada, aktifkan tanpa jaringan.
    const blobPath = blobPathFor(entry.sha256);
    const existing = await this.store.read(blobPath);
    if (existing !== null && existing.byteLength === entry.size) {
      index.entries[id] = {
        activeSha256: entry.sha256,
        path: blobPath,
        size: existing.byteLength,
        lastAccessedAt: now,
      };
      return { status: 'updated', document: null, sha256: entry.sha256 };
    }

    const url = this.assetBaseUrl
      .replace('{sourceCommit}', index.sourceCommit ?? '')
      .replace('{path}', entry.path);
    let body: Uint8Array;
    try {
      const res = await fetch(url);
      if (!res.ok) return this.keepActive(index, id);
      body = new Uint8Array(await res.arrayBuffer());
    } catch {
      return this.keepActive(index, id);
    }

    if (body.byteLength !== entry.size) return this.keepActive(index, id);
    const sha = await sha256Hex(body);
    if (sha !== entry.sha256) return this.keepActive(index, id);

    try {
      const text = new TextDecoder().decode(body);
      parseChordDocument(JSON.parse(text));
    } catch {
      return this.keepActive(index, id);
    }

    // 2) Tulis blob immutable (tidak pernah menimpa file yang sudah ada).
    const already = await this.store.read(blobPath);
    if (already === null) {
      await this.store.write(blobPath, body);
    }

    // 3) Commit point: aktifkan pointer.
    index.entries[id] = {
      activeSha256: sha,
      path: blobPath,
      size: body.byteLength,
      lastAccessedAt: now,
    };
    return { status: 'updated', document: null, sha256: sha };
  }

  private keepActive(index: ChordCacheIndexV1, id: string): ChordEnsureResult {
    const entry = index.entries[id];
    if (entry) {
      return {
        status: 'cached',
        document: null,
        sha256: entry.activeSha256,
        reason: 'download-invalid',
      };
    }
    return { status: 'offline', document: null, sha256: null, reason: 'download-invalid' };
  }

  private async loadActiveDocument(
    index: ChordCacheIndexV1,
    id: string,
  ): Promise<ChordDocument | null> {
    const entry = index.entries[id];
    if (!entry) return null;
    const raw = await this.store.read(entry.path);
    if (raw === null) return null;
    if ((await sha256Hex(raw)) !== entry.activeSha256) return null;
    try {
      return parseChordDocument(JSON.parse(new TextDecoder().decode(raw)));
    } catch {
      return null;
    }
  }

  private shouldCheckManifest(now: number): boolean {
    return now - this.lastManifestCheckAt >= this.manifestDedupMs;
  }

  private async loadIndex(): Promise<ChordCacheIndexV1> {
    if (this.indexLoaded && this.indexCache) return this.indexCache;
    const raw = await this.store.read(CHORD_INDEX_PATH);
    const index =
      raw === null ? emptyChordIndex() : parseChordIndex(JSON.parse(new TextDecoder().decode(raw)));
    this.indexCache = index;
    this.indexLoaded = true;
    return index;
  }

  private async persistIndex(index: ChordCacheIndexV1): Promise<void> {
    const payload = new TextEncoder().encode(JSON.stringify(index));
    await this.store.write(CHORD_INDEX_PATH, payload);
    this.indexCache = index;
    this.indexLoaded = true;
  }

  /** Hapus pointer lagu (blob dipertahankan untuk rollback/GC) dan paksa re-check. */
  async resetSong(bookCode: string, songNumber: string): Promise<void> {
    const index = await this.loadIndex();
    const id = chordId(bookCode, songNumber);
    delete index.entries[id];
    delete index.missing[id];
    this.lastManifestCheckAt = 0;
    await this.persistIndex(index);
  }

  async resetAll(): Promise<void> {
    const index = emptyChordIndex();
    this.manifestEtag = null;
    this.lastManifestCheckAt = 0;
    this.lastManifest = null;
    for (const path of await this.store.list('chord/')) {
      await this.store.remove(path);
    }
    this.indexCache = index;
    this.indexLoaded = true;
  }

  /**
   * Garbage collection: hapus unreferenced blob yang lebih tua dari grace
   * period, lalu evict referenced LRU sampai di bawah byte limit.
   * Dipanggil aplikasi saat idle.
   */
  async gc(): Promise<GcResult> {
    const index = await this.loadIndex();
    const referenced = referencedBlobPaths(index);
    const now = this.now();
    let removed = 0;
    let freedBytes = 0;

    const all = await this.store.list(CHORD_BLOBS_PREFIX);
    const unreferenced: { path: string; size: number; modifiedAt: number }[] = [];
    for (const path of all) {
      const stat = await this.store.stat(path);
      if (!stat) continue;
      if (!referenced.has(path)) {
        if (now - stat.modifiedAt > this.gracePeriodMs) {
          await this.store.remove(path);
          removed += 1;
          freedBytes += stat.size;
        } else {
          unreferenced.push({ path, size: stat.size, modifiedAt: stat.modifiedAt });
        }
      }
    }

    let total = 0;
    for (const path of all) {
      const stat = await this.store.stat(path);
      if (stat) total += stat.size;
    }
    if (total > this.maxTotalBytes) {
      const evictable = [...unreferenced].sort((a, b) => a.modifiedAt - b.modifiedAt);
      for (const c of evictable) {
        if (total <= this.maxTotalBytes) break;
        await this.store.remove(c.path);
        total -= c.size;
        removed += 1;
        freedBytes += c.size;
      }
    }
    return { removed, freedBytes };
  }
}
