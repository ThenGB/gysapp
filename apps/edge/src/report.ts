import { Hono, type Context } from 'hono';
import { parseReportRequest } from '@gysapp/contracts';

const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 };

function clientKey(c: Context): string {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const url = new URL(c.req.url);
  return `${ip}:${url.origin}`;
}

/**
 * /api/report — terima masukan pengguna, validasi, rate limit, lalu kirim ke
 * webhook provider email (env REPORT_WEBHOOK_URL). Kredensial SMTP TIDAK
 * pernah ada di client.
 */
export function createReportApp(opts: { fetchImpl?: typeof fetch; webhookUrl?: string }): Hono {
  const app = new Hono();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const seen = new Map<string, { count: number; windowStart: number }>();

  app.post('/', async (c) => {
    const key = clientKey(c);
    const now = Date.now();
    const entry = seen.get(key);
    if (entry && now - entry.windowStart < RATE_LIMIT.windowMs && entry.count >= RATE_LIMIT.max) {
      c.status(429);
      return c.json({
        error: 'rate-limited',
        retryInSeconds: Math.ceil((RATE_LIMIT.windowMs - (now - entry.windowStart)) / 1000),
      });
    }
    if (!entry || now - entry.windowStart >= RATE_LIMIT.windowMs) {
      seen.set(key, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      c.status(400);
      return c.json({ error: 'invalid-json' });
    }
    let parsed: ReturnType<typeof parseReportRequest>;
    try {
      parsed = parseReportRequest(body);
    } catch {
      c.status(400);
      return c.json({ error: 'invalid-report' });
    }

    if (!opts.webhookUrl) {
      c.status(503);
      return c.json({ error: 'report-not-configured' });
    }
    try {
      const res = await fetchImpl(opts.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      return c.json({ ok: true });
    } catch {
      c.status(502);
      return c.json({ error: 'report-delivery-failed' });
    }
  });

  return app;
}
