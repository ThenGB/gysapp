import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';
import { clearChordCache, getChordCacheStats } from './chord-cache';

const encoder = new TextEncoder();
const store = new IndexedDbBlobStore('gysapp-chords');

describe('shared Hymnal chord cache', () => {
  beforeEach(async () => {
    await clearChordCache();
  });

  it('reports cached chord blobs and clears them without touching another namespace', async () => {
    await store.write('chord/blobs/aa/example.chord.json', encoder.encode('{"pages":{}}'));
    await store.write('unrelated/keep', encoder.encode('keep'));

    expect(await getChordCacheStats()).toMatchObject({ blobs: 1 });

    await clearChordCache();

    expect(await getChordCacheStats()).toMatchObject({ blobs: 0, sizeBytes: 0 });
    expect(new TextDecoder().decode((await store.read('unrelated/keep')) ?? new Uint8Array())).toBe(
      'keep',
    );
  });
});
