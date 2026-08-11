import type { BlobStat, BlobStore } from '@gysapp/core';

const DB_VERSION = 1;
const STORE_NAME = 'blobs';

/**
 * IndexedDB BlobStore untuk web (PWA). Setiap `put` adalah satu transaksi
 * readwrite yang atomik per key; pembaca tidak pernah melihat isi sebagian.
 * Menyimpan { data: Uint8Array, size, modifiedAt } per path.
 */
export class IndexedDbBlobStore implements BlobStore {
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'gysapp-blobs') {
    this.dbName = dbName;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('indexeddb open failed'));
      });
    }
    return this.dbPromise;
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = fn(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexeddb op failed'));
    });
  }

  async read(path: string): Promise<Uint8Array | null> {
    const record = await this.withStore<
      { data: Uint8Array; size: number; modifiedAt: number } | undefined
    >(
      'readonly',
      (store) =>
        store.get(path) as IDBRequest<
          { data: Uint8Array; size: number; modifiedAt: number } | undefined
        >,
    );
    return record ? new Uint8Array(record.data) : null;
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    await this.withStore('readwrite', (store) =>
      store.put(
        { data: new Uint8Array(data), size: data.byteLength, modifiedAt: Date.now() },
        path,
      ),
    );
  }

  async remove(path: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(path) as IDBRequest<undefined>);
  }

  async list(prefix: string): Promise<string[]> {
    const db = await this.open();
    return new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const keys: string[] = [];
      const request = store.openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.startsWith(prefix)) keys.push(key);
          cursor.continue();
        } else {
          resolve(keys.sort());
        }
      };
      request.onerror = () => reject(request.error ?? new Error('indexeddb cursor failed'));
    });
  }

  async stat(path: string): Promise<BlobStat | null> {
    const record = await this.withStore<
      { data: Uint8Array; size: number; modifiedAt: number } | undefined
    >(
      'readonly',
      (store) =>
        store.get(path) as IDBRequest<
          { data: Uint8Array; size: number; modifiedAt: number } | undefined
        >,
    );
    return record ? { size: record.size, modifiedAt: record.modifiedAt } : null;
  }
}
