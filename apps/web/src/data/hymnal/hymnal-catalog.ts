import type { SongRef } from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';

export interface HymnalBookMeta {
  code: string;
  songCount: number;
  hasMidi: boolean;
  indexFile: string;
}

export interface SongEntry {
  number: string;
  number2?: string;
  title: string;
  verses?: string[];
  pdfFile: string;
  midiFile?: string | null;
  hasChord?: boolean;
  chordFile?: string | null;
  pages?: number;
  page?: number;
}

export interface ResolvedSong {
  entry: SongEntry;
  pdfUrl: string;
  midiUrl: string | null;
}

const MASTER = '/data/hymnal/index/master_index.json';

function indexFileFor(code: string): string {
  return `/data/hymnal/index/${code.replace('-', '_').toLowerCase()}_index.json`;
}

/**
 * Katalog Pujian penuh: 6 buku, 533+ lagu (PDF + MIDI + lirik) dari
 * index JSON Flutter; aset disajikan statis di public/data/hymnal.
 */
export class HymnalCatalogPort {
  private booksPromise: Promise<HymnalBookMeta[]> | null = null;
  private playableSongsPromise: Promise<SongRef[]> | null = null;
  private readonly songsCache = new Map<string, Promise<SongEntry[]>>();

  private fetchJson<T>(path: string): Promise<T> {
    return fetch(assetUrl(path)).then(async (res) => {
      if (!res.ok) throw new Error(`fetch ${path} -> ${res.status}`);
      return (await res.json()) as T;
    });
  }

  loadBooks(): Promise<HymnalBookMeta[]> {
    if (!this.booksPromise) {
      this.booksPromise = this.fetchJson<Record<string, HymnalBookMeta>>(MASTER).then((raw) =>
        Object.values(raw).sort((a, b) => a.code.localeCompare(b.code)),
      );
    }
    return this.booksPromise;
  }

  loadSongs(code: string): Promise<SongEntry[]> {
    const key = code.toUpperCase();
    let promise = this.songsCache.get(key);
    if (!promise) {
      promise = this.fetchJson<SongEntry[]>(indexFileFor(code));
      this.songsCache.set(key, promise);
    }
    return promise;
  }

  /** Semua lagu yang benar-benar memiliki MIDI; cache untuk shuffle-all. */
  loadPlayableSongs(): Promise<SongRef[]> {
    if (!this.playableSongsPromise) {
      this.playableSongsPromise = this.loadBooks().then(async (books) => {
        const playableBooks = books.filter((book) => book.hasMidi);
        const groups = await Promise.all(
          playableBooks.map(async (book) => {
            const songs = await this.loadSongs(book.code);
            return songs
              .filter((song) => Boolean(song.midiFile))
              .map((song): SongRef => ({
                book: book.code,
                number: song.number,
                title: song.title,
              }));
          }),
        );
        return groups.flat();
      });
    }
    return this.playableSongsPromise;
  }

  async resolveSong(code: string, number: string): Promise<ResolvedSong | null> {
    const songs = await this.loadSongs(code);
    const entry =
      songs.find((s) => s.number === number) ??
      songs.find((s) => s.number2 === number) ??
      songs.find((s) => s.number === number.padStart(3, '0')) ??
      null;
    if (!entry) return null;
    return {
      entry,
      pdfUrl: assetUrl(`/data/hymnal/${entry.pdfFile}`),
      midiUrl: entry.midiFile ? assetUrl(`/data/hymnal/${entry.midiFile}`) : null,
    };
  }
}

export const hymnalCatalog = new HymnalCatalogPort();
