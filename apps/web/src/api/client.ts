export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Klien HTTP tipis untuk BFF. Base URL default `/api` (same-origin di
 * produksi; Vite dev proxy meneruskan ke edge).
 */
export async function apiFetch<T>(
  path: string,
  options: { signal?: AbortSignal; baseUrl?: string } = {},
): Promise<T> {
  const base = options.baseUrl ?? import.meta.env.VITE_BFF_BASE ?? '/api';
  const res = await fetch(`${base}${path}`, { signal: options.signal });
  if (res.status === 304) throw new ApiError('not-modified', 304);
  if (!res.ok) throw new ApiError(`request failed: ${res.status}`, res.status);
  return (await res.json()) as T;
}
