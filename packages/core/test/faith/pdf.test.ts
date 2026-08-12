import { describe, expect, it, vi } from 'vitest';
import { fetchFaithPdfManifest, downloadFaithPdf } from '../../src/faith/pdf';
import type { FaithPdfManifest } from '@gysapp/contracts';
import { sha256Hex } from '../../src/util/sha256';

const CONTENT = new Uint8Array([1, 2, 3, 4]);
const CONTENT_SHA = await sha256Hex(CONTENT);

const item: FaithPdfManifest['items'][number] = {
  number: 1,
  name: '01-Yesus Kristus.pdf',
  asset: '01-Yesus Kristus.pdf',
  size: CONTENT.length,
  sha256: CONTENT_SHA,
  downloadUrl: 'https://github.com/ThenGB/GYSApp-Data/releases/download/x/01.pdf',
};

const manifest: FaithPdfManifest = {
  schemaVersion: 1,
  kind: 'faith-pdfs',
  tag: 'faith-pdfs-2026.08.09-1',
  generatedAt: '2026-08-09T00:00:00.000Z',
  items: [item],
};

describe('faith pdf', () => {
  it('fetches and parses manifest', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 }));
    const result = await fetchFaithPdfManifest(fetchImpl as unknown as typeof fetch);
    expect(result.items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('faith-pdfs-manifest.json'));
  });

  it('downloads pdf and verifies sha256', async () => {
    const fetchImpl = vi.fn(async () => new Response(CONTENT, { status: 200 }));
    const bytes = await downloadFaithPdf(item, fetchImpl as unknown as typeof fetch);
    expect(bytes).toEqual(CONTENT);
  });

  it('rejects tampered content', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(new Uint8Array([9, 9, 9, 9]), { status: 200 }),
    );
    await expect(downloadFaithPdf(item, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      'sha256',
    );
  });
});
