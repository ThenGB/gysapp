import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  extractAuthorFromHtml,
  normalizeImageUrl,
  parseSuaraSejatiPage,
} from '../src/content/suara-sejati';

const FIXTURE = fileURLToPath(
  new URL('../../../tests/fixtures/online/suara-sejati.html', import.meta.url),
);

describe('parseSuaraSejatiPage', () => {
  it('extracts articles from live tjc.org fixture', async () => {
    const html = await readFile(FIXTURE, 'utf8');
    const items = parseSuaraSejatiPage(html);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https:\/\/tjc\.org\//);
      if (item.imageUrl) expect(item.imageUrl).toMatch(/^https:\/\/tjc\.org\//);
    }
  });
});

describe('normalizeImageUrl', () => {
  it('strips WordPress -WxH size suffix', () => {
    expect(
      normalizeImageUrl('https://tjc.org/id/wp-content/uploads/sites/43/2023/11/27-300x200.png'),
    ).toBe('https://tjc.org/id/wp-content/uploads/sites/43/2023/11/27.png');
  });
  it('absolutizes relative paths', () => {
    expect(normalizeImageUrl('/id/wp-content/uploads/1.png')).toBe(
      'https://tjc.org/id/wp-content/uploads/1.png',
    );
  });
  it('returns null for empty input', () => {
    expect(normalizeImageUrl('')).toBeNull();
    expect(normalizeImageUrl(undefined)).toBeNull();
  });
});

describe('extractAuthorFromHtml', () => {
  it('extracts author from entry-content paragraphs', () => {
    const html =
      '<html><body><div class="entry-content"><p>Sebuah kesaksian oleh</p><p>Sdr. Budi Santoso dari Jakarta.</p></div></body></html>';
    expect(extractAuthorFromHtml(html)).toContain('Budi Santoso');
  });
  it('extracts with Pdt. prefix', () => {
    const html = '<div class="entry-content"><p>Ditulis oleh Pdt. Andreas Hutabarat.</p></div>';
    expect(extractAuthorFromHtml(html)).toContain('Andreas Hutabarat');
  });
  it('returns null when no author pattern matches', () => {
    expect(
      extractAuthorFromHtml('<div class="entry-content"><p>Tanpa penulis.</p></div>'),
    ).toBeNull();
  });
});
