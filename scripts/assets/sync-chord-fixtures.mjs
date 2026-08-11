// Menyalin fixture chord dari checkout lokal gyschordweb ke tests/fixtures/chords.
//
// Penggunaan:
//   node scripts/assets/sync-chord-fixtures.mjs <path-to-gyschordweb-checkout>
//   node scripts/assets/sync-chord-fixtures.mjs --remote
//
// Kontrak: manifest (assets-chord-manifest.json), daftar file (assets-chord-list.json),
// dan semua *.chord.json. Mencatat sourceCommit agar test tahu persis versi data.
// Mode --remote mengambil manifest dari commit yang dipin (PINS) dan file dari
// sourceCommit manifest, sehingga fixtures selalu mencerminkan versi produksi.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Pin commit referensi produksi gyschordweb (lihat docs/parity-matrix.md).
const PINNED_MANIFEST_COMMIT = 'cbc7d386c9afed3f2e24549b13cefc0201408a94';
const RAW_BASE = 'https://raw.githubusercontent.com/gyspnk/gyschordweb';
const MANIFEST_REL = 'docs/assets-chord-manifest.json';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  const remoteMode = process.argv[2] === '--remote';
  const sourceRoot = remoteMode
    ? null
    : resolve(process.argv[2] ?? join(repoRoot, '..', 'gyschordweb'));
  const docsDir = sourceRoot ? join(sourceRoot, 'docs') : null;
  const targetDir = join(repoRoot, 'tests', 'fixtures', 'chords');

  let manifest;
  if (remoteMode) {
    manifest = JSON.parse(await fetchText(`${RAW_BASE}/${PINNED_MANIFEST_COMMIT}/${MANIFEST_REL}`));
  } else {
    manifest = JSON.parse(await readFile(join(docsDir, MANIFEST_REL), 'utf8'));
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  }

  await mkdir(targetDir, { recursive: true });
  const copied = [];

  const topLevel = [
    'assets-chord-manifest.json',
    'assets-chord-list.json',
    'assets-list.json',
    'chord-sources.json',
  ];
  for (const name of topLevel) {
    const ok = remoteMode
      ? (await writeFile(
          join(targetDir, name),
          await fetchText(`${RAW_BASE}/${PINNED_MANIFEST_COMMIT}/docs/${name}`),
        ),
        true)
      : await copyFileIfExists(join(docsDir, name), join(targetDir, name));
    if (ok) copied.push(name);
  }

  const chordDir = join(targetDir, 'files');
  await mkdir(chordDir, { recursive: true });
  for (const entry of manifest.files) {
    const name = entry.path.split('/').pop();
    const dest = join(chordDir, `${entry.id.replace(':', '_')}__${name}`);
    let ok = false;
    if (remoteMode) {
      const body = await fetchText(`${RAW_BASE}/${manifest.sourceCommit}/${entry.path}`);
      await writeFile(dest, body);
      ok = true;
    } else {
      ok = await copyFileIfExists(join(sourceRoot, entry.path), dest);
    }
    if (ok) copied.push(entry.path);
    else console.warn(`[fixtures] MISSING ${entry.path}`);
  }

  const fixtureMeta = {
    schemaVersion: 1,
    pinnedManifestCommit: PINNED_MANIFEST_COMMIT,
    sourceCommit: manifest.sourceCommit,
    fileCount: manifest.files.length,
    copiedCount: copied.length - topLevel.length,
  };
  await writeFile(
    join(targetDir, 'fixture-meta.json'),
    JSON.stringify(fixtureMeta, null, 2) + '\n',
    'utf8',
  );

  console.log(
    `[fixtures] remote=${remoteMode} pinned=${PINNED_MANIFEST_COMMIT.slice(0, 7)} sourceCommit=${manifest.sourceCommit} files=${manifest.files.length} copied=${copied.length - topLevel.length}`,
  );
  console.log(`[fixtures] target=${relative(repoRoot, targetDir)}`);
}

async function copyFileIfExists(src, dest) {
  try {
    await cp(src, dest, { force: true });
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error('[fixtures] failed:', err.message);
  process.exit(1);
});
