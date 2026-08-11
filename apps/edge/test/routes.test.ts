import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';

const FIXTURES = fileURLToPath(new URL('../../../tests/fixtures/online', import.meta.url));

function fixtureFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('wp-json/wp/v2/posts')) {
      return new Response(await readFile(`${FIXTURES}/sauh-wp-posts.json`, 'utf8'), {
        status: 200,
      });
    }
    if (url.includes('/suarasejati/')) {
      return new Response(await readFile(`${FIXTURES}/suara-sejati.html`, 'utf8'), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('BFF routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('GET /health returns ok', async () => {
    const app = createApp({ fetchImpl: fixtureFetch() as unknown as typeof fetch });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('GET /api/content/sauh returns normalized items with cache headers', async () => {
    const app = createApp({
      fetchImpl: fixtureFetch() as unknown as typeof fetch,
      now: () => new Date(2026, 7, 11, 12, 0, 0),
    });
    const res = await app.request('/api/content/sauh');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    const body = (await res.json()) as {
      items: Array<{ title: string; url: string }>;
      fetchedAt: string;
    };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.fetchedAt).toBe('2026-08-11T05:00:00.000Z');
  });

  it('GET /api/content/suara-sejati returns parsed articles', async () => {
    const app = createApp({ fetchImpl: fixtureFetch() as unknown as typeof fetch });
    const res = await app.request('/api/content/suara-sejati');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ title: string; url: string }> };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]?.url).toMatch(/^https:\/\/tjc\.org\//);
  });

  it('returns 502 when upstream fails', async () => {
    const failing = vi.fn(async () => new Response('boom', { status: 500 }));
    const app = createApp({ fetchImpl: failing as unknown as typeof fetch });
    const res = await app.request('/api/content/sauh');
    expect(res.status).toBe(502);
  });

  it('author endpoint rejects non-tjc urls', async () => {
    const app = createApp({ fetchImpl: fixtureFetch() as unknown as typeof fetch });
    const res = await app.request('/api/content/suara-sejati/1/author?url=https://evil.example');
    expect(res.status).toBe(400);
  });
});
