import { parseSauhResult, parseTrueVoiceFeed, type SauhResult, type TrueVoiceFeed } from '@gysapp/contracts';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiFetch } from './client';
import { contentSource, fetchStaticContent } from './static-content';

const CACHE_KEY = 'gysapp.content.cache.v1';

interface ContentCache {
  sauh: Record<string, SauhResult>;
  suaraSejati: TrueVoiceFeed | null;
}

function readCache(): ContentCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { sauh: {}, suaraSejati: null };
    return JSON.parse(raw) as ContentCache;
  } catch {
    return { sauh: {}, suaraSejati: null };
  }
}

function writeCache(mutate: (cache: ContentCache) => void): void {
  try {
    const cache = readCache();
    mutate(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage penuh/tidak tersedia: offline fallback hilang, bukan crash.
  }
}

export function cachedSauh(dateKey: string): SauhResult | null {
  return readCache().sauh[dateKey] ?? null;
}

export function cachedSuaraSejati(): TrueVoiceFeed | null {
  return readCache().suaraSejati;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useSauh(date: Date, options?: Partial<UseQueryOptions<SauhResult>>) {
  const dateKey = localDateKey(date);
  return useQuery<SauhResult>({
    queryKey: ['sauh', dateKey, contentSource()],
    queryFn: async ({ signal }) => {
      try {
        const raw = contentSource() === 'bff'
          ? await apiFetch<SauhResult>(`/content/sauh?date=${encodeURIComponent(dateKey)}`, { signal })
          : await fetchStaticContent<SauhResult>('sauh');
        const result = parseSauhResult(raw);
        writeCache((cache) => {
          cache.sauh[dateKey] = result;
        });
        return result;
      } catch (err) {
        const stale = cachedSauh(dateKey);
        if (stale) return stale;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    ...options,
  });
}

export function useSuaraSejati(options?: Partial<UseQueryOptions<TrueVoiceFeed>>) {
  return useQuery<TrueVoiceFeed>({
    queryKey: ['suara-sejati', contentSource()],
    queryFn: async ({ signal }) => {
      try {
        const raw = contentSource() === 'bff'
          ? await apiFetch<TrueVoiceFeed>('/content/suara-sejati', { signal })
          : await fetchStaticContent<TrueVoiceFeed>('suara-sejati');
        const result = parseTrueVoiceFeed(raw);
        writeCache((cache) => {
          cache.suaraSejati = result;
        });
        return result;
      } catch (err) {
        const stale = cachedSuaraSejati();
        if (stale) return stale;
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    ...options,
  });
}
