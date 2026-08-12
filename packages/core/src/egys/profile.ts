import { parseEgysProfile, type EgysMemberType, type EgysProfile } from '@gysapp/contracts';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function meaningful(value: unknown): boolean {
  if (value == null || typeof value === 'object') return false;
  const text = String(value).trim().toLowerCase();
  return text !== '' && text !== 'null' && text !== '-';
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (!meaningful(value)) continue;
    return String(value).trim();
  }
  return null;
}

function firstNumber(values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function parseBaptized(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (!meaningful(value)) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    ['1', 'true', 'yes', 'y', 'ya', 'sudah', 'sudah baptis', 'sudah dibaptis', 'baptized'].includes(
      normalized,
    )
  ) {
    return true;
  }
  if (
    [
      '0',
      'false',
      'no',
      'n',
      'tidak',
      'belum',
      'belum baptis',
      'belum dibaptis',
      'not baptized',
      'unbaptized',
    ].includes(normalized)
  ) {
    return false;
  }
  return null;
}

function normalizeMemberLabel(value: unknown): EgysMemberType | null {
  if (!meaningful(value)) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized.includes('simpatis') ||
    normalized.includes('belum baptis') ||
    normalized.includes('belum dibaptis') ||
    normalized.includes('not baptized') ||
    normalized.includes('unbaptized') ||
    normalized === 'visitor' ||
    normalized === 'sympathizer'
  ) {
    return 'Simpatisan';
  }
  if (
    normalized.includes('jemaat') ||
    normalized.includes('sudah baptis') ||
    normalized.includes('sudah dibaptis') ||
    normalized === 'baptized' ||
    normalized === 'member' ||
    normalized === 'church member'
  ) {
    return 'Jemaat';
  }
  return null;
}

function unwrapProfilePayload(input: unknown): UnknownRecord {
  const root = asRecord(input);
  if (!root) throw new Error('egys-profile-invalid');
  if (root.error === true) throw new Error('egys-profile-error');

  const data = root.data;
  if (Array.isArray(data) && data.length > 0) {
    const item = asRecord(data[0]);
    if (item) return item;
  }
  const dataRecord = asRecord(data);
  if (dataRecord) return dataRecord;
  if ('id' in root || 'email' in root || 'name' in root) return root;
  throw new Error('egys-profile-empty');
}

function mergeNestedAliases(payload: UnknownRecord): UnknownRecord {
  const normalized: UnknownRecord = { ...payload };
  for (const key of ['profile', 'user', 'membership', 'account']) {
    const nested = asRecord(payload[key]);
    if (!nested) continue;
    for (const [nestedKey, value] of Object.entries(nested)) {
      if (!meaningful(normalized[nestedKey])) normalized[nestedKey] = value;
    }
  }
  return normalized;
}

/**
 * Normalizes the profile variants observed in e-GYS and GYSAPP-Fork into one
 * stable contract. Generic account values such as ACTIVE/VERIFIED never become
 * a membership badge.
 */
export function normalizeEgysProfile(input: unknown): EgysProfile {
  const payload = mergeNestedAliases(unwrapProfilePayload(input));

  const baptized = parseBaptized(
    payload.baptized ??
      payload.is_baptized ??
      payload.isBaptized ??
      payload.baptism_status ??
      payload.baptismStatus ??
      payload.baptized_status ??
      payload.baptizedStatus,
  );

  const semanticMemberValues = [
    payload.member_type,
    payload.memberType,
    payload.membership_type,
    payload.membershipType,
    payload.jenisAnggota,
    payload.jenis_anggota,
    payload.member_status,
    payload.memberStatus,
  ];
  let memberType: EgysMemberType | null = null;
  for (const value of semanticMemberValues) {
    memberType = normalizeMemberLabel(value);
    if (memberType) break;
  }
  if (!memberType && baptized != null) memberType = baptized ? 'Jemaat' : 'Simpatisan';
  if (!memberType) {
    memberType = normalizeMemberLabel(payload.type) ?? normalizeMemberLabel(payload.status);
  }

  return parseEgysProfile({
    id: firstNumber([payload.id]),
    email: firstString([payload.email]),
    name: firstString([payload.name, payload.displayName, payload.full_name, payload.fullName]),
    mobilePhone: firstString([
      payload.mobilephone,
      payload.mobilePhone,
      payload.mobile_phone,
      payload.phone,
      payload.phoneNumber,
    ]),
    profilePicture: firstString([
      payload.profilepicture,
      payload.profilePicture,
      payload.profile_picture,
      payload.avatar,
      payload.avatarUrl,
      payload.avatar_url,
      payload.photoUrl,
      payload.photo_url,
    ]),
    accountStatus: firstString([payload.status, payload.account_status, payload.accountStatus]),
    branchId: firstNumber([payload.branchid, payload.branchId, payload.branch_id]),
    branchName: firstString([
      payload.branchname,
      payload.branchName,
      payload.branch_name,
      payload.churchName,
      payload.church_name,
      payload.congregationName,
      payload.congregation_name,
      payload.branch,
      payload.wilayah,
      payload.region,
      payload.regionName,
      payload.region_name,
      payload.wilayahName,
      payload.wilayah_name,
      payload.congregation,
    ]),
    memberType,
  });
}
