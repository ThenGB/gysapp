// Membangun database SQLite Alkitab TB dari JSON bundel.
// Output: apps/web/public/data/bible/b_tb.db — SATU file menggantikan
// 2.389 file JSON (chapters + pericopes) + search-index.json.
// Tabel: books, bible, pericopes, refs, paralels, chapter_counts, search.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = resolve(repoRoot, 'apps', 'web', 'public', 'data', 'bible', 'b_tb');
const outFile = join(dataDir, 'b_tb.db');

function stripTags(text) {
  return text
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '')
    .replace(/<pb\/?\s*>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SQL = initSqlJs();

const db = new (await SQL).Database();
db.run(`
  CREATE TABLE books (id INTEGER PRIMARY KEY, bs TEXT, bl TEXT, c INTEGER);
  CREATE TABLE bible (id INTEGER PRIMARY KEY, b INTEGER, c INTEGER, v INTEGER, t TEXT, r INTEGER, c1 INTEGER, v1 INTEGER);
  CREATE INDEX bible_b ON bible(b);
  CREATE INDEX bible_bc ON bible(b, c);
  CREATE TABLE pericopes (id INTEGER, s INTEGER, b INTEGER, c INTEGER, v INTEGER, t TEXT);
  CREATE INDEX pericopes_bc ON pericopes(b, c);
  CREATE TABLE refs (bc TEXT, id INTEGER, sv INTEGER, ev INTEGER);
  CREATE INDEX refs_bc ON refs(bc);
  CREATE TABLE paralels (bc TEXT, id INTEGER, id1 INTEGER, id2 INTEGER, t TEXT);
  CREATE INDEX paralels_bc ON paralels(bc);
  CREATE TABLE chapter_counts (b INTEGER, c INTEGER, v INTEGER);
  CREATE INDEX chapter_counts_b ON chapter_counts(b);
  CREATE TABLE search (id INTEGER PRIMARY KEY, t TEXT);
`);

// books + counts + refs + paralels
const books = JSON.parse(await readFile(join(dataDir, 'books.json'), 'utf8'));
const counts = JSON.parse(await readFile(join(dataDir, 'chapter_counts.json'), 'utf8'));
const refs = JSON.parse(await readFile(join(dataDir, 'refs_by_bc.json'), 'utf8'));
const paralels = JSON.parse(await readFile(join(dataDir, 'pericope_paralels_by_bc.json'), 'utf8'));

db.run('BEGIN TRANSACTION');
const insBook = db.prepare('INSERT INTO books VALUES (?,?,?,?)');
for (const b of books) insBook.run([b.id, b.bs, b.bl, b.c]);
insBook.free();

const insCount = db.prepare('INSERT INTO chapter_counts VALUES (?,?,?)');
for (const e of counts) insCount.run([e.b, e.c, e.v]);
insCount.free();

const insRef = db.prepare('INSERT INTO refs VALUES (?,?,?,?)');
for (const [bc, list] of Object.entries(refs)) {
  for (const r of list) insRef.run([bc, r.id, r.sv, r.ev]);
}
insRef.free();

const insPar = db.prepare('INSERT INTO paralels VALUES (?,?,?,?,?)');
for (const [bc, list] of Object.entries(paralels)) {
  for (const p of list) insPar.run([bc, p.id, p.id1, p.id2, p.t]);
}
insPar.free();

// chapters + pericopes + search
const insVerse = db.prepare('INSERT INTO bible VALUES (?,?,?,?,?,?,?,?)');
const insPericope = db.prepare('INSERT INTO pericopes VALUES (?,?,?,?,?,?)');
const insSearch = db.prepare('INSERT INTO search VALUES (?,?)');

const chapterFiles = (await readdir(join(dataDir, 'chapters'))).filter((f) => f.endsWith('.json'));
let verses = 0;
for (const file of chapterFiles) {
  const list = JSON.parse(await readFile(join(dataDir, 'chapters', file), 'utf8'));
  for (const v of list) {
    insVerse.run([v.id, v.b, v.c, v.v, v.t, v.r, v.c1, v.v1]);
    const clean = stripTags(v.t ?? '');
    if (clean) insSearch.run([v.id, clean]);
    verses += 1;
  }
}
insVerse.free();
insSearch.free();

const pericopeFiles = (await readdir(join(dataDir, 'pericopes'))).filter((f) =>
  f.endsWith('.json'),
);
for (const file of pericopeFiles) {
  const list = JSON.parse(await readFile(join(dataDir, 'pericopes', file), 'utf8'));
  for (const p of list) insPericope.run([p.id, p.s, p.b, p.c, p.v, p.t]);
}
insPericope.free();

db.run('COMMIT');
await mkdir(dataDir, { recursive: true });
const data = db.export();
await writeFile(outFile, Buffer.from(data));
db.close();

console.log(
  `[bible-db] ${verses} ayat, ${pericopeFiles.length} perikop -> ${outFile} (${(data.byteLength / 1024 / 1024).toFixed(1)} MB)`,
);
