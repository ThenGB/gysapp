import { describe, expect, it } from 'vitest';
import type { BibleVerse } from '@gysapp/contracts';
import { matchesTestamentFilter, searchChapter, stripBibleTags } from '../../src/bible/search';

function verse(id: number, b: number, c: number, v: number, t: string): BibleVerse {
  return { id, b, c, v, t, r: 0, c1: null, v1: null };
}

const GEN1 = [
  verse(1001001, 1, 1, 1, '<pb/>Pada mulanya Allah menciptakan langit dan bumi.'),
  verse(1001002, 1, 1, 2, 'Bumi belum berbentuk dan kosong; gelap gulita menutupi samudera raya.'),
  verse(
    1001003,
    1,
    1,
    3,
    '<pb/><f>catatan kaki</f>Berfirmanlah Allah: "Jadilah terang." Lalu terang itu jadi.',
  ),
  verse(1001004, 1, 1, 4, 'Allah melihat bahwa terang itu baik.'),
];

describe('stripBibleTags', () => {
  it('removes footnote markers and page breaks', () => {
    expect(stripBibleTags('<pb/><f>catatan kaki</f>Berfirmanlah Allah: "Jadilah terang."')).toBe(
      'Berfirmanlah Allah: "Jadilah terang."',
    );
    expect(stripBibleTags('<pb/>Pada mulanya Allah menciptakan langit dan bumi.')).toBe(
      'Pada mulanya Allah menciptakan langit dan bumi.',
    );
  });
});

describe('searchChapter', () => {
  it('finds single-term matches and reports highlight ranges', () => {
    const hits = searchChapter(GEN1, { term: 'terang', testament: 'all' });
    expect(hits).toHaveLength(2); // ayat 3 dan 4
    const hit = hits[0];
    expect(hit?.ranges.length).toBeGreaterThan(0);
    expect(hit?.text.slice(hit.ranges[0]!.start, hit.ranges[0]!.end)).toBe('terang');
  });

  it('requires all terms in same verse for multi-term queries', () => {
    const hits = searchChapter(GEN1, { term: 'Allah menciptakan', testament: 'all' });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.verse.v).toBe(1);
  });

  it('returns empty for empty term', () => {
    expect(searchChapter(GEN1, { term: '   ', testament: 'all' })).toEqual([]);
  });

  it('is case-insensitive', () => {
    const hits = searchChapter(GEN1, { term: 'ALLAH', testament: 'all' });
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('testament filter', () => {
  it('classifies books correctly', () => {
    expect(matchesTestamentFilter(1, 'ot')).toBe(true);
    expect(matchesTestamentFilter(39, 'ot')).toBe(true);
    expect(matchesTestamentFilter(40, 'nt')).toBe(true);
    expect(matchesTestamentFilter(66, 'nt')).toBe(true);
    expect(matchesTestamentFilter(1, 'nt')).toBe(false);
    expect(matchesTestamentFilter(43, 'ot')).toBe(false);
    expect(matchesTestamentFilter(43, 'all')).toBe(true);
  });
});
