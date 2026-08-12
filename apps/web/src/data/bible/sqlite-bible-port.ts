import initSqlJs, { type Database } from 'sql.js';
import type {
  BibleBook,
  BibleChapter,
  BibleParalelsByChapter,
  BiblePericopes,
  BibleRefsByChapter,
  ChapterCounts,
} from '@gysapp/contracts';
import type { BiblePort } from '@gysapp/core';
import type { BibleIndexEntry } from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';

const DB_URL = '/data/bible/b_tb/b_tb.db';

interface SqlitePortState {
  db: Database;
  searchIndex: BibleIndexEntry[];
}

export interface SqliteBiblePortOptions {
  /** Lokasi wasm sql.js; default public/vendor (browser). */
  locateFile?: (file: string) => string;
}

/**
 * BiblePort berbasis SQLite (sql.js WASM): SATU file DB menggantikan
 * 2.389 file JSON. Pencarian memakai tabel `search` (31.172 ayat) yang
 * di-cache di memori setelah inisialisasi.
 */
export class SqliteBiblePort implements BiblePort {
  readonly code = 'b_tb';
  readonly label = 'Terjemahan Baru';

  private state: Promise<SqlitePortState> | null = null;
  private catalogPromise: Promise<Awaited<ReturnType<BiblePort['loadCatalog']>>> | null = null;

  constructor(private readonly options: SqliteBiblePortOptions = {}) {}

  private async init(): Promise<SqlitePortState> {
    if (!this.state) {
      this.state = (async () => {
        const SQL = await initSqlJs({
          // Nama file apa pun (sql-wasm.wasm / sql-wasm-browser.wasm) diarahkan
          // ke vendor lokal — nol CDN.
          locateFile: this.options.locateFile ?? (() => assetUrl('/vendor/sql-wasm.wasm')),
        });
        const res = await fetch(assetUrl(DB_URL));
        if (!res.ok) throw new Error(`bible db fetch failed: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));
        const rows = db.exec('SELECT id, t FROM search ORDER BY id');
        const searchIndex: BibleIndexEntry[] = (rows[0]?.values ?? []).map((r) => ({
          id: r[0] as number,
          t: r[1] as string,
        }));
        return { db, searchIndex };
      })();
    }
    return this.state;
  }

  loadCatalog(): Promise<Awaited<ReturnType<BiblePort['loadCatalog']>>> {
    if (!this.catalogPromise) {
      this.catalogPromise = this.init().then(({ db }) => {
        const books = (db.exec('SELECT id, bs, bl, c FROM books ORDER BY id')[0]?.values ?? []).map(
          (r): BibleBook => ({
            id: r[0] as number,
            bs: r[1] as string,
            bl: r[2] as string,
            c: r[3] as number,
          }),
        );
        const chapterCounts = (
          db.exec('SELECT b, c, v FROM chapter_counts ORDER BY b, c')[0]?.values ?? []
        ).map((r): ChapterCounts[number] => ({
          b: r[0] as number,
          c: r[1] as number,
          v: r[2] as number,
        }));
        const refs: BibleRefsByChapter = {};
        for (const r of db.exec('SELECT bc, id, sv, ev FROM refs')[0]?.values ?? []) {
          const key = String(r[0]);
          (refs[key] ??= []).push({ id: r[1] as number, sv: r[2] as number, ev: r[3] as number });
        }
        const paralels: BibleParalelsByChapter = {};
        for (const r of db.exec('SELECT bc, id, id1, id2, t FROM paralels')[0]?.values ?? []) {
          const key = String(r[0]);
          (paralels[key] ??= []).push({
            id: r[1] as number,
            id1: r[2] as number,
            id2: r[3] as number,
            t: r[4] as string,
          });
        }
        return { books, chapterCounts, refs, paralels };
      });
    }
    return this.catalogPromise;
  }

  async loadChapter(bookId: number, chapterId: number): Promise<BibleChapter | null> {
    const { db } = await this.init();
    const res = db.exec(
      'SELECT id, b, c, v, t, r, c1, v1 FROM bible WHERE b = ? AND c = ? ORDER BY v',
      [bookId, chapterId],
    );
    if (!res[0]) return null;
    return res[0].values.map((r) => ({
      id: r[0] as number,
      b: r[1] as number,
      c: r[2] as number,
      v: r[3] as number,
      t: r[4] as string,
      r: (r[5] as number | null) ?? null,
      c1: (r[6] as number | null) ?? null,
      v1: (r[7] as number | null) ?? null,
    })) as BibleChapter;
  }

  async loadPericopes(bookId: number, chapterId: number): Promise<BiblePericopes | null> {
    const { db } = await this.init();
    const res = db.exec('SELECT id, s, b, c, v, t FROM pericopes WHERE b = ? AND c = ?', [
      bookId,
      chapterId,
    ]);
    if (!res[0]) return null;
    return res[0].values.map((r) => ({
      id: r[0] as number,
      s: r[1] as number,
      b: r[2] as number,
      c: r[3] as number,
      v: r[4] as number,
      t: r[5] as string,
    })) as BiblePericopes;
  }

  async getSearchIndex(): Promise<BibleIndexEntry[]> {
    const { searchIndex } = await this.init();
    return searchIndex;
  }
}

// Registry port: default sql.js (browser); test dapat menyuntikkan instance
// dengan locateFile khusus (path fs untuk node/vitest).
let activePort: BiblePort = new SqliteBiblePort();

export function setBiblePort(port: BiblePort): void {
  activePort = port;
}

export function getBiblePort(): BiblePort {
  return activePort;
}

export const biblePort: BiblePort = activePort;
