import { Hono } from 'hono';

const GYSCHORDWEB_MANIFEST =
  'https://raw.githubusercontent.com/gyspnk/gyschordweb/main/docs/assets-chord-manifest.json';
const GYSCHORDWEB_ASSETS_LIST =
  'https://raw.githubusercontent.com/gyspnk/gyschordweb/main/docs/assets-chord-list.json';

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  const bytes = new Uint8Array(digest);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Proxy manifest chord gyschordweb. ETag = SHA-256 body; 304 bila client
 * mengirim If-None-Match yang sama. File chord diunduh client dari
 * `{sourceCommit}/{path}` (immutable) sehingga tidak ada race dengan branch main.
 */
export function createChordApp(opts: { fetchImpl?: typeof fetch } = {}): Hono {
  const app = new Hono();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  app.get('/manifest', async (c) => {
    try {
      const res = await fetchImpl(GYSCHORDWEB_MANIFEST, {
        headers: { 'user-agent': 'gysapp-bff/0.1' },
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const body = new Uint8Array(await res.arrayBuffer());
      const etag = `"${await sha256Hex(body)}"`;
      c.header('ETag', etag);
      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=3600');
      if (c.req.header('If-None-Match') === etag) {
        return c.body(null, 304);
      }
      return c.body(body);
    } catch {
      c.status(502);
      return c.json({ error: 'chord-manifest-unavailable' });
    }
  });

  app.get('/list', async (c) => {
    try {
      const res = await fetchImpl(GYSCHORDWEB_ASSETS_LIST, {
        headers: { 'user-agent': 'gysapp-bff/0.1' },
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const body = await res.arrayBuffer();
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      return c.body(body);
    } catch {
      c.status(502);
      return c.json({ error: 'chord-list-unavailable' });
    }
  });

  return app;
}
