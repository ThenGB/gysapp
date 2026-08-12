import { describe, expect, it } from 'vitest';
import { biblePackAvailability, parseBiblePackManifest } from './asset-manifest';

const manifest = {
  track: 'bibles',
  releaseTag: 'bibles-2026.05.21',
  publishedAt: '2026-05-21T06:43:39Z',
  packages: [
    {
      code: 'b_kjv',
      version: '2026.05.21',
      fileName: 'b_kjv.gyspkg',
      downloadUrl: 'https://example.test/b_kjv.gyspkg',
      installFileName: 'b_kjv.db',
      sizeBytes: 1935399,
      checksumSha256: '9c2e7e76794c764ae5871aa2b0e196cb72453fb64797b2fab703d9da97f74838',
    },
  ],
};

describe('Bible asset manifest', () => {
  it('accepts versioned HTTPS packages with SHA-256', () => {
    expect(parseBiblePackManifest(manifest).packages[0]?.code).toBe('b_kjv');
  });

  it('rejects an invalid checksum', () => {
    expect(() =>
      parseBiblePackManifest({
        ...manifest,
        packages: [{ ...manifest.packages[0], checksumSha256: 'not-a-checksum' }],
      }),
    ).toThrow(/SHA-256/);
  });

  it('reports built-in and update states deterministically', () => {
    expect(biblePackAvailability({ code: 'b_tb', builtIn: true })).toBe('built-in');
    expect(
      biblePackAvailability({
        code: 'b_tb',
        builtIn: true,
        installedChecksum: 'a'.repeat(64),
        remoteChecksum: 'b'.repeat(64),
      }),
    ).toBe('update-available');
  });
});
