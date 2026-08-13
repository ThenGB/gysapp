import { describe, expect, it } from 'vitest';
import { parseBibleGuideLinks, parseTableLinks } from '../src/content/literature';

const TABLE_HTML = `
<table id="posts-table-1">
  <tbody>
    <tr><td><a href="https://tjc.org/id/kesaksian/1">Kesaksian Pertama</a></td></tr>
    <tr><td><a href="/id/kesaksian/2">Kesaksian Kedua</a></td></tr>
  </tbody>
</table>
<table id="posts-table-3">
  <tbody>
    <tr><td><a href="/id/renungan/1">Renungan Harian</a></td></tr>
  </tbody>
</table>`;

const BSG_HTML = `
<main>
  <h1>Panduan Pemahaman Alkitab</h1>
  <section><h2><a href="https://tjc.org/id/bsg/roma/">Panduan Kitab Roma</a></h2></section>
  <section><h2><a href="/id/bsg/markus/"> Panduan   Kitab Markus </a></h2></section>
  <section><h2><a href="/id/bsg/markus/">Panduan Kitab Markus</a></h2></section>
  <footer><h2><a href="/id/literatur/bsg/">Panduan Kitab Lainnya</a></h2></footer>
</main>`;

describe('parseTableLinks', () => {
  it('extracts rows matching the selector with absolutized urls', () => {
    const items = parseTableLinks(TABLE_HTML, '#posts-table-1 > tbody > tr > td > a');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Kesaksian Pertama',
      url: 'https://tjc.org/id/kesaksian/1',
    });
    expect(items[1]?.url).toBe('https://tjc.org/id/kesaksian/2');
  });

  it('extracts rows from the matching table only', () => {
    const items = parseTableLinks(TABLE_HTML, '#posts-table-3 > tbody > tr > td > a');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Renungan Harian',
      url: 'https://tjc.org/id/renungan/1',
    });
  });
});

describe('parseBibleGuideLinks', () => {
  it('extracts only unique official BSG catalog links', () => {
    const items = parseBibleGuideLinks(BSG_HTML);
    expect(items).toHaveLength(2);
    expect(items).toEqual([
      expect.objectContaining({
        title: 'Panduan Kitab Roma',
        url: 'https://tjc.org/id/bsg/roma/',
        description: 'Panduan Pemahaman Alkitab',
      }),
      expect.objectContaining({
        title: 'Panduan Kitab Markus',
        url: 'https://tjc.org/id/bsg/markus/',
      }),
    ]);
  });
});
