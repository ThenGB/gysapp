import type { SauhItem, SauhResult } from './types';

export function expectedSauhSlugForDate(date: Date): string {
  const y = date.getFullYear().toString().slice(2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `sbj${y}${m}${d}`;
}

export function absolutizeUrl(raw: string, base: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface WpPost {
  slug?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  date?: string;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

/**
 * Normalisasi feed Sauh dari WP REST tjc.org (categories=229).
 * Kontrak: slug hari ini `sbjYYMMDD` diprioritaskan; fallback feed urut tanggal.
 */
export function normalizeSauhPosts(posts: unknown[], date: Date): SauhResult {
  const base = 'https://tjc.org';
  const expectedSlug = expectedSauhSlugForDate(date);
  const items: SauhItem[] = [];
  let isToday = false;

  for (const raw of posts) {
    const post = raw as WpPost;
    if (!post.link) continue;
    const slug = post.slug ?? '';
    const excerptHtml = post.excerpt?.rendered ?? post.content?.rendered ?? '';
    items.push({
      slug,
      title: stripHtml(post.title?.rendered ?? ''),
      url: absolutizeUrl(post.link, base),
      imageUrl: post._embedded?.['wp:featuredmedia']?.[0]?.source_url
        ? absolutizeUrl(post._embedded['wp:featuredmedia'][0].source_url as string, base)
        : null,
      excerpt: stripHtml(excerptHtml),
      publishedAt: post.date ?? null,
    });
    if (slug === expectedSlug) isToday = true;
  }

  // Post hari ini diprioritaskan ke depan bila ada, sisanya tetap urut feed.
  if (isToday) {
    items.sort((a, b) => (a.slug === expectedSlug ? -1 : b.slug === expectedSlug ? 1 : 0));
  }
  return { isToday, items };
}
