import { assetUrl } from '../lib/asset-url';

/** Sumber konten: gateway bila dikonfigurasi, selain itu snapshot statis. */
export function contentSource(): 'gateway' | 'static' {
  return import.meta.env.VITE_CONTENT_GATEWAY_BASE ? 'gateway' : 'static';
}

export async function fetchStaticContent<T>(file: string): Promise<T> {
  const res = await fetch(assetUrl(`/data/content/${file}.json`));
  if (!res.ok) throw new Error(`content ${file} -> ${res.status}`);
  return (await res.json()) as T;
}
