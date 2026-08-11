import type { BibleVerse } from '@gysapp/contracts';

/** Book id 1-39 = PL, 40-66 = PB. */
export function isOldTestament(bookId: number): boolean {
  return bookId >= 1 && bookId <= 39;
}

export function isNewTestament(bookId: number): boolean {
  return bookId >= 40 && bookId <= 66;
}

/**
 * Bersihkan markup Alkitab (kontrak bundel): buang footnote `<f>…</f>`
 * dan page-break `<pb/>`, lalu rapikan spasi. Dipakai untuk render dan search.
 */
export function stripBibleTags(text: string): string {
  return text
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '')
    .replace(/<pb\/?\s*>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchQuery {
  term: string;
  testament: 'all' | 'ot' | 'nt';
  /** Bila diisi, hanya buku-buku ini (id). */
  bookIds?: number[];
}

export interface SearchHit {
  verse: BibleVerse;
  /** Indeks range highlight di teks bersih. */
  ranges: Array<{ start: number; end: number }>;
  /** Teks bersih setelah sanitasi. */
  text: string;
}

function findRanges(needle: string, haystack: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  let from = 0;
  for (let i = 0; i < 200; i++) {
    const idx = lower.indexOf(term, from);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + term.length });
    from = idx + term.length;
  }
  return ranges;
}

/**
 * Pencarian perikop murni. `terms` dipisah spasi; semua term wajib muncul
 * di ayat yang sama (urutan bebas), mirip kontrak pencarian Flutter.
 */
export function searchChapter(chapter: BibleVerse[], query: SearchQuery): SearchHit[] {
  const terms = query.term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const verse of chapter) {
    const text = stripBibleTags(verse.t);
    const lower = text.toLowerCase();
    if (!terms.every((term) => lower.includes(term))) continue;
    const ranges = terms.flatMap((term) => findRanges(term, text));
    hits.push({ verse, text, ranges });
  }
  return hits;
}

export function matchesTestamentFilter(
  bookId: number,
  testament: SearchQuery['testament'],
): boolean {
  if (testament === 'ot') return isOldTestament(bookId);
  if (testament === 'nt') return isNewTestament(bookId);
  return true;
}
