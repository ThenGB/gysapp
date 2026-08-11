import { describe, expect, it } from 'vitest';
import {
  NOTE_IDX_INTRO,
  NOTE_IDX_OUTRO,
  isPerRowSentinel,
  isRowEndSentinel,
  isRowStartSentinel,
  isValidChordDocument,
  parseChordDocument,
} from '../src/chord-document';
import { parseChordManifest } from '../src/chord-manifest';

describe('chord-document v2 schema', () => {
  const valid = { version: 2, type: 'note-aligned', pages: { '1': [{ noteIdx: 0, chord: 'C' }] } };

  it('accepts valid note-aligned documents', () => {
    expect(isValidChordDocument(valid)).toBe(true);
    expect(parseChordDocument(valid).pages['1']?.[0]?.chord).toBe('C');
  });

  it('rejects wrong version or type', () => {
    expect(isValidChordDocument({ ...valid, version: 1 })).toBe(false);
    expect(isValidChordDocument({ ...valid, type: 'grid' })).toBe(false);
  });

  it('rejects empty chords and non-integer noteIdx', () => {
    expect(isValidChordDocument({ ...valid, pages: { '1': [{ noteIdx: 0, chord: '  ' }] } })).toBe(
      false,
    );
    expect(isValidChordDocument({ ...valid, pages: { '1': [{ noteIdx: 0.5, chord: 'C' }] } })).toBe(
      false,
    );
  });

  it('recognizes sentinel noteIdx values', () => {
    expect(NOTE_IDX_INTRO).toBe(-1);
    expect(NOTE_IDX_OUTRO).toBe(99999);
    expect(isRowStartSentinel(-2_000_000)).toBe(true);
    expect(isRowEndSentinel(2_000_000)).toBe(true);
    expect(isPerRowSentinel(-2_000_000)).toBe(true);
    expect(isPerRowSentinel(0)).toBe(false);
  });
});

describe('chord-manifest schema', () => {
  it('rejects invalid sha256 and ids', () => {
    expect(() =>
      parseChordManifest({
        schemaVersion: 1,
        sourceCommit: 'b2da4ae5353e082defe857454950b445a9bffcea',
        files: [
          {
            id: 'KR:001',
            bookCode: 'KR',
            songNumber: '001',
            title: 'x',
            path: 'p',
            formatVersion: 2,
            size: 1,
            sha256: 'zz',
          },
        ],
      }),
    ).toThrow();
  });
});
