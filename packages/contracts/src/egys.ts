import { z } from 'zod';

export const EgysMemberType = z.enum(['Jemaat', 'Simpatisan']);
export type EgysMemberType = z.infer<typeof EgysMemberType>;

export const EgysProfile = z.object({
  id: z.number().int().nonnegative().default(0),
  email: z.string().nullable().default(null),
  name: z.string().nullable().default(null),
  mobilePhone: z.string().nullable().default(null),
  profilePicture: z.string().nullable().default(null),
  accountStatus: z.string().nullable().default(null),
  branchId: z.number().int().nonnegative().default(0),
  branchName: z.string().nullable().default(null),
  memberType: EgysMemberType.nullable().default(null),
});
export type EgysProfile = z.infer<typeof EgysProfile>;

export function parseEgysProfile(input: unknown): EgysProfile {
  return EgysProfile.parse(input);
}
