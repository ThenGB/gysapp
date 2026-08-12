import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseSauhResult, parseTrueVoiceFeed } from '@gysapp/contracts';
import { createReportApp } from './report';
import { normalizeSauhPosts } from './content/sauh';
import { extractAuthorFromHtml, parseSuaraSejatiPage } from './content/suara-sejati';
import { parseTableLinks } from './content/literature';

const TJC_WP_POSTS = 'https://tjc.org/id/wp-json/wp/v2/posts';
const TJC_SUARA_SEJATI = 'https://tjc.org/id/suarasejati/';
const TJC_LITERATUR = 'https://tjc.org/id/literatur/';
const TJC_WARTA = 'https://tjc.org/id/literatur/warta-sejati/';
const KESAKSIAN_SELECTOR = '#posts-table-1 > tbody > tr > td > a';
const RENUNGAN_SELECTOR = '#posts-table-3 > tbody > tr > td > a';

export type EdgeEnv = {
  REPORT_WEBHOOK_URL?: string;
  APP_ORIGINS?: string;
};

function parseOrigins(value?: string): string[] | undefined {
  const origins = value
    ?.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : undefined;
}

export function createApp(
  opts: {
    fetchImpl?: typeof fetch;
    now?: () => Date;
    reportWebhookUrl?: string;
    appOrigins?: string[];
  } = {},
) {
  const app = new Hono();
  const now = opts.now ?? (() => new Date());
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const allowedOrigins = opts.appOrigins ?? [
    'https://thengb.github.io',
    'https://gyspnk.github.io',
    'https://gysapp.pages.dev',
    'http://localhost:5173',
  ];

  app.use('/api/*', cors({ origin: allowedOrigins, maxAge: 86400 }));
  app.route('/api/report', createReportApp({ fetchImpl, webhookUrl: opts.reportWebhookUrl }));

  app.get('/health', (c) => c.json({ ok: true, ts: now().toISOString() }));

  app.get('/api/content/sauh', async (c) => {
    try {
      const url = new URL(TJC_WP_POSTS);
      url.searchParams.set('categories', '229');
      url.searchParams.set('per_page', '6');
      url.searchParams.set('orderby', 'date');
      url.searchParams.set('_embed', 'wp:featuredmedia');
      const posts = (await fetchImpl(url.toString(), {
        headers: { 'user-agent': 'gysapp-content-gateway/0.3' },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.json();
      })) as unknown[];
      const result = normalizeSauhPosts(posts, now());
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      return c.json(parseSauhResult({ ...result, fetchedAt: now().toISOString() }));
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
        headers: { 'user-agent': 'gysapp-content-gateway/0.3' },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.text();
      });
      c.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      return c.json(
        parseTrueVoiceFeed({ items: parseSuaraSejatiPage(html), fetchedAt: now().toISOString() }),
      );
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
        headers: { 'user-agent': 'gysapp-content-gateway/0.3' },
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

  const literatureFeed = (
    path: string,
    upstream: string,
    errorKey: string,
    parse: (html: string) => ReturnType<typeof parseSuaraSejatiPage>,
  ) => {
    app.get(path, async (c) => {
      try {
        const html = await fetchImpl(upstream, {
          headers: { 'user-agent': 'gysapp-content-gateway/0.3' },
        }).then(async (r) => {
          if (!r.ok) throw new Error(`upstream ${r.status}`);
          return r.text();
        });
        c.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
        return c.json(parseTrueVoiceFeed({ items: parse(html), fetchedAt: now().toISOString() }));
      } catch (err) {
        c.status(502);
        return c.json({
          error: errorKey,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  literatureFeed('/api/content/kesaksian', TJC_LITERATUR, 'kesaksian-unavailable', (html) =>
    parseTableLinks(html, KESAKSIAN_SELECTOR),
  );
  literatureFeed('/api/content/warta', TJC_WARTA, 'warta-unavailable', parseSuaraSejatiPage);
  literatureFeed('/api/content/renungan', TJC_LITERATUR, 'renungan-unavailable', (html) =>
    parseTableLinks(html, RENUNGAN_SELECTOR),
  );

  return app;
}

export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const app = createApp({
      reportWebhookUrl: env.REPORT_WEBHOOK_URL,
      appOrigins: parseOrigins(env.APP_ORIGINS),
    });
    return app.fetch(request);
  },
};
