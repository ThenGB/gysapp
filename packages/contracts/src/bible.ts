import { z } from 'zod';

export const BibleBook = z.object({
  id: z.number().int(),
  bs: z.string(),
  bl: z.string(),
  c: z.number().int().positive(),
});
export type BibleBook = z.infer<typeof BibleBook>;

export const BibleVerse = z.object({
  id: z.number().int(),
  b: z.number().int(),
  c: z.number().int(),
  v: z.number().int(),
  t: z.string(),
  r: z.number().int().nullable(),
  c1: z.number().int().nullable(),
  v1: z.number().int().nullable(),
});
export type BibleVerse = z.infer<typeof BibleVerse>;

export const BibleChapter = z.array(BibleVerse);
export type BibleChapter = z.infer<typeof BibleChapter>;

export const BiblePericope = z.object({
  id: z.number().int(),
  s: z.number().int(),
  b: z.number().int(),
  c: z.number().int(),
  v: z.number().int(),
  t: z.string(),
});
export type BiblePericope = z.infer<typeof BiblePericope>;

export const BiblePericopes = z.array(BiblePericope);
export type BiblePericopes = z.infer<typeof BiblePericopes>;

export const BibleRef = z.object({
  id: z.number().int(),
  sv: z.number().int(),
  ev: z.number().int(),
});
export type BibleRef = z.infer<typeof BibleRef>;

/** refs_by_bc.json: key "bc" (chapter tanpa leading zero) -> daftar ref. */
export const BibleRefsByChapter = z.record(z.string(), z.array(BibleRef));
export type BibleRefsByChapter = z.infer<typeof BibleRefsByChapter>;

export const BibleParalel = z.object({
  id: z.number().int(),
  id1: z.number().int(),
  id2: z.number().int(),
  t: z.string(),
});
export type BibleParalel = z.infer<typeof BibleParalel>;

export const BibleParalelsByChapter = z.record(z.string(), z.array(BibleParalel));
export type BibleParalelsByChapter = z.infer<typeof BibleParalelsByChapter>;

export const ChapterCountEntry = z.object({
  b: z.number().int(),
  c: z.number().int(),
  v: z.number().int(),
});
export type ChapterCountEntry = z.infer<typeof ChapterCountEntry>;

/** chapter_counts.json: array {b, c, v} — total 1.189 pasal. */
export const ChapterCounts = z.array(ChapterCountEntry);
export type ChapterCounts = z.infer<typeof ChapterCounts>;

export function parseBibleChapter(input: unknown): BibleChapter {
  return BibleChapter.parse(input);
}

export function parseBiblePericopes(input: unknown): BiblePericopes {
  return BiblePericopes.parse(input);
}

export function parseBibleBooks(input: unknown): BibleBook[] {
  return z.array(BibleBook).parse(input);
}

export function parseChapterCounts(input: unknown): ChapterCounts {
  return ChapterCounts.parse(input);
}

export function parseBibleRefsByChapter(input: unknown): BibleRefsByChapter {
  return BibleRefsByChapter.parse(input);
}

export function parseBibleParalelsByChapter(input: unknown): BibleParalelsByChapter {
  return BibleParalelsByChapter.parse(input);
}
