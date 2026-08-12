import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbBlobStore } from './blob-stores/indexeddb';
import { OfflineMediaCache } from './offline-media-cache';

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe('OfflineMediaCache', () => {
  let store: IndexedDbBlobStore;

  beforeEach(() => {
    store = new IndexedDbBlobStore(`test-media-${Math.random().toString(36).slice(2)}`);
  });

  it('downloads once and serves the same media offline across cache instances', async () => {
    const fetchImpl = vi.fn(async () => new Response(bytes('midi-data'), { status: 200 }));
    const first = new OfflineMediaCache({ store, fetchImpl: fetchImpl as typeof fetch });

    expect(new TextDecoder().decode(await first.getOrFetch('/001.mid', 'midi'))).toBe('midi-data');
    expect(fetchImpl).toHaveBeenCalledOnce();

    const offlineFetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const second = new OfflineMediaCache({ store, fetchImpl: offlineFetch as typeof fetch });

    expect(new TextDecoder().decode(await second.getOrFetch('/001.mid', 'midi'))).toBe('midi-data');
    expect(offlineFetch).not.toHaveBeenCalled();
  });

  it('pins the soundfont and evicts least-recently-used MIDI/PDF data over budget', async () => {
    let clock = 1;
    const cache = new OfflineMediaCache({
      store,
      maxBytes: 12,
      now: () => clock++,
    });

    await cache.put('/soundfont.sf2', 'soundfont', bytes('123456'));
    await cache.put('/old.mid', 'midi', bytes('1234'));
    await cache.put('/new.pdf', 'pdf', bytes('12345'));

    expect(await cache.get('/soundfont.sf2', 'soundfont')).not.toBeNull();
    expect(await cache.get('/old.mid', 'midi')).toBeNull();
    expect(await cache.get('/new.pdf', 'pdf')).not.toBeNull();

    const stats = await cache.stats();
    expect(stats.sizeBytes).toBe(11);
    expect(stats.byKind.soundfont.count).toBe(1);
    expect(stats.byKind.midi.count).toBe(0);
    expect(stats.byKind.pdf.count).toBe(1);
  });

  it('uses access time for LRU eviction', async () => {
    let clock = 1;
    const cache = new OfflineMediaCache({
      store,
      maxBytes: 8,
      now: () => clock++,
    });

    await cache.put('/a.mid', 'midi', bytes('aaaa'));
    await cache.put('/b.mid', 'midi', bytes('bbbb'));
    expect(await cache.get('/a.mid', 'midi')).not.toBeNull();
    await cache.put('/c.mid', 'midi', bytes('cccc'));

    expect(await cache.get('/a.mid', 'midi')).not.toBeNull();
    expect(await cache.get('/b.mid', 'midi')).toBeNull();
    expect(await cache.get('/c.mid', 'midi')).not.toBeNull();
  });

  it('clears only media entries from its store', async () => {
    const cache = new OfflineMediaCache({ store });
    await store.write('unrelated/keep', bytes('keep'));
    await cache.put('/001.mid', 'midi', bytes('midi'));
    await cache.put('/001.pdf', 'pdf', bytes('pdf'));

    await cache.clear();

    expect(await cache.stats()).toMatchObject({ count: 0, sizeBytes: 0 });
    expect(await cache.get('/001.mid', 'midi')).toBeNull();
    expect(new TextDecoder().decode((await store.read('unrelated/keep')) ?? new Uint8Array())).toBe(
      'keep',
    );
  });
});
