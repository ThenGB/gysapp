import {
  parseSauhResult,
  parseTrueVoiceFeed,
  type SauhResult,
  type TrueVoiceFeed,
} from '@gysapp/contracts';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiFetch } from './client';
import { contentSource, fetchStaticContent } from './static-content';

const CACHE_KEY = 'gysapp.content.cache.v1';
const STATIC_STALE_MS = 6 * 60 * 60 * 1000;
const GATEWAY_SAUH_STALE_MS = 5 * 60 * 1000;
const GATEWAY_SUARA_STALE_MS = 10 * 60 * 1000;
const GATEWAY_GC_MS = 30 * 60 * 1000;

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

function fetchedAtMs(data: { fetchedAt: string } | undefined): number {
  if (!data) return 0;
  const timestamp = Date.parse(data.fetchedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function useSauh(date: Date, options?: Partial<UseQueryOptions<SauhResult>>) {
  const dateKey = localDateKey(date);
  const source = contentSource();
  const initialData = useMemo(() => cachedSauh(dateKey) ?? undefined, [dateKey]);
  return useQuery<SauhResult>({
    queryKey: ['sauh', dateKey, source],
    queryFn: async ({ signal }) => {
      try {
        const raw =
          source === 'gateway'
            ? await apiFetch<SauhResult>(`/content/sauh?date=${encodeURIComponent(dateKey)}`, {
                signal,
              })
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
    initialData,
    initialDataUpdatedAt: fetchedAtMs(initialData),
    staleTime: source === 'static' ? STATIC_STALE_MS : GATEWAY_SAUH_STALE_MS,
    gcTime: source === 'static' ? STATIC_STALE_MS : GATEWAY_GC_MS,
    retry: 1,
    ...options,
  });
}

export function useSuaraSejati(options?: Partial<UseQueryOptions<TrueVoiceFeed>>) {
  const source = contentSource();
  const initialData = useMemo(() => cachedSuaraSejati() ?? undefined, []);
  return useQuery<TrueVoiceFeed>({
    queryKey: ['suara-sejati', source],
    queryFn: async ({ signal }) => {
      try {
        const raw =
          source === 'gateway'
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
    initialData,
    initialDataUpdatedAt: fetchedAtMs(initialData),
    staleTime: source === 'static' ? STATIC_STALE_MS : GATEWAY_SUARA_STALE_MS,
    gcTime: source === 'static' ? STATIC_STALE_MS : GATEWAY_GC_MS,
    retry: 1,
    ...options,
  });
}
