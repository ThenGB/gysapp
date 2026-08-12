import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const distDir = resolve('apps/web/dist');
const html = await readFile(resolve(distDir, 'index.html'), 'utf8');
const refs = new Set();

for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)) refs.add(match[1]);
for (const match of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"[^>]*>/g)) {
  refs.add(match[1]);
}

if (refs.size === 0) throw new Error('No initial JavaScript assets found in dist/index.html');

let total = 0;
const measured = [];
for (const ref of refs) {
  const assetIndex = ref.indexOf('assets/');
  if (assetIndex < 0) throw new Error(`Unexpected initial asset path: ${ref}`);
  const relative = ref.slice(assetIndex);
  const bytes = await readFile(resolve(distDir, relative));
  const gzipBytes = gzipSync(bytes).byteLength;
  total += gzipBytes;
  measured.push({ relative, gzipBytes });
}

const budget = 250 * 1024;
for (const item of measured) {
  console.log(`${item.relative}: ${(item.gzipBytes / 1024).toFixed(1)} KiB gzip`);
}
console.log(`Initial JS total: ${(total / 1024).toFixed(1)} KiB gzip / ${(budget / 1024).toFixed(0)} KiB budget`);

if (total > budget) {
  throw new Error(`Initial JavaScript gzip budget exceeded: ${total} > ${budget} bytes`);
}
