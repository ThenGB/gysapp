import { describe, expect, it } from 'vitest';
import { searchBibleIndex, type BibleIndexEntry } from '../../src/bible/search-index';
import { stripBibleTags } from '../../src/bible/search';

function entry(id: number, t: string): BibleIndexEntry {
  return { id, t };
}

const INDEX: BibleIndexEntry[] = [
  entry(1001001, 'Pada mulanya Allah menciptakan langit dan bumi.'),
  entry(1001003, 'Berfirmanlah Allah: "Jadilah terang." Lalu terang itu jadi.'),
  entry(1001004, 'Allah melihat bahwa terang itu baik.'),
  entry(43001001, 'Pada mulanya adalah Firman; Firman itu bersama-sama dengan Allah.'),
];

describe('searchBibleIndex', () => {
  it('finds hits across books with highlight ranges', () => {
    const hits = searchBibleIndex(INDEX, { term: 'terang', testament: 'all' });
    expect(hits).toHaveLength(2);
    const hit = hits[0];
    expect(hit?.entry.id).toBe(1001003);
    expect(hit?.ranges.length).toBeGreaterThan(0);
  });

  it('filters by testament', () => {
    const ot = searchBibleIndex(INDEX, { term: 'Allah', testament: 'ot' });
    expect(ot.every((h) => Math.floor(h.entry.id / 1_000_000) <= 39)).toBe(true);
    const nt = searchBibleIndex(INDEX, { term: 'Allah', testament: 'nt' });
    expect(nt.map((h) => h.entry.id)).toEqual([43001001]);
  });

  it('requires all terms in same verse', () => {
    const hits = searchBibleIndex(INDEX, { term: 'mulanya Firman', testament: 'all' });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.entry.id).toBe(43001001);
  });

  it('returns empty for empty term', () => {
    expect(searchBibleIndex(INDEX, { term: '  ', testament: 'all' })).toEqual([]);
  });

  it('strips bible tags in index text', () => {
    expect(stripBibleTags('<pb/><f>catatan</f>Firman itu jadi.')).toBe('Firman itu jadi.');
  });
});
