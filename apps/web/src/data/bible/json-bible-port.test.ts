import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { JsonBiblePort } from './json-bible-port';

const FIXTURES = resolve(process.cwd(), '..', '..', 'tests', 'fixtures', 'bible');

function fixtureFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const chapter = url.match(/chapters\/(\d+_\d+)\.json$/);
    if (chapter) {
      return new Response(await readFile(`${FIXTURES}/chapters/${chapter[1]}.json`), { status: 200 });
    }
    const pericope = url.match(/pericopes\/(\d+_\d+)\.json$/);
    if (pericope) {
      return new Response(await readFile(`${FIXTURES}/pericopes/${pericope[1]}.json`), { status: 200 });
    }
    const file = ['books.json', 'chapter_counts.json', 'refs_by_bc.json', 'pericope_paralels_by_bc.json'].find((f) =>
      url.endsWith(`/${f}`),
    );
    if (file) {
      return new Response(await readFile(`${FIXTURES}/${file}`), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('JsonBiblePort', () => {
  it('loads catalog and chapters from static JSON', async () => {
    vi.stubGlobal('fetch', fixtureFetch());
    const port = new JsonBiblePort();
    const catalog = await port.loadCatalog();
    expect(catalog.books).toHaveLength(66);
    const chapter = await port.loadChapter(1, 1);
    expect(chapter).not.toBeNull();
    expect(chapter?.[0]?.t).toContain('Pada mulanya');
    const pericopes = await port.loadPericopes(1, 1);
    expect(pericopes).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null for missing chapter', async () => {
    vi.stubGlobal('fetch', fixtureFetch());
    const port = new JsonBiblePort();
    expect(await port.loadChapter(10, 1)).toBeNull();
    vi.unstubAllGlobals();
  });
});
