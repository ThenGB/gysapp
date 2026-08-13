import type { SongRef } from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';
import { hymnalPackManager } from './hymnal-pack-manager';

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
  pdfUrl: string | null;
  pdfFallbackUrl: string | null;
  pdfBytes: Uint8Array | null;
  sourcePageStart: number;
  sourcePageCount: number;
  midiUrl: string | null;
}

const MASTER = '/data/hymnal/index/master_index.json';
const RAW_HYMNAL_BASE =
  'https://raw.githubusercontent.com/ThenGB/gysapp/main/apps/web/public/data/hymnal';

function indexFileFor(code: string): string {
  return `/data/hymnal/index/${code.replace('-', '_').toLowerCase()}_index.json`;
}

function rawHymnalUrl(path: string): string {
  return `${RAW_HYMNAL_BASE}/${path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

/**
 * Katalog Pujian penuh: enam buku dari index JSON Flutter. KR mempunyai
 * partitur per-lagu bawaan; semua buku dapat memakai master PDF yang dipasang
 * lewat GYSApp-Data. URL raw GitHub menjadi fallback KR ketika hosting static
 * Pages gagal menyajikan aset besar/per-lagu.
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

    const normalizedCode = code.toUpperCase();
    const installedPdf = await hymnalPackManager.pdfBytes(normalizedCode).catch(() => null);
    const splitPdfAvailable = normalizedCode === 'KR';

    return {
      entry,
      pdfUrl: installedPdf
        ? null
        : splitPdfAvailable
          ? assetUrl(`/data/hymnal/${entry.pdfFile}`)
          : null,
      pdfFallbackUrl:
        !installedPdf && splitPdfAvailable ? rawHymnalUrl(entry.pdfFile) : null,
      pdfBytes: installedPdf,
      sourcePageStart: installedPdf ? Math.max(1, entry.page ?? 1) : 1,
      sourcePageCount: Math.max(1, entry.pages ?? 1),
      midiUrl: entry.midiFile ? assetUrl(`/data/hymnal/${entry.midiFile}`) : null,
    };
  }
}

export const hymnalCatalog = new HymnalCatalogPort();
