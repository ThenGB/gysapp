import { parseChordManifest, type ChordManifest } from '@gysapp/contracts';

export interface ManifestFetchResult {
  /** null berarti 304 Not Modified (manifest tidak berubah). */
  manifest: ChordManifest | null;
  etag: string | null;
}

export type ManifestFetcher = (prevEtag: string | null) => Promise<ManifestFetchResult | null>;

export interface HttpManifestFetcherOptions {
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Mengambil manifest via request kondisional (If-None-Match).
 * Endpoint target: BFF /api/chords/manifest (304) atau GitHub Contents API.
 * `null` dikembalikan saat error jaringan — pemanggil harus pakai cache lama.
 */
export function createHttpManifestFetcher(options: HttpManifestFetcherOptions): ManifestFetcher {
  const { url, timeoutMs = 15_000 } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async (prevEtag) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (prevEtag) headers['If-None-Match'] = prevEtag;
      const res = await fetchImpl(url, { headers, signal: controller.signal });
      if (res.status === 304) {
        return { manifest: null, etag: res.headers.get('etag') };
      }
      if (!res.ok) return null;
      const text = await res.text();
      const manifest = parseChordManifest(JSON.parse(text));
      return { manifest, etag: res.headers.get('etag') };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
