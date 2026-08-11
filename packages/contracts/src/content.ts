import { z } from 'zod';

export const SauhItem = z.object({
  slug: z.string(),
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
  excerpt: z.string(),
  publishedAt: z.string().nullable(),
});
export type SauhItem = z.infer<typeof SauhItem>;

export const SauhResult = z.object({
  isToday: z.boolean(),
  items: z.array(SauhItem),
  fetchedAt: z.string(),
});
export type SauhResult = z.infer<typeof SauhResult>;

export const TrueVoiceItem = z.object({
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
  description: z.string(),
  author: z.string().nullable(),
});
export type TrueVoiceItem = z.infer<typeof TrueVoiceItem>;

export const TrueVoiceFeed = z.object({
  items: z.array(TrueVoiceItem),
  fetchedAt: z.string(),
});
export type TrueVoiceFeed = z.infer<typeof TrueVoiceFeed>;

export function parseSauhResult(input: unknown): SauhResult {
  return SauhResult.parse(input);
}

export function parseTrueVoiceFeed(input: unknown): TrueVoiceFeed {
  return TrueVoiceFeed.parse(input);
}
