import type { FaithPoint } from '@gysapp/contracts';

export interface FaithSearchHit {
  point: FaithPoint;
  /** Indeks range highlight di teks. */
  ranges: Array<{ start: number; end: number }>;
}

function findRanges(needle: string, haystack: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  let from = 0;
  for (let i = 0; i < 100; i++) {
    const idx = lower.indexOf(term, from);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + term.length });
    from = idx + term.length;
  }
  return ranges;
}

/**
 * Pencarian pokok iman murni: cocok dengan nomor atau teks (case-insensitive,
 * semua term wajib muncul).
 */
export function searchFaith(points: FaithPoint[], term: string): FaithSearchHit[] {
  const terms = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: FaithSearchHit[] = [];
  for (const point of points) {
    const text = point.text;
    const lower = text.toLowerCase();
    const numberMatch = point.number.toLowerCase() === term.trim().toLowerCase();
    if (!numberMatch && !terms.every((t) => lower.includes(t))) continue;
    const ranges = numberMatch ? [] : terms.flatMap((t) => findRanges(t, text));
    hits.push({ point, ranges });
  }
  return hits;
}
