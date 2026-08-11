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

export type { AnyNode };
