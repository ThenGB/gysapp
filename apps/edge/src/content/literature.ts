import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { absolutizeUrl } from './sauh';
import type { TrueVoiceItem } from '@gysapp/contracts';

const TJC_BASE = 'https://tjc.org';

/**
 * Parsing tabel literatur tjc.org (Kesaksian: `#posts-table-1`, Renungan:
 * `#posts-table-3` — selector dari config Flutter). Item: <a> dalam <td>.
 */
export function parseTableLinks(html: string, selector: string): TrueVoiceItem[] {
  const $ = cheerio.load(html);
  const items: TrueVoiceItem[] = [];
  $(selector).each((_i, el) => {
    const link = $(el);
    const href = link.attr('href');
    if (!href) return;
    const title = link.text().trim();
    if (!title) return;
    const description = link.closest('td').text().replace(title, '').trim().slice(0, 160);
    const image = link.find('img').first().attr('src');
    items.push({
      title,
      url: absolutizeUrl(href, TJC_BASE),
      imageUrl: image ? absolutizeUrl(image, TJC_BASE) : null,
      description,
      author: null,
    });
  });
  return items;
}

/**
 * Panduan Pemahaman Alkitab memakai halaman katalog khusus `/id/literatur/bsg/`
 * dan bukan tabel literatur utama. Kontrak legacy Flutter juga mengambil daftar
 * Panduan secara terpisah. Ambil hanya heading katalog yang menuju `/id/bsg/*`
 * agar navigasi/footer situs tidak ikut menjadi item.
 */
export function parseBibleGuideLinks(html: string): TrueVoiceItem[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: TrueVoiceItem[] = [];

  $('h2 a[href]').each((_i, el) => {
    const link = $(el);
    const href = link.attr('href')?.trim();
    const title = link.text().replace(/\s+/g, ' ').trim();
    if (!href || !/^Panduan\s+Kitab\b/i.test(title)) return;
    const url = absolutizeUrl(href, TJC_BASE);
    if (!/^https:\/\/tjc\.org\/id\/bsg\//.test(url) || seen.has(url)) return;
    seen.add(url);

    const container = link.closest('article, .wpb_column, .vc_column_container, div');
    const image =
      link.find('img').first().attr('src') ??
      container.find('img').first().attr('data-src') ??
      container.find('img').first().attr('src');

    items.push({
      title,
      url,
      imageUrl: image ? absolutizeUrl(image, TJC_BASE) : null,
      description: 'Panduan Pemahaman Alkitab',
      author: null,
    });
  });

  return items;
}

export type { AnyNode };
