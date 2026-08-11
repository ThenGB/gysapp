import { z } from 'zod';

export const NOTE_IDX_INTRO = -1;
export const NOTE_IDX_OUTRO = 99999;
export const ROW_START_BASE = -2_000_000;
export const ROW_END_BASE = 2_000_000;

const ChordEntry = z.object({
  noteIdx: z.number().int(),
  chord: z.string().trim().min(1),
  theme: z.string().optional(),
  fillMode: z.string().optional(),
});
export type ChordEntry = z.infer<typeof ChordEntry>;

export const ChordDocument = z.object({
  version: z.literal(2),
  type: z.literal('note-aligned'),
  pages: z.record(z.string(), z.array(ChordEntry)),
});
export type ChordDocument = z.infer<typeof ChordDocument>;

export function parseChordDocument(input: unknown): ChordDocument {
  return ChordDocument.parse(input);
}

export function isValidChordDocument(input: unknown): input is ChordDocument {
  return ChordDocument.safeParse(input).success;
}

export function isRowStartSentinel(noteIdx: number): boolean {
  return noteIdx >= ROW_START_BASE && noteIdx < ROW_START_BASE + 1_000_000;
}

export function isRowEndSentinel(noteIdx: number): boolean {
  return noteIdx >= ROW_END_BASE && noteIdx < ROW_END_BASE + 1_000_000;
}

export function isPerRowSentinel(noteIdx: number): boolean {
  return isRowStartSentinel(noteIdx) || isRowEndSentinel(noteIdx);
}
