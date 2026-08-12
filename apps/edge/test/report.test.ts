import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';

const WEBHOOK = 'https://webhook.test/email';

describe('report route', () => {
  afterEach(() => vi.restoreAllMocks());

  it('validates and forwards reports to webhook', async () => {
    const webhook = vi.fn(async () => new Response('ok', { status: 200 }));
    const app = createApp({
      reportWebhookUrl: WEBHOOK,
      fetchImpl: webhook as unknown as typeof fetch,
    });
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Lapor', message: 'Isi laporan', anonymous: true }),
    });
    expect(res.status).toBe(200);
    expect(webhook).toHaveBeenCalledTimes(1);
    const callArgs = webhook.mock.calls[0] as unknown as [string, { body: string }];
    const sent = JSON.parse(callArgs[1].body) as { subject: string };
    expect(sent.subject).toBe('Lapor');
  });

  it('rejects invalid payloads', async () => {
    const app = createApp({ reportWebhookUrl: WEBHOOK });
    const empty = await app.request('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: '', message: 'x' }),
    });
    expect(empty.status).toBe(400);
  });

  it('returns 503 when webhook not configured', async () => {
    const app = createApp({});
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'S', message: 'M' }),
    });
    expect(res.status).toBe(503);
  });

  it('rate limits after 5 requests in 10 minutes', async () => {
    const webhook = vi.fn(async () => new Response('ok', { status: 200 }));
    const app = createApp({
      reportWebhookUrl: WEBHOOK,
      fetchImpl: webhook as unknown as typeof fetch,
    });
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: `S${i}`, message: 'M' }),
      });
      expect(res.status).toBe(200);
    }
    const limited = await app.request('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'ke-6', message: 'M' }),
    });
    expect(limited.status).toBe(429);
    expect((await limited.json()) as { error: string }).toMatchObject({ error: 'rate-limited' });
  });
});
