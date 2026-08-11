import { z } from 'zod';

export const ChordManifestEntry = z.object({
  id: z.string().regex(/^[A-Z0-9]+:\d+$/),
  bookCode: z.string(),
  songNumber: z.string(),
  title: z.string(),
  path: z.string(),
  formatVersion: z.number().int(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ChordManifestEntry = z.infer<typeof ChordManifestEntry>;

export const ChordManifest = z.object({
  schemaVersion: z.literal(1),
  sourceCommit: z.string().regex(/^[0-9a-f]{7,40}$/),
  files: z.array(ChordManifestEntry),
});
export type ChordManifest = z.infer<typeof ChordManifest>;

export function parseChordManifest(input: unknown): ChordManifest {
  return ChordManifest.parse(input);
}
