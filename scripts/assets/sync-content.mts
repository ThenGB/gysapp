// Snapshot konten online tjc.org -> aset statis web (public/data/content).
// Dipanggil manual atau oleh GitHub Actions (cron); memakai parser BFF yang
// sama (apps/edge) sehingga kontrak parser teruji dan output konsisten.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrueVoiceFeed } from '../../packages/contracts/src/index.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = resolve(repoRoot, 'apps', 'web', 'public', 'data', 'content');

const TJC_WP_POSTS = 'https://tjc.org/id/wp-json/wp/v2/posts';
const TJC_SUARA_SEJATI = 'https://tjc.org/id/suarasejati/';
const TJC_LITERATUR = 'https://tjc.org/id/literatur/';
const TJC_WARTA = 'https://tjc.org/id/literatur/warta-sejati/';
const KESAKSIAN_SELECTOR = '#posts-table-1 > tbody > tr > td > a';
const RENUNGAN_SELECTOR = '#posts-table-3 > tbody > tr > td > a';

// Impor parser edge (TS) via tsx.
const edge = await import('../../apps/edge/src/content/suara-sejati.ts');
const sauh = await import('../../apps/edge/src/content/sauh.ts');
const literature = await import('../../apps/edge/src/content/literature.ts');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'gysapp-content-sync/0.1' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const now = new Date().toISOString();
  const report: Record<string, number> = {};

  // Sauh (slug hari ini diprioritaskan; fallback feed 6).
  {
    const url = new URL(TJC_WP_POSTS);
    url.searchParams.set('categories', '229');
    url.searchParams.set('per_page', '6');
    url.searchParams.set('orderby', 'date');
    url.searchParams.set('_embed', 'wp:featuredmedia');
    const posts = (await fetchText(url.toString()).then((t) => JSON.parse(t))) as unknown[];
    const result = sauh.normalizeSauhPosts(posts, new Date());
    await writeFile(join(outDir, 'sauh.json'), JSON.stringify({ ...result, fetchedAt: now }), 'utf8');
    report.sauh = result.items.length;
  }

  // Suara Sejati + Warta (selector .grid4 article).
  {
    const items = edge.parseSuaraSejatiPage(await fetchText(TJC_SUARA_SEJATI));
    await writeFile(join(outDir, 'suara-sejati.json'), JSON.stringify(parseTrueVoiceFeed({ items, fetchedAt: now })), 'utf8');
    report['suara-sejati'] = items.length;
  }
  {
    const items = edge.parseSuaraSejatiPage(await fetchText(TJC_WARTA));
    await writeFile(join(outDir, 'warta.json'), JSON.stringify(parseTrueVoiceFeed({ items, fetchedAt: now })), 'utf8');
    report.warta = items.length;
  }

  // Kesaksian + Renungan (tabel literatur).
  {
    const html = await fetchText(TJC_LITERATUR);
    const kesaksian = literature.parseTableLinks(html, KESAKSIAN_SELECTOR);
    await writeFile(join(outDir, 'kesaksian.json'), JSON.stringify(parseTrueVoiceFeed({ items: kesaksian, fetchedAt: now })), 'utf8');
    report.kesaksian = kesaksian.length;
    const renungan = literature.parseTableLinks(html, RENUNGAN_SELECTOR);
    await writeFile(join(outDir, 'renungan.json'), JSON.stringify(parseTrueVoiceFeed({ items: renungan, fetchedAt: now })), 'utf8');
    report.renungan = renungan.length;
  }

  console.log('[content-sync]', JSON.stringify(report));
  console.log(`[content-sync] target=${outDir}`);
}

main().catch((err) => {
  console.error('[content-sync] failed:', err?.message ?? err);
  process.exit(1);
});
