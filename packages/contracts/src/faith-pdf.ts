import { z } from 'zod';

export const FaithPdfItem = z.object({
  number: z.number().int(),
  name: z.string(),
  asset: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  downloadUrl: z.string().url(),
});
export type FaithPdfItem = z.infer<typeof FaithPdfItem>;

export const FaithPdfManifest = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('faith-pdfs'),
  tag: z.string(),
  generatedAt: z.string(),
  items: z.array(FaithPdfItem),
});
export type FaithPdfManifest = z.infer<typeof FaithPdfManifest>;

export function parseFaithPdfManifest(input: unknown): FaithPdfManifest {
  return FaithPdfManifest.parse(input);
}
