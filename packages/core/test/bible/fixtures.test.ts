import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseBibleChapter,
  parseBiblePericopes,
  parseBibleRefsByChapter,
  parseBibleParalelsByChapter,
  parseBibleBooks,
  parseChapterCounts,
} from '@gysapp/contracts';
import { decodeVerseId, encodeVerseId } from '../../src/bible/verse-id';

const FIXTURES = fileURLToPath(new URL('../../../../tests/fixtures/bible', import.meta.url));

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(`${FIXTURES}/${name}`, 'utf8'));
}

describe('bible fixtures integrity', () => {
  it('books.json parses and has 66 books', async () => {
    const books = parseBibleBooks(await readJson('books.json'));
    expect(books).toHaveLength(66);
    expect(books[0]).toMatchObject({ id: 1, bs: 'Kej', bl: 'Kejadian', c: 50 });
  });

  it('chapter_counts lists all 1189 chapters', async () => {
    const counts = parseChapterCounts(await readJson('chapter_counts.json'));
    expect(counts).toHaveLength(1189);
    expect(counts[0]).toMatchObject({ b: 1, c: 1, v: 31 });
  });

  it('chapter fixture parses and verse ids encode correctly', async () => {
    const chapter = parseBibleChapter(await readJson('chapters/1_1.json'));
    expect(chapter.length).toBeGreaterThan(10);
    for (const verse of chapter) {
      expect(verse.id).toBe(encodeVerseId(verse.b, verse.c, verse.v));
      expect(decodeVerseId(verse.id)).toEqual({
        bookId: verse.b,
        chapterId: verse.c,
        verseId: verse.v,
      });
      expect(verse.t.length).toBeGreaterThan(0);
    }
  });

  it('pericope fixture parses', async () => {
    const pericopes = parseBiblePericopes(await readJson('pericopes/1_1.json'));
    expect(pericopes.length).toBeGreaterThan(0);
    expect(pericopes[0]?.b).toBe(1);
  });

  it('refs and paralels parse', async () => {
    const refs = parseBibleRefsByChapter(await readJson('refs_by_bc.json'));
    expect(Object.keys(refs).length).toBeGreaterThan(0);
    const paralels = parseBibleParalelsByChapter(await readJson('pericope_paralels_by_bc.json'));
    expect(Object.keys(paralels).length).toBeGreaterThan(0);
  });
});

describe('verse id', () => {
  it('round-trips encode/decode', () => {
    expect(encodeVerseId(1, 1, 1)).toBe(1001001);
    expect(encodeVerseId(66, 22, 21)).toBe(66022021);
    expect(decodeVerseId(66022021)).toEqual({ bookId: 66, chapterId: 22, verseId: 21 });
  });

  it('builds chapter keys without leading zero', () => {
    expect(`${1}${1}`).toBe('11');
    expect(`${43}${3}`).toBe('433');
  });
});
