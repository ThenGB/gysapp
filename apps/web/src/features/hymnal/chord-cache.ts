import {
  CHORD_BLOBS_PREFIX,
  CHORD_INDEX_PATH,
  ChordLazyCache,
  createHttpManifestFetcher,
} from '@gysapp/core';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';

export interface ChordCacheStats {
  blobs: number;
  sizeBytes: number;
  hasIndex: boolean;
}

const chordStore = new IndexedDbBlobStore('gysapp-chords');

/**
 * Shared Hymnal chord cache. Keep this outside SongViewer so Settings can
 * inspect/reset the cache without importing pdf.js/viewer-heavy code.
 */
export const chordCache = new ChordLazyCache({
  store: chordStore,
  fetchManifest: createHttpManifestFetcher({
    url: 'https://raw.githubusercontent.com/gyspnk/gyschordweb/main/docs/assets-chord-manifest.json',
  }),
  ttlChordsMs: 0,
  ttlMissingMs: 0,
  manifestDedupMs: 60_000,
});

export async function getChordCacheStats(): Promise<ChordCacheStats> {
  const paths = await chordStore.list(CHORD_BLOBS_PREFIX);
  let sizeBytes = 0;
  for (const path of paths) {
    sizeBytes += (await chordStore.stat(path))?.size ?? 0;
  }
  return {
    blobs: paths.length,
    sizeBytes,
    hasIndex: (await chordStore.stat(CHORD_INDEX_PATH)) !== null,
  };
}

export async function clearChordCache(): Promise<void> {
  await chordCache.resetAll();
}
