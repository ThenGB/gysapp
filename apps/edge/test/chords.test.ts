import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';

const MANIFEST = fileURLToPath(
  new URL('../../../tests/fixtures/chords/assets-chord-manifest.json', import.meta.url),
);

function fetchWithFixture() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('assets-chord-manifest.json')) {
      return new Response(await readFile(MANIFEST, 'utf8'), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('GET /api/chords/manifest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('proxies manifest with sha256 ETag and cache headers', async () => {
    const app = createApp({ fetchImpl: fetchWithFixture() as unknown as typeof fetch });
    const res = await app.request('/api/chords/manifest');
    expect(res.status).toBe(200);
    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const body = JSON.parse(await res.text());
    expect(body.schemaVersion).toBe(1);
    expect(body.files.length).toBeGreaterThan(100);
  });

  it('returns 304 when If-None-Match matches', async () => {
    const app = createApp({ fetchImpl: fetchWithFixture() as unknown as typeof fetch });
    const first = await app.request('/api/chords/manifest');
    const etag = first.headers.get('etag') as string;
    const second = await app.request('/api/chords/manifest', {
      headers: { 'If-None-Match': etag },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('etag')).toBe(etag);
  });

  it('returns 200 with fresh body when etag differs', async () => {
    const app = createApp({ fetchImpl: fetchWithFixture() as unknown as typeof fetch });
    const res = await app.request('/api/chords/manifest', {
      headers: { 'If-None-Match': '"deadbeef"' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 502 when upstream fails', async () => {
    const failing = vi.fn(async () => new Response('boom', { status: 503 }));
    const app = createApp({ fetchImpl: failing as unknown as typeof fetch });
    const res = await app.request('/api/chords/manifest');
    expect(res.status).toBe(502);
  });
});
