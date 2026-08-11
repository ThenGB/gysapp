import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ChordLazyCache, sha256Hex } from '@gysapp/core';
import { IndexedDbBlobStore } from './indexeddb';

function chordDoc(pages: Record<string, unknown>) {
  return JSON.stringify({ version: 2, type: 'note-aligned', pages });
}

describe('IndexedDbBlobStore (contract BlobStore)', () => {
  let store: IndexedDbBlobStore;

  beforeEach(() => {
    store = new IndexedDbBlobStore(`test-blobs-${Math.random().toString(36).slice(2)}`);
  });

  it('round-trips write/read/stat/remove', async () => {
    const data = new TextEncoder().encode('hello');
    await store.write('chord/index.json', data);
    const raw = await store.read('chord/index.json');
    expect(raw).not.toBeNull();
    expect(new TextDecoder().decode(raw ?? new Uint8Array())).toBe('hello');
    expect((await store.stat('chord/index.json'))?.size).toBe(5);
    await store.remove('chord/index.json');
    expect(await store.read('chord/index.json')).toBeNull();
  });

  it('lists keys by prefix and isolates writes', async () => {
    await store.write('chord/blobs/ab/abc.chord.json', new TextEncoder().encode('1'));
    await store.write('chord/blobs/cd/cde.chord.json', new TextEncoder().encode('2'));
    await store.write('other/x', new TextEncoder().encode('3'));
    const paths = await store.list('chord/blobs/');
    expect(paths).toEqual(['chord/blobs/ab/abc.chord.json', 'chord/blobs/cd/cde.chord.json']);
    expect(await store.read('other/x')).not.toBeNull();
  });
});

describe('ChordLazyCache over IndexedDbBlobStore', () => {
  let store: IndexedDbBlobStore;

  beforeEach(() => {
    store = new IndexedDbBlobStore(`test-cache-${Math.random().toString(36).slice(2)}`);
  });

  it('persists chord blobs and index across cache instances', async () => {
    const files = new Map<string, string>([
      ['KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] })],
    ]) as Map<string, string>;
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/chords/manifest')) {
        const content = files.get('KR:001') ?? '';
        const sha = await sha256Hex(new TextEncoder().encode(content));
        const body = JSON.stringify({
          schemaVersion: 1,
          sourceCommit: 'b2da4ae5353e082defe857454950b445a9bffcea',
          files: [
            {
              id: 'KR:001',
              bookCode: 'KR',
              songNumber: '001',
              title: 'x',
              path: '001.chord.json',
              formatVersion: 2,
              size: new TextEncoder().encode(content).byteLength,
              sha256: sha,
            },
          ],
        });
        return new Response(body, { status: 200 });
      }
      return new Response(files.get('KR:001') ?? '', { status: 200 });
    };
    const stub = fetchImpl as unknown as typeof fetch;
    vi.stubGlobal('fetch', stub);

    const first = new ChordLazyCache({
      store,
      fetchManifest: async () => {
        const res = await stub('https://bff.test/chords/manifest');
        return {
          manifest: JSON.parse(await res.text()),
          etag: null,
        };
      },
      assetBaseUrl: 'https://raw.test/{sourceCommit}/{path}',
    });
    const result = await first.ensureChordForSong('KR', '001');
    expect(result.status).toBe('updated');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('C');
    vi.unstubAllGlobals();

    // Instance baru (simulasi reload halaman): baca dari IndexedDB tanpa jaringan.
    const offlineFetcher = async () => null;
    const second = new ChordLazyCache({
      store,
      fetchManifest: offlineFetcher,
      assetBaseUrl: 'https://raw.test/{sourceCommit}/{path}',
    });
    const cached = await second.ensureChordForSong('KR', '001');
    expect(cached.status).toBe('cached');
    expect(cached.document?.pages['1']?.[0]?.chord).toBe('C');
    expect(cached.sha256).toBe(
      await sha256Hex(new TextEncoder().encode(files.get('KR:001') ?? '')),
    );
  });
});
