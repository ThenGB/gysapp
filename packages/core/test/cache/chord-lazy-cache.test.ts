import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChordManifest } from '@gysapp/contracts';
import { ChordLazyCache } from '../../src/cache/chord-lazy-cache';
import { MemoryBlobStore } from '../../src/cache/blob-store';
import { createHttpManifestFetcher } from '../../src/cache/manifest-fetcher';
import { CHORD_INDEX_PATH } from '../../src/cache/chord-index';
import { sha256Hex } from '../../src/util/sha256';

const COMMIT = 'b2da4ae5353e082defe857454950b445a9bffcea';
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

interface FakeServer {
  files: Map<string, string>;
  commit: string;
  manifestRequests: number;
  blobRequests: string[];
  networkDown: boolean;
  fetchImpl: typeof fetch;
  buildManifest: () => Promise<ChordManifest>;
}

function createServer(): FakeServer {
  const server: FakeServer = {
    files: new Map(),
    commit: COMMIT,
    manifestRequests: 0,
    blobRequests: [],
    networkDown: false,
    fetchImpl: undefined as unknown as typeof fetch,
    buildManifest: async () => {
      const files = [];
      for (const [id, content] of server.files.entries()) {
        const body = new TextEncoder().encode(content);
        files.push({
          id,
          bookCode: id.split(':')[0] as string,
          songNumber: id.split(':')[1] as string,
          title: id,
          path: `docs/assets/chord/${id.split(':')[1]}.chord.json`,
          formatVersion: 2,
          size: body.byteLength,
          sha256: await sha256Hex(body),
        });
      }
      return { schemaVersion: 1, sourceCommit: server.commit, files } as ChordManifest;
    },
  };
  return server;
}

function chordDoc(pages: Record<string, unknown>) {
  return JSON.stringify({ version: 2, type: 'note-aligned', pages });
}

async function setup() {
  const server = createServer();
  const nowState = { t: 1_000_000 };
  const now = () => nowState.t;

  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (server.networkDown) throw new Error('network down');
    if (url.includes('/chords/manifest')) {
      server.manifestRequests += 1;
      const body = JSON.stringify(await server.buildManifest());
      const etag = `"${await sha256Hex(new TextEncoder().encode(body))}"`;
      return new Response(body, { status: 200, headers: { etag } });
    }
    server.blobRequests.push(url);
    const match = url.match(/\/chord\/(\d+)\.chord\.json$/);
    const id = match ? `KR:${match[1]}` : null;
    const content = id ? server.files.get(id) : undefined;
    if (!content) return new Response('not found', { status: 404 });
    return new Response(content, { status: 200 });
  });

  const fetcher = createHttpManifestFetcher({
    url: 'https://bff.test/api/chords/manifest',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

  const store = new MemoryBlobStore(now);
  const cache = new ChordLazyCache({
    store,
    fetchManifest: fetcher,
    assetBaseUrl: 'https://raw.test/{sourceCommit}/{path}',
    ttlChordsMs: 6 * HOUR,
    ttlMissingMs: 5 * MINUTE,
    manifestDedupMs: 60_000,
    maxTotalBytes: 1024 * 1024,
    gracePeriodMs: 14 * 24 * HOUR,
    now,
  });

  server.fetchImpl = fetchImpl as unknown as typeof fetch;
  // ChordLazyCache mendownload file via global fetch.
  vi.stubGlobal('fetch', fetchImpl);
  return {
    server,
    cache,
    store,
    now: () => nowState.t,
    setNow: (t: number) => (nowState.t = t),
    fetchImpl,
  };
}

describe('ChordLazyCache', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fresh install: no chord files exist until a song is opened', async () => {
    const { server, store } = await setup();
    expect(await store.list('chord/')).toEqual([]);
    expect(server.manifestRequests).toBe(0);
  });

  it('first open downloads manifest + exactly one chord file', async () => {
    const { server, cache, store, fetchImpl } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));

    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('updated');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('C');
    expect(server.manifestRequests).toBe(1);
    expect(server.blobRequests).toHaveLength(1);
    const blobs = await store.list('chord/blobs/');
    expect(blobs).toHaveLength(1);
    expect(blobs[0] as string).toContain('/blobs/');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('opening another song downloads only that song', async () => {
    const { server, cache, store } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    server.files.set('KR:002', chordDoc({ 1: [{ noteIdx: 1, chord: 'G' }] }));

    await cache.ensureChordForSong('KR', '001');
    const writesAfterFirst = store.writeCount;
    await cache.ensureChordForSong('KR', '002');

    expect(server.manifestRequests).toBe(1);
    expect(server.blobRequests).toHaveLength(2);
    expect(store.writeCount - writesAfterFirst).toBe(2); // blob + index
  });

  it('unchanged sha: no blob write, no file request when TTL not elapsed', async () => {
    const { server, cache, store } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    const blobsBefore = await store.list('chord/blobs/');
    const requests = server.blobRequests.length;

    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('cached');
    expect(server.blobRequests.length).toBe(requests);
    expect(await store.list('chord/blobs/')).toEqual(blobsBefore);
  });

  it('revalidates after TTL and 304 returns cached without downloads', async () => {
    const { server, cache, setNow } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    const requests = server.blobRequests.length;

    setNow(1_000_000 + 7 * HOUR);
    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('cached');
    expect(server.manifestRequests).toBeGreaterThan(1);
    expect(server.blobRequests.length).toBe(requests);
  });

  it('changed sha downloads only the new blob and keeps the old one', async () => {
    const { server, cache, store, setNow } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    const oldBlob = (await store.list('chord/blobs/'))[0] as string;

    setNow(1_000_000 + 7 * HOUR);
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'D' }] }));
    const result = await cache.ensureChordForSong('KR', '001');

    expect(result.status).toBe('updated');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('D');
    const blobs = await store.list('chord/blobs/');
    expect(blobs).toHaveLength(2);
    expect(blobs).toContain(oldBlob); // file lama tidak ditimpa
  });

  it('network failure keeps cached chord and never touches index', async () => {
    const { server, cache, store, setNow } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');

    setNow(1_000_000 + 7 * HOUR);
    server.networkDown = true;
    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('cached');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('C');

    server.networkDown = false;
    const indexRaw = await store.read(CHORD_INDEX_PATH);
    expect(indexRaw).not.toBeNull();
  });

  it('offline without cache reports offline', async () => {
    const { server, cache } = await setup();
    server.networkDown = true;
    const result = await cache.ensureChordForSong('KR', '999');
    expect(result.status).toBe('offline');
  });

  it('tampered download keeps old chord active', async () => {
    const { server, cache, setNow, fetchImpl } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');

    setNow(1_000_000 + 7 * HOUR);
    // Konten berubah di server, tapi fetch file disabotase agar mengembalikan garbage.
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'D' }] }));
    fetchImpl.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/chords/manifest')) {
        const body = JSON.stringify(await server.buildManifest());
        return new Response(body, { status: 200 });
      }
      return new Response('garbage', { status: 200 });
    });

    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('cached');
    expect(result.reason).toBe('download-invalid');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('C');
  });

  it('negative cache: missing song is not re-fetched within TTL', async () => {
    const { server, cache } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    const r1 = await cache.ensureChordForSong('KR', '999');
    expect(r1.status).toBe('missing');
    const requests = server.manifestRequests;

    const r2 = await cache.ensureChordForSong('KR', '999');
    expect(r2.status).toBe('missing');
    expect(server.manifestRequests).toBe(requests);
  });

  it('negative cache is invalidated when the song appears upstream', async () => {
    const { server, cache, setNow } = await setup();
    await cache.ensureChordForSong('KR', '999');
    expect((await cache.ensureChordForSong('KR', '999')).status).toBe('missing');

    setNow(1_000_000 + 6 * MINUTE);
    server.files.set('KR:999', chordDoc({ 1: [{ noteIdx: 0, chord: 'F' }] }));
    const result = await cache.ensureChordForSong('KR', '999');
    expect(result.status).toBe('updated');
    expect(result.document?.pages['1']?.[0]?.chord).toBe('F');
  });

  it('concurrent ensure for the same song performs one download', async () => {
    const { server, cache } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    const results = await Promise.all([
      cache.ensureChordForSong('KR', '001'),
      cache.ensureChordForSong('KR', '001'),
      cache.ensureChordForSong('KR', '001'),
    ]);
    expect(results.every((r) => r.status === 'updated')).toBe(true);
    expect(server.blobRequests).toHaveLength(1);
  });

  it('resetSong removes the pointer but keeps the blob, then forces re-check', async () => {
    const { server, cache, store } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    const blobsBefore = await store.list('chord/blobs/');
    expect(blobsBefore).toHaveLength(1);

    await cache.resetSong('KR', '001');
    const blobsAfter = await store.list('chord/blobs/');
    expect(blobsAfter).toHaveLength(1);

    const requests = server.blobRequests.length;
    const result = await cache.ensureChordForSong('KR', '001');
    expect(result.status).toBe('updated'); // blob sudah ada -> tidak diunduh ulang
    expect(server.blobRequests.length).toBe(requests);
  });

  it('gc keeps referenced blobs and removes aged unreferenced ones', async () => {
    const { server, cache, store, setNow } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    const oldBlob = (await store.list('chord/blobs/'))[0] as string;

    setNow(1_000_000 + 7 * HOUR);
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'D' }] }));
    await cache.ensureChordForSong('KR', '001');

    // Belum lewat grace period: blob lama masih dipertahankan.
    let gc = await cache.gc();
    expect(gc.removed).toBe(0);
    expect((await store.list('chord/blobs/')).length).toBe(2);

    setNow(1_000_000 + 7 * HOUR + 15 * 24 * HOUR);
    gc = await cache.gc();
    expect(gc.removed).toBe(1);
    const remaining = await store.list('chord/blobs/');
    expect(remaining).not.toContain(oldBlob);
    expect(remaining).toHaveLength(1);
  });

  it('gc evicts only unreferenced blobs when byte cap is exceeded; referenced survive', async () => {
    const { server, cache, store, setNow } = await setup();
    server.files.set('KR:001', chordDoc({ 1: [{ noteIdx: 0, chord: 'C' }] }));
    await cache.ensureChordForSong('KR', '001');
    setNow(1_000_000 + 1 * MINUTE);
    server.files.set('KR:002', chordDoc({ 1: [{ noteIdx: 0, chord: 'D' }] }));
    await cache.ensureChordForSong('KR', '002');
    setNow(1_000_000 + 2 * MINUTE);
    server.files.set('KR:003', chordDoc({ 1: [{ noteIdx: 0, chord: 'E' }] }));
    await cache.ensureChordForSong('KR', '003');

    const before = await store.list('chord/blobs/');
    expect(before.length).toBe(3);

    // Hanya KR:001 yang aktif; blob 002/003 jadi unreferenced.
    await cache.resetSong('KR', '002');
    await cache.resetSong('KR', '003');

    const tiny = new ChordLazyCache({
      store,
      fetchManifest: async () => null,
      maxTotalBytes: 1,
      now: () => 1_000_000,
    });
    const gc = await tiny.gc();
    expect(gc.removed).toBe(2);
    const remaining = await store.list('chord/blobs/');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toContain('/blobs/');
  });
});
