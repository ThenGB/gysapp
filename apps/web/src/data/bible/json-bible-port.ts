import {
  parseBibleBooks,
  parseChapterCounts,
  parseBibleChapter,
  parseBiblePericopes,
  parseBibleRefsByChapter,
  parseBibleParalelsByChapter,
  type BibleBook,
  type BibleChapter,
  type BibleParalelsByChapter,
  type BiblePericopes,
  type BibleRefsByChapter,
  type ChapterCounts,
} from '@gysapp/contracts';
import type { BiblePort } from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';

const BASE = '/data/bible/b_tb';

interface CacheEntry<T> {
  promise: Promise<T>;
}

/**
 * BiblePort berbasis data JSON lengkap (1.189 pasal TB) yang disajikan
 * sebagai aset statis. Pasal dimuat lazily + cache memory; katalog
 * books/counts/refs/paralels di-fetch sekali.
 */
export class JsonBiblePort implements BiblePort {
  readonly code = 'b_tb';
  readonly label = 'Terjemahan Baru';

  private catalogCache: CacheEntry<Awaited<ReturnType<BiblePort['loadCatalog']>>> | null = null;
  private readonly chapterCache = new Map<string, Promise<BibleChapter | null>>();
  private readonly pericopeCache = new Map<string, Promise<BiblePericopes | null>>();

  private fetchJson<T>(path: string): Promise<T> {
    return fetch(assetUrl(path)).then(async (res) => {
      if (!res.ok) throw new Error(`fetch ${path} -> ${res.status}`);
      return (await res.json()) as T;
    });
  }

  loadCatalog(): Promise<Awaited<ReturnType<BiblePort['loadCatalog']>>> {
    if (!this.catalogCache) {
      this.catalogCache = {
        promise: Promise.all([
          this.fetchJson<unknown>(`${BASE}/books.json`),
          this.fetchJson<unknown>(`${BASE}/chapter_counts.json`),
          this.fetchJson<unknown>(`${BASE}/refs_by_bc.json`),
          this.fetchJson<unknown>(`${BASE}/pericope_paralels_by_bc.json`),
        ]).then(([books, counts, refs, paralels]) => ({
          books: parseBibleBooks(books) as BibleBook[],
          chapterCounts: parseChapterCounts(counts) as ChapterCounts,
          refs: parseBibleRefsByChapter(refs) as BibleRefsByChapter,
          paralels: parseBibleParalelsByChapter(paralels) as BibleParalelsByChapter,
        })),
      };
    }
    return this.catalogCache.promise;
  }

  loadChapter(bookId: number, chapterId: number): Promise<BibleChapter | null> {
    const key = `${bookId}:${chapterId}`;
    let promise = this.chapterCache.get(key);
    if (!promise) {
      promise = this.fetchJson<unknown>(`${BASE}/chapters/${bookId}_${chapterId}.json`).then(
        (raw) => parseBibleChapter(raw) as BibleChapter,
        () => null,
      );
      this.chapterCache.set(key, promise);
    }
    return promise;
  }

  loadPericopes(bookId: number, chapterId: number): Promise<BiblePericopes | null> {
    const key = `${bookId}:${chapterId}`;
    let promise = this.pericopeCache.get(key);
    if (!promise) {
      promise = this.fetchJson<unknown>(`${BASE}/pericopes/${bookId}_${chapterId}.json`).then(
        (raw) => parseBiblePericopes(raw) as BiblePericopes,
        () => null,
      );
      this.pericopeCache.set(key, promise);
    }
    return promise;
  }
}

export const biblePort = new JsonBiblePort();
