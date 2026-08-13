import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedSauh, useSauh } from './content';
import type { SauhResult } from '@gysapp/contracts';

const dateKey = '2026-08-11';
const sauhResult: SauhResult = {
  isToday: true,
  fetchedAt: '2026-08-11T12:00:00.000Z',
  items: [
    {
      slug: 'sbj260811',
      title: 'Konten offline',
      url: 'https://tjc.org/id/sauh/1',
      imageUrl: null,
      excerpt: 'tersimpan',
      publishedAt: null,
    },
  ],
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useSauh offline fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('stores successful response in localStorage cache', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(sauhResult), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSauh(new Date(2026, 7, 11)), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedSauh(dateKey)?.items[0]?.title).toBe('Konten offline');
  });

  it('shows stale cached content immediately while revalidating in the background', async () => {
    localStorage.setItem(
      'gysapp.content.cache.v1',
      JSON.stringify({ sauh: { [dateKey]: sauhResult }, suaraSejati: null }),
    );
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSauh(new Date(2026, 7, 11)), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data?.items[0]?.title).toBe('Konten offline');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.isSuccess).toBe(true);
  });

  it('keeps a fresh static snapshot without another network request', async () => {
    const fresh = { ...sauhResult, fetchedAt: new Date().toISOString() };
    localStorage.setItem(
      'gysapp.content.cache.v1',
      JSON.stringify({ sauh: { [dateKey]: fresh }, suaraSejati: null }),
    );
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSauh(new Date(2026, 7, 11)), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data?.items[0]?.title).toBe('Konten offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
