import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SqliteBiblePort } from './sqlite-bible-port';

const DB_FILE = resolve(
  process.cwd(),
  '..',
  '..',
  'apps',
  'web',
  'public',
  'data',
  'bible',
  'b_tb',
  'b_tb.db',
);
const WASM_FILE = resolve(
  process.cwd(),
  '..',
  '..',
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

function dbFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('b_tb.db')) return new Response(await readFile(DB_FILE), { status: 200 });
    return new Response('not found', { status: 404 });
  });
}

describe('SqliteBiblePort', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', dbFetch());
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function createPort() {
    return new SqliteBiblePort({
      locateFile: () => WASM_FILE,
    });
  }

  it('loads full catalog (66 books, 1189 chapters)', async () => {
    const port = createPort();
    const catalog = await port.loadCatalog();
    expect(catalog.books).toHaveLength(66);
    expect(catalog.books[0]?.bl).toBe('Kejadian');
    expect(catalog.chapterCounts).toHaveLength(1189);
    expect(Object.keys(catalog.refs).length).toBeGreaterThan(0);
    expect(Object.keys(catalog.paralels).length).toBeGreaterThan(0);
  });

  it('loads chapters and pericopes by book/chapter', async () => {
    const port = createPort();
    const chapter = await port.loadChapter(1, 1);
    expect(chapter).not.toBeNull();
    expect(chapter?.[0]?.t).toContain('Pada mulanya');
    expect(chapter?.length).toBeGreaterThan(10);
    const pericopes = await port.loadPericopes(1, 1);
    expect(pericopes).not.toBeNull();
    expect(pericopes?.[0]?.t).toContain('Allah menciptakan');
  });

  it('returns null for missing chapter and exposes search index', async () => {
    const port = createPort();
    expect(await port.loadChapter(99, 1)).toBeNull();
    const index = await port.getSearchIndex();
    expect(index.length).toBe(31172);
    expect(index[0]?.id).toBe(1001001);
  });
});
