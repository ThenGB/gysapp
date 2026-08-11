import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFaithData } from '@gysapp/contracts';
import { searchFaith } from '../../src/faith/search';

const FIXTURE = fileURLToPath(new URL('../../../../tests/fixtures/faith.json', import.meta.url));

describe('faith fixtures', () => {
  it('parses faith.json with ID/EN/ZH and 10 points each', async () => {
    const data = parseFaithData(JSON.parse(await readFile(FIXTURE, 'utf8')));
    expect(data.faith.map((f) => f.language)).toEqual(['ID', 'EN', 'ZH']);
    for (const lang of data.faith) {
      expect(lang.content).toHaveLength(10);
      expect(lang.content[0]?.number).toBe('1');
      expect(lang.content[0]?.text.length).toBeGreaterThan(20);
    }
  });
});

describe('searchFaith', () => {
  it('finds by exact number', async () => {
    const data = parseFaithData(JSON.parse(await readFile(FIXTURE, 'utf8')));
    const points = data.faith[0]!.content;
    const hits = searchFaith(points, '3');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.point.number).toBe('3');
  });

  it('finds by term in text with highlight ranges', async () => {
    const data = parseFaithData(JSON.parse(await readFile(FIXTURE, 'utf8')));
    const points = data.faith[0]!.content;
    const hits = searchFaith(points, 'Roh Kudus');
    expect(hits.length).toBeGreaterThan(1);
    const hit = hits[0];
    expect(hit?.ranges.length).toBeGreaterThanOrEqual(2);
    const lower = hit!.point.text.toLowerCase();
    expect(lower).toContain('roh');
    expect(lower).toContain('kudus');
  });

  it('requires all terms in same point', async () => {
    const data = parseFaithData(JSON.parse(await readFile(FIXTURE, 'utf8')));
    const points = data.faith[0]!.content;
    const hits = searchFaith(points, 'Sabat hari kudus');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('returns empty for empty term', async () => {
    const data = parseFaithData(JSON.parse(await readFile(FIXTURE, 'utf8')));
    const points = data.faith[0]!.content;
    expect(searchFaith(points, '   ')).toEqual([]);
  });
});
