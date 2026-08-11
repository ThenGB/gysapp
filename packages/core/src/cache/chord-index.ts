export interface ChordCacheEntry {
  activeSha256: string;
  path: string;
  size: number;
  lastAccessedAt: number;
}

export interface MissingChordEntry {
  sourceCommit: string;
  checkedAt: number;
}

/**
 * Active pointer cache chord. `index.json` adalah commit point: pembaca hanya
 * melihat chord melalui index, sehingga blob yang belum ter-referensikan tidak
 * pernah tampil dan crash tidak merusak chord aktif.
 */
export interface ChordCacheIndexV1 {
  schemaVersion: 1;
  sourceCommit: string | null;
  manifestSha256: string | null;
  manifestEtag: string | null;
  lastCheckedAt: number | null;
  entries: Record<string, ChordCacheEntry>;
  missing: Record<string, MissingChordEntry>;
}

export const CHORD_INDEX_SCHEMA_VERSION = 1 as const;
export const CHORD_INDEX_PATH = 'chord/index.json';
export const CHORD_BLOBS_PREFIX = 'chord/blobs/';
export const CHORD_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export function emptyChordIndex(): ChordCacheIndexV1 {
  return {
    schemaVersion: CHORD_INDEX_SCHEMA_VERSION,
    sourceCommit: null,
    manifestSha256: null,
    manifestEtag: null,
    lastCheckedAt: null,
    entries: {},
    missing: {},
  };
}

export function blobPathFor(sha256: string): string {
  return `${CHORD_BLOBS_PREFIX}${sha256.slice(0, 2)}/${sha256}.chord.json`;
}

export function chordId(bookCode: string, songNumber: string): string {
  return `${bookCode}:${songNumber}`;
}

export function referencedBlobPaths(index: ChordCacheIndexV1): Set<string> {
  const paths = new Set<string>();
  for (const entry of Object.values(index.entries)) paths.add(entry.path);
  return paths;
}

export function parseChordIndex(input: unknown): ChordCacheIndexV1 {
  if (typeof input !== 'object' || input === null) return emptyChordIndex();
  const raw = input as Partial<ChordCacheIndexV1>;
  if (raw.schemaVersion !== CHORD_INDEX_SCHEMA_VERSION) return emptyChordIndex();
  return {
    schemaVersion: CHORD_INDEX_SCHEMA_VERSION,
    sourceCommit: raw.sourceCommit ?? null,
    manifestSha256: raw.manifestSha256 ?? null,
    manifestEtag: raw.manifestEtag ?? null,
    lastCheckedAt: raw.lastCheckedAt ?? null,
    entries: raw.entries ?? {},
    missing: raw.missing ?? {},
  };
}
