/**
 * URL aset absolut dengan base path deploy (GH Pages subpath).
 * Contoh: '/assets/midi/KR001.mid' -> '/GYSApp/assets/midi/KR001.mid'.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}
