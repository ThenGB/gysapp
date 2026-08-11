export interface BlobStat {
  size: number;
  modifiedAt: number;
}

/**
 * Penyimpanan blob immutable yang dijamin atomik per `write`:
 * pembaca tidak pernah melihat file setengah jadi.
 * Diimplementasikan IndexedDB (web) / filesystem (Tauri); MemoryBlobStore
 * dipakai untuk test dan sebagai spesifikasi perilaku.
 */
export interface BlobStore {
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, data: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  stat(path: string): Promise<BlobStat | null>;
}

export class MemoryBlobStore implements BlobStore {
  private readonly files = new Map<string, { data: Uint8Array; modifiedAt: number }>();
  private readonly now: () => number;

  writeCount = 0;

  constructor(now?: () => number) {
    this.now = now ?? Date.now;
  }

  async read(path: string): Promise<Uint8Array | null> {
    const entry = this.files.get(path);
    return entry ? new Uint8Array(entry.data) : null;
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    this.writeCount += 1;
    this.files.set(path, { data: new Uint8Array(data), modifiedAt: this.now() });
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((p) => p.startsWith(prefix)).sort();
  }

  async stat(path: string): Promise<BlobStat | null> {
    const entry = this.files.get(path);
    return entry ? { size: entry.data.byteLength, modifiedAt: entry.modifiedAt } : null;
  }

  /** Snapshot semua blob untuk asersi test. */
  dump(): ReadonlyMap<string, Uint8Array> {
    return new Map([...this.files.entries()].map(([k, v]) => [k, v.data]));
  }
}
