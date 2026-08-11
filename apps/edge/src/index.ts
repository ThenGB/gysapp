import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseSauhResult, parseTrueVoiceFeed } from '@gysapp/contracts';
import { createChordApp } from './chords';
import { normalizeSauhPosts } from './content/sauh';
import { extractAuthorFromHtml, parseSuaraSejatiPage } from './content/suara-sejati';

const TJC_WP_POSTS = 'https://tjc.org/id/wp-json/wp/v2/posts';
const TJC_SUARA_SEJATI = 'https://tjc.org/id/suarasejati/';

export function createApp(opts: { fetchImpl?: typeof fetch; now?: () => Date } = {}) {
  const app = new Hono();
  const now = opts.now ?? (() => new Date());
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  app.use(
    '/api/*',
    cors({
      origin: ['https://gysapp.pages.dev', 'http://localhost:5173'],
      maxAge: 86400,
    }),
  );

  app.route('/api/chords', createChordApp({ fetchImpl }));

  app.get('/health', (c) => c.json({ ok: true, ts: now().toISOString() }));

  app.get('/api/content/sauh', async (c) => {
    try {
      const url = new URL(TJC_WP_POSTS);
      url.searchParams.set('categories', '229');
      url.searchParams.set('per_page', '6');
      url.searchParams.set('orderby', 'date');
      url.searchParams.set('_embed', 'wp:featuredmedia');
      const posts = (await fetchImpl(url.toString(), {
        headers: { 'user-agent': 'gysapp-bff/0.1' },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.json();
      })) as unknown[];
      const result = normalizeSauhPosts(posts, now());
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      const body = parseSauhResult({ ...result, fetchedAt: now().toISOString() });
      return c.json(body);
    } catch (err) {
      c.status(502);
      return c.json({
        error: 'sauh-unavailable',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/content/suara-sejati', async (c) => {
    try {
      const html = await fetchImpl(TJC_SUARA_SEJATI, {
        headers: { 'user-agent': 'gysapp-bff/0.1' },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.text();
      });
      const items = parseSuaraSejatiPage(html);
      c.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      const body = parseTrueVoiceFeed({ items, fetchedAt: now().toISOString() });
      return c.json(body);
    } catch (err) {
      c.status(502);
      return c.json({
        error: 'suara-sejati-unavailable',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/content/suara-sejati/:id/author', async (c) => {
    const url = c.req.query('url');
    if (!url || !/^https:\/\/tjc\.org\//.test(url)) {
      c.status(400);
      return c.json({ error: 'invalid-url' });
    }
    try {
      const html = await fetchImpl(url, {
        headers: { 'user-agent': 'gysapp-bff/0.1' },
        signal: c.req.raw.signal,
      }).then(async (r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.text();
      });
      return c.json({ author: extractAuthorFromHtml(html) });
    } catch {
      c.status(502);
      return c.json({ error: 'author-unavailable' });
    }
  });

  return app;
}

export default createApp();
