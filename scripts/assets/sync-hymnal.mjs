// Menyalin katalog Pujian penuh: PDF + MIDI dari checkout gyschordweb,
// index per buku dari GYSAPP-Fork. Nama file disamakan dengan konvensi
// index (spasi -> underscore) agar lookup persis.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const chordRoot = resolve(process.argv[2] ?? join(repoRoot, '..', 'gyschordweb'));
const flutterRoot = resolve(process.argv[3] ?? join(repoRoot, '..', 'church'));
const out = resolve(repoRoot, 'apps', 'web', 'public', 'data', 'hymnal');

const pdfDir = join(chordRoot, 'docs', 'assets', 'pdf');
const midiDir = join(chordRoot, 'docs', 'assets', 'midi');
const indexDir = join(flutterRoot, 'assets', 'data', 'index');

const toIndexName = (name) => name.replace(/ /g, '_');

let pdfCount = 0;
let midiCount = 0;
// gyschordweb hanya menyediakan katalog KR; simpan per folder buku agar
// cocok dengan index (pdfFile = 'pdf/kr/...'). Buku lain (HYMNE/MDR/ASM)
// tidak punya partitur/MIDI di katalog ini -> mode teks dari index.
for (const kind of [
  ['pdf', pdfDir, 'kr'],
  ['midi', midiDir, 'kr'],
]) {
  const [folder, src, book] = kind;
  const dest = join(out, folder, book);
  await mkdir(dest, { recursive: true });
  for (const file of await readdir(src)) {
    if (!file.endsWith('.pdf') && !file.endsWith('.mid')) continue;
    await cp(join(src, file), join(dest, toIndexName(file)), { force: true });
    if (folder === 'pdf') pdfCount += 1;
    else midiCount += 1;
  }
}

await mkdir(join(out, 'index'), { recursive: true });
for (const file of await readdir(indexDir)) {
  if (!file.endsWith('_index.json') && file !== 'master_index.json') continue;
  await cp(join(indexDir, file), join(out, 'index', file), { force: true });
}

// master_index.json memakai path backslash windows — normalisasi.
const masterPath = join(out, 'index', 'master_index.json');
const master = JSON.parse(await readFile(masterPath, 'utf8'));
for (const key of Object.keys(master)) {
  master[key].indexFile = master[key].indexFile.replace(/\\/g, '/');
}
await writeFile(masterPath, JSON.stringify(master, null, 2), 'utf8');

console.log(`[hymnal] pdf=${pdfCount} midi=${midiCount}`);
