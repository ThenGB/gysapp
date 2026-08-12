import { IndexedDbBlobStore } from './blob-stores/indexeddb';

export type OfflineMediaKind = 'soundfont' | 'midi' | 'pdf';

export interface OfflineMediaEntry {
  url: string;
  kind: OfflineMediaKind;
  size: number;
  cachedAt: number;
  lastAccessedAt: number;
  pinned: boolean;
}

export interface OfflineMediaStats {
  count: number;
  sizeBytes: number;
  byKind: Record<OfflineMediaKind, { count: number; sizeBytes: number }>;
}

export interface OfflineMediaCacheOptions {
  store?: IndexedDbBlobStore;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const INDEX_PATH = '__meta__/offline-media-v1.json';
const DEFAULT_MAX_BYTES = 192 * 1024 * 1024;

function emptyStats(): OfflineMediaStats {
  return {
    count: 0,
    sizeBytes: 0,
    byKind: {
      soundfont: { count: 0, sizeBytes: 0 },
      midi: { count: 0, sizeBytes: 0 },
      pdf: { count: 0, sizeBytes: 0 },
    },
  };
}

function dataPath(kind: OfflineMediaKind, url: string): string {
  return `media/${kind}/${encodeURIComponent(url)}`;
}

function isKind(value: unknown): value is OfflineMediaKind {
  return value === 'soundfont' || value === 'midi' || value === 'pdf';
}

function normalizeEntry(value: unknown): OfflineMediaEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<OfflineMediaEntry>;
  if (
    typeof item.url !== 'string' ||
    !isKind(item.kind) ||
    typeof item.size !== 'number' ||
    !Number.isFinite(item.size) ||
    item.size < 0
  ) {
    return null;
  }
  const cachedAt =
    typeof item.cachedAt === 'number' && Number.isFinite(item.cachedAt) ? item.cachedAt : 0;
  const lastAccessedAt =
    typeof item.lastAccessedAt === 'number' && Number.isFinite(item.lastAccessedAt)
      ? item.lastAccessedAt
      : cachedAt;
  return {
    url: item.url,
    kind: item.kind,
    size: item.size,
    cachedAt,
    lastAccessedAt,
    pinned: item.kind === 'soundfont' || item.pinned === true,
  };
}

/**
 * Persistent cache for large worship media that the service worker deliberately
 * does not duplicate in Cache Storage. Bible packs and chord blobs live in their
 * own stores and are never touched here.
 *
 * - soundfont: pinned, because repeatedly downloading it makes MIDI startup slow;
 * - MIDI/PDF: LRU eviction when the media budget is exceeded;
 * - failed network requests fall back to a previously cached copy automatically.
 */
export class OfflineMediaCache {
  private readonly store: IndexedDbBlobStore;
  private readonly maxBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private indexPromise: Promise<OfflineMediaEntry[]> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: OfflineMediaCacheOptions = {}) {
    this.store = options.store ?? new IndexedDbBlobStore('gysapp-media-v1');
    this.maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private loadIndex(): Promise<OfflineMediaEntry[]> {
    this.indexPromise ??= this.store.read(INDEX_PATH).then((raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(new TextDecoder().decode(raw)) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeEntry).filter((entry): entry is OfflineMediaEntry => entry !== null);
      } catch {
        return [];
      }
    });
    return this.indexPromise;
  }

  private async persistIndex(entries: OfflineMediaEntry[]): Promise<void> {
    const payload = new TextEncoder().encode(JSON.stringify(entries));
    this.writeQueue = this.writeQueue.then(() => this.store.write(INDEX_PATH, payload));
    await this.writeQueue;
    this.indexPromise = Promise.resolve(entries);
  }

  private async touch(entry: OfflineMediaEntry, entries: OfflineMediaEntry[]): Promise<void> {
    const next = entries.map((item) =>
      item.kind === entry.kind && item.url === entry.url
        ? { ...item, lastAccessedAt: this.now() }
        : item,
    );
    await this.persistIndex(next);
  }

  async get(url: string, kind: OfflineMediaKind): Promise<Uint8Array | null> {
    const entries = await this.loadIndex();
    const entry = entries.find((item) => item.kind === kind && item.url === url);
    if (!entry) return null;
    const bytes = await this.store.read(dataPath(kind, url));
    if (!bytes) {
      await this.persistIndex(entries.filter((item) => item !== entry));
      return null;
    }
    await this.touch(entry, entries);
    return bytes;
  }

  async getOrFetch(
    url: string,
    kind: OfflineMediaKind,
    options: { signal?: AbortSignal } = {},
  ): Promise<Uint8Array> {
    const cached = await this.get(url, kind);
    if (cached) return cached;

    const response = await this.fetchImpl(url, {
      signal: options.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${kind} fetch failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await this.put(url, kind, bytes);
    return bytes;
  }

  async put(url: string, kind: OfflineMediaKind, bytes: Uint8Array): Promise<void> {
    const entries = await this.loadIndex();
    const timestamp = this.now();
    const nextEntry: OfflineMediaEntry = {
      url,
      kind,
      size: bytes.byteLength,
      cachedAt: timestamp,
      lastAccessedAt: timestamp,
      pinned: kind === 'soundfont',
    };
    await this.store.write(dataPath(kind, url), new Uint8Array(bytes));
    const next = [
      ...entries.filter((item) => !(item.kind === kind && item.url === url)),
      nextEntry,
    ];
    await this.persistIndex(next);
    await this.prune();
  }

  async prune(): Promise<void> {
    let entries = [...(await this.loadIndex())];
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total <= this.maxBytes) return;

    const removable = entries
      .filter((entry) => !entry.pinned)
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt || a.cachedAt - b.cachedAt);

    for (const entry of removable) {
      if (total <= this.maxBytes) break;
      await this.store.remove(dataPath(entry.kind, entry.url));
      total -= entry.size;
      entries = entries.filter((item) => item !== entry);
    }
    await this.persistIndex(entries);
  }

  async stats(): Promise<OfflineMediaStats> {
    const stats = emptyStats();
    for (const entry of await this.loadIndex()) {
      stats.count += 1;
      stats.sizeBytes += entry.size;
      stats.byKind[entry.kind].count += 1;
      stats.byKind[entry.kind].sizeBytes += entry.size;
    }
    return stats;
  }

  async clear(): Promise<void> {
    const entries = await this.loadIndex();
    await Promise.all(entries.map((entry) => this.store.remove(dataPath(entry.kind, entry.url))));
    await this.store.remove(INDEX_PATH);
    this.indexPromise = Promise.resolve([]);
  }
}

export const offlineMediaCache = new OfflineMediaCache();
