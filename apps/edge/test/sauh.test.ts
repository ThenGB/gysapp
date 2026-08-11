import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { expectedSauhSlugForDate, normalizeSauhPosts } from '../src/content/sauh';
import type { WpPost } from '../src/content/sauh';

const FIXTURE = fileURLToPath(
  new URL('../../../tests/fixtures/online/sauh-wp-posts.json', import.meta.url),
);

describe('expectedSauhSlugForDate', () => {
  it('builds sbjYYMMDD from local date', () => {
    expect(expectedSauhSlugForDate(new Date(2026, 7, 11))).toBe('sbj260811');
    expect(expectedSauhSlugForDate(new Date(2026, 0, 5))).toBe('sbj260105');
  });
});

describe('normalizeSauhPosts', () => {
  it('normalizes live WP REST fixture into SauhItems', async () => {
    const posts = JSON.parse(await readFile(FIXTURE, 'utf8')) as unknown[];
    expect(posts.length).toBeGreaterThan(0);
    const result = normalizeSauhPosts(posts, new Date(2026, 7, 11));
    expect(result.items.length).toBe(posts.length);
    for (const item of result.items) {
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https:\/\/tjc\.org\//);
      expect(item.excerpt.length).toBeGreaterThan(0);
    }
  });

  it('prioritizes today slug when present', () => {
    const posts: WpPost[] = [
      { slug: 'sbj260810', link: 'https://tjc.org/x', title: { rendered: 'lama' } },
      { slug: 'sbj260811', link: 'https://tjc.org/y', title: { rendered: 'hari ini' } },
    ];
    const result = normalizeSauhPosts(posts, new Date(2026, 7, 11));
    expect(result.isToday).toBe(true);
    expect(result.items[0]?.slug).toBe('sbj260811');
  });

  it('marks isToday false and keeps feed order otherwise', () => {
    const posts: WpPost[] = [
      { slug: 'sbj260801', link: 'https://tjc.org/a', title: { rendered: 'a' } },
      { slug: 'sbj260802', link: 'https://tjc.org/b', title: { rendered: 'b' } },
    ];
    const result = normalizeSauhPosts(posts, new Date(2026, 7, 11));
    expect(result.isToday).toBe(false);
    expect(result.items.map((i) => i.slug)).toEqual(['sbj260801', 'sbj260802']);
  });

  it('absolutizes relative links and strips HTML entities', () => {
    const posts: WpPost[] = [
      {
        slug: 'x',
        link: '/id/relatif',
        title: { rendered: 'Judul &amp; <em>Asli</em>' },
        excerpt: { rendered: '<p>Ayat <b>suci</b> &#8211; indah</p>' },
      },
    ];
    const result = normalizeSauhPosts(posts, new Date(2026, 7, 11));
    expect(result.items[0]?.url).toBe('https://tjc.org/id/relatif');
    expect(result.items[0]?.title).toBe('Judul & Asli');
    expect(result.items[0]?.excerpt).toBe('Ayat suci – indah');
  });
});
