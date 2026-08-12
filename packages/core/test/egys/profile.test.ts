import { describe, expect, it } from 'vitest';
import { normalizeEgysProfile } from '../../src/egys/profile';

describe('normalizeEgysProfile', () => {
  it('normalizes current API aliases and semantic membership', () => {
    const profile = normalizeEgysProfile({
      data: {
        id: 7,
        email: 'jemaat@example.com',
        name: 'Budi',
        status: 'ACTIVE',
        memberType: 'church member',
        branch_name: 'Pontianak',
        branch_id: 12,
      },
    });
    expect(profile.memberType).toBe('Jemaat');
    expect(profile.branchName).toBe('Pontianak');
    expect(profile.branchId).toBe(12);
    expect(profile.accountStatus).toBe('ACTIVE');
  });

  it('derives Simpatisan from baptism status without leaking ACTIVE as member type', () => {
    const profile = normalizeEgysProfile({
      data: [{ id: 9, status: 'ACTIVE', baptized: 0, wilayah: 'Kubu Raya' }],
    });
    expect(profile.memberType).toBe('Simpatisan');
    expect(profile.branchName).toBe('Kubu Raya');
  });

  it('merges nested profile variants and tolerates missing optional fields', () => {
    const profile = normalizeEgysProfile({
      data: {
        id: '11',
        account: {
          displayName: 'Ani',
          avatar_url: 'https://example.com/a.png',
          congregationName: 'Singkawang',
          membership_type: 'Jemaat',
        },
      },
    });
    expect(profile.id).toBe(11);
    expect(profile.name).toBe('Ani');
    expect(profile.profilePicture).toBe('https://example.com/a.png');
    expect(profile.branchName).toBe('Singkawang');
    expect(profile.memberType).toBe('Jemaat');
  });

  it('rejects empty profile envelopes', () => {
    expect(() => normalizeEgysProfile({ data: [] })).toThrow('egys-profile-empty');
  });
});
