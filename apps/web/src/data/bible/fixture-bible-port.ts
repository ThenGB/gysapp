import {
  parseBibleChapter,
  parseBiblePericopes,
  parseBibleBooks,
  parseChapterCounts,
  type BibleBook,
  type BibleChapter,
  type BibleParalelsByChapter,
  type BiblePericopes,
  type BibleRefsByChapter,
  type ChapterCounts,
} from '@gysapp/contracts';
import type { BiblePort } from '@gysapp/core';

import booksRaw from './books.json';
import countsRaw from './chapter_counts.json';
import refsRaw from './refs_by_bc.json';
import paralelsRaw from './pericope_paralels_by_bc.json';
import ch1_1 from './chapters/1_1.json';
import ch1_2 from './chapters/1_2.json';
import ch43_1 from './chapters/43_1.json';
import ch43_3 from './chapters/43_3.json';
import per1_1 from './pericopes/1_1.json';
import per43_1 from './pericopes/43_1.json';

const CHAPTERS: Record<string, unknown> = {
  '1:1': ch1_1,
  '1:2': ch1_2,
  '43:1': ch43_1,
  '43:3': ch43_3,
};

const PERICOPES: Record<string, unknown> = {
  '1:1': per1_1,
  '43:1': per43_1,
};

/** Map pasal tersedia pada paket demo, dipakai juga oleh search. */
export const FIXTURE_CHAPTERS = CHAPTERS as Record<string, unknown>;

/**
 * BiblePort demo berbasis bundel JSON (subset 4 pasal).
 * Pola final: seluruh 1.189 pasal disajikan lewat asset manager
 * (paket offline), antarmuka port ini tidak berubah.
 */
export const fixtureBiblePort: BiblePort = {
  code: 'b_tb',
  label: 'Terjemahan Baru',

  async loadCatalog() {
    const books = parseBibleBooks(booksRaw) as BibleBook[];
    const counts = parseChapterCounts(countsRaw) as ChapterCounts;
    const refs = refsRaw as BibleRefsByChapter;
    const paralels = paralelsRaw as BibleParalelsByChapter;
    return { books, chapterCounts: counts, refs, paralels };
  },

  async loadChapter(bookId, chapterId) {
    const raw = CHAPTERS[`${bookId}:${chapterId}`];
    if (!raw) return null;
    return parseBibleChapter(raw) as BibleChapter;
  },

  async loadPericopes(bookId, chapterId) {
    const raw = PERICOPES[`${bookId}:${chapterId}`];
    if (!raw) return null;
    return parseBiblePericopes(raw) as BiblePericopes;
  },
};
