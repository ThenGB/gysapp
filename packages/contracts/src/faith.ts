import { z } from 'zod';

export const FaithPoint = z.object({
  number: z.string(),
  text: z.string(),
});
export type FaithPoint = z.infer<typeof FaithPoint>;

export const FaithLanguage = z.object({
  language: z.string(),
  title: z.string(),
  content: z.array(FaithPoint),
});
export type FaithLanguage = z.infer<typeof FaithLanguage>;

export const FaithData = z.object({
  faith: z.array(FaithLanguage),
});
export type FaithData = z.infer<typeof FaithData>;

export function parseFaithData(input: unknown): FaithData {
  return FaithData.parse(input);
}
