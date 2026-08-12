import type { SearchQuery } from './search';
import { matchesTestamentFilter, stripBibleTags } from './search';

export interface BibleIndexEntry {
  /** verse id terenkode (book*1e6 + chapter*1e3 + verse). */
  id: number;
  /** teks ayat BERSIH (tag sudah dihapus saat generator). */
  t: string;
}

export interface BibleIndexHit {
  entry: BibleIndexEntry;
  ranges: Array<{ start: number; end: number }>;
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
 * Pencarian seluruh Alkitab via index flat. Semua term wajib muncul di ayat
 * yang sama; filter testament diterapkan dari id (bookId = floor(id/1e6)).
 */
export function searchBibleIndex(
  index: BibleIndexEntry[],
  query: SearchQuery,
): BibleIndexHit[] {
  const terms = query.term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: BibleIndexHit[] = [];
  for (const entry of index) {
    const bookId = Math.floor(entry.id / 1_000_000);
    if (!matchesTestamentFilter(bookId, query.testament)) continue;
    if (query.bookIds && query.bookIds.length > 0 && !query.bookIds.includes(bookId)) continue;
    const lower = entry.t.toLowerCase();
    if (!terms.every((term) => lower.includes(term))) continue;
    hits.push({ entry, ranges: terms.flatMap((term) => findRanges(term, entry.t)) });
  }
  return hits;
}

export function stripBibleTagsForIndex(text: string): string {
  return stripBibleTags(text);
}
