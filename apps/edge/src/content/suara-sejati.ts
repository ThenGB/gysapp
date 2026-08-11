import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { TrueVoiceItem } from '@gysapp/contracts';
import { absolutizeUrl } from './sauh';

const TJC_BASE = 'https://tjc.org';

/**
 * Normalisasi URL gambar WordPress: hapus ukuran `-WxH` sebelum ekstensi
 * (mis. `27-300x200.png` -> `27.png`), lalu absolutkan.
 */
export function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/(-\d+x\d+)(\.[a-zA-Z0-9]+)$/, '$2');
  return absolutizeUrl(normalized, TJC_BASE);
}

export function pickImageSrc(img: cheerio.Cheerio<AnyNode>): string | null {
  const srcset = img.attr('srcset');
  if (srcset) {
    const largest = srcset
      .split(',')
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        return { url: url ?? '', size: size ? parseInt(size.replace('w', ''), 10) || 0 : 0 };
      })
      .sort((a, b) => b.size - a.size)[0];
    if (largest?.url && !largest.url.startsWith('data:')) return largest.url;
  }
  const src = img.attr('src');
  if (src && !src.startsWith('data:')) return src;
  const noscript = img.parent().find('noscript img').first().attr('src');
  if (noscript && !noscript.startsWith('data:')) return noscript;
  return null;
}

/**
 * Parsing halaman Suara Sejati tjc.org (selector `.grid4 article`, perilaku
 * mengikuti scrapper Flutter). Dijalankan server-side di BFF.
 */
export function parseSuaraSejatiPage(html: string): TrueVoiceItem[] {
  const $ = cheerio.load(html);
  const items: TrueVoiceItem[] = [];

  $('.grid4 article').each((_i, el) => {
    const article = $(el);
    const title = article.find('.post-title').text().trim();
    const link = article.find('a[href]').first().attr('href');
    if (!link || !title) return;
    const description = article.find('p').first().text().trim();
    const image = normalizeImageUrl(pickImageSrc(article.find('img').first()));
    items.push({
      title,
      url: absolutizeUrl(link, TJC_BASE),
      imageUrl: image,
      description,
      author: null,
    });
  });

  return items;
}

const AUTHOR_RE =
  /(?:Sdri\.|Sdr\.|Pdt\.|Pnt\.|Dkn\.|Pjm\.|Ev\.|Gembala|Penatua|Diaken|Misionaris)\s+([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF.\s''-]{2,60})/;

/**
 * Ekstraksi penulis dari halaman detail artikel (di-cache BFF, tidak di
 * client). Mengembalikan null bila tidak ditemukan - item tetap valid.
 */
export function extractAuthorFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const texts: string[] = [];
  $('.entry-content p').each((_i, el) => {
    texts.push($(el).text());
  });
  const bodyText = texts.join('\n') || $('body').text();
  const first500 = bodyText.slice(0, 500);
  const match = first500.match(AUTHOR_RE);
  return match ? (match[1] ?? '').trim() || null : null;
}
