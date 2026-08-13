import initSqlJs, { type Database } from 'sql.js';
import type {
  BibleBook,
  BibleChapter,
  BibleParalelsByChapter,
  BiblePericopes,
  BibleRefsByChapter,
  ChapterCounts,
} from '@gysapp/contracts';
import type { BibleIndexEntry, BiblePackCode, BiblePort } from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';
import { biblePackManager } from './bible-pack-manager';

interface SqlitePortState {
  db: Database;
  searchIndex: BibleIndexEntry[];
}

export interface SqliteBiblePortOptions {
  /** Lokasi wasm sql.js; default public/vendor (browser). */
  locateFile?: (file: string) => string;
  code?: BiblePackCode;
}

const LABELS: Record<BiblePackCode, string> = {
  b_tb: 'Terjemahan Baru',
  b_kjv: 'King James Version',
  b_cuv: 'Chinese Union Version',
};

/**
 * BiblePort berbasis SQLite (sql.js WASM). Database diambil dari BiblePackManager,
 * sehingga versi hasil download dapat langsung dipakai tanpa reload aplikasi.
 */
export class SqliteBiblePort implements BiblePort {
  readonly code: BiblePackCode;
  readonly label: string;

  private state: Promise<SqlitePortState> | null = null;
  private catalogPromise: Promise<Awaited<ReturnType<BiblePort['loadCatalog']>>> | null = null;

  constructor(private readonly options: SqliteBiblePortOptions = {}) {
    this.code = options.code ?? 'b_tb';
    this.label = LABELS[this.code];
  }

  invalidate(): void {
    void this.state?.then(({ db }) => db.close()).catch(() => undefined);
    this.state = null;
    this.catalogPromise = null;
  }

  private async init(): Promise<SqlitePortState> {
    if (!this.state) {
      this.state = (async () => {
        const SQL = await initSqlJs({
          locateFile: this.options.locateFile ?? (() => assetUrl('/vendor/sql-wasm.wasm')),
        });
        const bytes = await biblePackManager.databaseBytes(this.code);
        const db = new SQL.Database(bytes);
        const rows = db.exec('SELECT id, t FROM search ORDER BY id');
        const searchIndex: BibleIndexEntry[] = (rows[0]?.values ?? []).map((row) => ({
          id: row[0] as number,
          t: row[1] as string,
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
          (row): BibleBook => ({
            id: row[0] as number,
            bs: row[1] as string,
            bl: row[2] as string,
            c: row[3] as number,
          }),
        );
        const chapterCounts = (
          db.exec('SELECT b, c, v FROM chapter_counts ORDER BY b, c')[0]?.values ?? []
        ).map((row): ChapterCounts[number] => ({
          b: row[0] as number,
          c: row[1] as number,
          v: row[2] as number,
        }));
        const refs: BibleRefsByChapter = {};
        for (const row of db.exec('SELECT bc, id, sv, ev FROM refs')[0]?.values ?? []) {
          const key = String(row[0]);
          (refs[key] ??= []).push({
            id: row[1] as number,
            sv: row[2] as number,
            ev: row[3] as number,
          });
        }
        const paralels: BibleParalelsByChapter = {};
        for (const row of db.exec('SELECT bc, id, id1, id2, t FROM paralels')[0]?.values ?? []) {
          const key = String(row[0]);
          (paralels[key] ??= []).push({
            id: row[1] as number,
            id1: row[2] as number,
            id2: row[3] as number,
            t: row[4] as string,
          });
        }
        return { books, chapterCounts, refs, paralels };
      });
    }
    return this.catalogPromise;
  }

  async loadChapter(bookId: number, chapterId: number): Promise<BibleChapter | null> {
    const { db } = await this.init();
    const result = db.exec(
      'SELECT id, b, c, v, t, r, c1, v1 FROM bible WHERE b = ? AND c = ? ORDER BY v',
      [bookId, chapterId],
    );
    if (!result[0]) return null;
    return result[0].values.map((row) => ({
      id: row[0] as number,
      b: row[1] as number,
      c: row[2] as number,
      v: row[3] as number,
      t: row[4] as string,
      r: (row[5] as number | null) ?? null,
      c1: (row[6] as number | null) ?? null,
      v1: (row[7] as number | null) ?? null,
    })) as BibleChapter;
  }

  async loadPericopes(bookId: number, chapterId: number): Promise<BiblePericopes | null> {
    const { db } = await this.init();
    const result = db.exec('SELECT id, s, b, c, v, t FROM pericopes WHERE b = ? AND c = ?', [
      bookId,
      chapterId,
    ]);
    if (!result[0]) return null;
    return result[0].values.map((row) => ({
      id: row[0] as number,
      s: row[1] as number,
      b: row[2] as number,
      c: row[3] as number,
      v: row[4] as number,
      t: row[5] as string,
    })) as BiblePericopes;
  }

  async getSearchIndex(): Promise<BibleIndexEntry[]> {
    return (await this.init()).searchIndex;
  }
}

const versionPorts = new Map<BiblePackCode, SqliteBiblePort>();

export function getBiblePortForVersion(code: BiblePackCode): SqliteBiblePort {
  let port = versionPorts.get(code);
  if (!port) {
    port = new SqliteBiblePort({ code });
    versionPorts.set(code, port);
  }
  return port;
}

export function invalidateBiblePort(code?: BiblePackCode): void {
  if (code) {
    versionPorts.get(code)?.invalidate();
    return;
  }
  for (const port of versionPorts.values()) port.invalidate();
}

// Compatibility registry for search/tests and adapters that still expect one active port.
let activePort: BiblePort = getBiblePortForVersion('b_tb');

export function setBiblePort(port: BiblePort): void {
  activePort = port;
  // The reader resolves ports by Bible version. Keep the compatibility setter
  // aligned with that registry so injected ports are honored by both paths.
  if (port instanceof SqliteBiblePort) versionPorts.set(port.code, port);
}

export function getBiblePort(): BiblePort {
  return activePort;
}

export const biblePort: BiblePort = activePort;
