import { z } from 'zod';

export const AccountProfile = z.object({
  sub: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  picture: z.string().url().nullable(),
});
export type AccountProfile = z.infer<typeof AccountProfile>;

export function parseAccountProfile(input: unknown): AccountProfile {
  return AccountProfile.parse(input);
}

export const ReportRequest = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  contact: z.string().email().optional(),
  anonymous: z.boolean().default(false),
});
export type ReportRequest = z.infer<typeof ReportRequest>;

export function parseReportRequest(input: unknown): ReportRequest {
  return ReportRequest.parse(input);
}
