import { assetUrl } from '../lib/asset-url';

/** Sumber konten: BFF bila dikonfigurasi (VITE_BFF_BASE), else snapshot statis. */
export function contentSource(): 'bff' | 'static' {
  return import.meta.env.VITE_BFF_BASE ? 'bff' : 'static';
}

export async function fetchStaticContent<T>(file: string): Promise<T> {
  const res = await fetch(assetUrl(`/data/content/${file}.json`));
  if (!res.ok) throw new Error(`content ${file} -> ${res.status}`);
  return (await res.json()) as T;
}
