export async function apiFetch<T>(
  path: string,
  options: { signal?: AbortSignal; baseUrl?: string; method?: string; body?: unknown } = {},
): Promise<T> {
  const base = options.baseUrl ?? import.meta.env.VITE_BFF_BASE ?? '/api';
  const res = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 304) throw new ApiError('not-modified', 304);
  if (!res.ok) throw new ApiError(`request failed: ${res.status}`, res.status);
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
