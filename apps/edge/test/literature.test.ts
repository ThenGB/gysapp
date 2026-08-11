import { describe, expect, it } from 'vitest';
import { parseTableLinks } from '../src/content/literature';

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
