// Membangun index pencarian Alkitab dari data JSON bundel (TB).
// Output: apps/web/public/data/bible/search-index.json — array {id, t} flat.
// Teks dibersihkan tag <pb/>/<f> dan teks asli dipertahankan.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const chaptersDir = resolve(repoRoot, 'apps', 'web', 'public', 'data', 'bible', 'b_tb', 'chapters');
const outDir = resolve(repoRoot, 'apps', 'web', 'public', 'data', 'bible');
const outFile = join(outDir, 'search-index.json');

function stripTags(text) {
  return text
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '')
    .replace(/<pb\/?\s*>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = (await readdir(chaptersDir)).filter((f) => f.endsWith('.json'));
const entries = [];
for (const file of files) {
  const verses = JSON.parse(await readFile(join(chaptersDir, file), 'utf8'));
  for (const verse of verses) {
    entries.push({ id: verse.id, t: stripTags(verse.t ?? '') });
  }
}
entries.sort((a, b) => a.id - b.id);
await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(entries), 'utf8');
console.log(
  `[bible-index] ${entries.length} ayat -> ${outFile} (${((entries.length * 60) / 1024 / 1024).toFixed(2)} MB est.)`,
);
