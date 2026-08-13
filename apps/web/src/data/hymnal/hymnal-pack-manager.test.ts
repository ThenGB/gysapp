// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { sha256Hex } from '@gysapp/core';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';
import { HymnalPackManager, parseHymnalPackManifest } from './hymnal-pack-manager';

const PDF = new TextEncoder().encode('%PDF-1.7\nfixture\n%%EOF');

function responseBytes(bytes: Uint8Array): Response {
  return new Response(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: { 'content-length': String(bytes.byteLength) },
  });
}

describe('HymnalPackManager', () => {
  let checksum: string;

  beforeEach(async () => {
    checksum = await sha256Hex(PDF);
  });

  it('rejects manifests without valid packages', () => {
    expect(() => parseHymnalPackManifest({ track: 'hymnals', packages: [] })).toThrow(
      /paket valid/i,
    );
  });

  it('downloads, verifies, stores, and removes a hymnal PDF', async () => {
    const manifest = {
      track: 'hymnals',
      releaseTag: 'hymnals-test',
      publishedAt: '2026-08-14T00:00:00Z',
      packages: [
        {
          code: 'KR',
          version: 'test',
          fileName: 'kr.gyspkg',
          downloadUrl: 'https://github.test/kr.gyspkg',
          installFileName: 'kr_master.pdf',
          sizeBytes: PDF.byteLength,
          checksumSha256: checksum,
        },
      ],
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes('manifest')) return new Response(JSON.stringify(manifest), { status: 200 });
      if (value.includes('asset')) return responseBytes(PDF);
      throw new Error(`unexpected url ${value}`);
    });
    const manager = new HymnalPackManager({
      store: new IndexedDbBlobStore(`test-hymnal-${Math.random().toString(36).slice(2)}`),
      fetchImpl: fetchImpl as typeof fetch,
      manifestUrl: 'https://example.test/manifest.json',
      resolveDownloadSource: async () => ({ url: 'https://example.test/asset' }),
      now: () => 1234,
    });

    await manager.install('KR');

    expect(new TextDecoder().decode((await manager.pdfBytes('KR')) ?? new Uint8Array())).toContain(
      '%PDF-1.7',
    );
    expect(await manager.installed('KR')).toMatchObject({
      code: 'KR',
      version: 'test',
      installedAt: 1234,
      checksumSha256: checksum,
    });
    expect(manager.getTaskSnapshot('KR')?.phase).toBe('complete');

    await manager.remove('KR');
    expect(await manager.installed('KR')).toBeNull();
    expect(await manager.pdfBytes('KR')).toBeNull();
  });

  it('does not activate a package with the wrong checksum', async () => {
    const manifest = {
      track: 'hymnals',
      releaseTag: 'hymnals-test',
      publishedAt: '2026-08-14T00:00:00Z',
      packages: [
        {
          code: 'KR',
          version: 'test',
          fileName: 'kr.gyspkg',
          downloadUrl: 'https://github.test/kr.gyspkg',
          installFileName: 'kr_master.pdf',
          sizeBytes: PDF.byteLength,
          checksumSha256: '0'.repeat(64),
        },
      ],
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('manifest')
        ? new Response(JSON.stringify(manifest), { status: 200 })
        : responseBytes(PDF),
    );
    const manager = new HymnalPackManager({
      store: new IndexedDbBlobStore(`test-hymnal-${Math.random().toString(36).slice(2)}`),
      fetchImpl: fetchImpl as typeof fetch,
      manifestUrl: 'https://example.test/manifest.json',
      resolveDownloadSource: async () => ({ url: 'https://example.test/asset' }),
    });

    await expect(manager.install('KR')).rejects.toThrow(/checksum/i);
    expect(await manager.installed('KR')).toBeNull();
    expect(manager.getTaskSnapshot('KR')?.phase).toBe('error');
  });
});
