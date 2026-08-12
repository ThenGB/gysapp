// Menyalin vendor runtime (js-synthesizer + libfluidsynth WASM) dari node_modules
// ke apps/web/public/vendor agar dirender lokal tanpa CDN.
import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const webRoot = resolve(repoRoot, 'apps', 'web');
const synthPkg = resolve(webRoot, 'node_modules', 'js-synthesizer');
const vendor = resolve(webRoot, 'public', 'vendor');

const files = [
  [resolve(synthPkg, 'dist', 'js-synthesizer.min.js'), 'js-synthesizer.min.js'],
  [resolve(synthPkg, 'externals', 'libfluidsynth-2.4.6.js'), 'libfluidsynth-2.4.6.js'],
  [resolve(webRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), 'sql-wasm.wasm'],
];

await mkdir(vendor, { recursive: true });
for (const [src, name] of files) {
  await cp(src, resolve(vendor, name), { force: true });
  console.log(`[vendor] ${name}`);
}
