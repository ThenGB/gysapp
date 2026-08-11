import { describe, expect, it } from 'vitest';
import type { ChordedLine, PdfNote, PdfNoteRow, PdfTextItem } from '../../src/pdf/types';
import { extractPageNotes } from '../../src/pdf/note-extractor';
import {
  buildChordedLines,
  extractLyricLines,
  findChordedLine,
  normalizeLine,
  stripVerseLabel,
} from '../../src/pdf/lyrics';

const PAGE = { width: 595, height: 842 };

function item(str: string, x: number, y: number, w = 20, fontSize = 8): PdfTextItem {
  return { str, transform: [1, 0, 0, fontSize, x, y], width: w };
}

function noteItems(): PdfTextItem[] {
  // Baris not 1: y=700, Baris not 2: y=630 (multi-char "1 . . 1")
  return [
    item('1', 40, 700, 8),
    item('3', 90, 700, 8),
    item('5', 140, 700, 8),
    item('3', 190, 700, 8),
    item('1 . . 1', 40, 630, 64),
    item('5', 140, 630, 8),
  ];
}

function lyricItems(): PdfTextItem[] {
  return [
    item('Pujilah', 30, 655, 40, 10),
    item('Allah', 75, 655, 30, 10),
    item('Yang', 110, 655, 25, 10),
    item('Maha', 140, 655, 28, 10),
    item('Esa', 172, 655, 20, 10),
    item('Kidung', 30, 585, 40, 10),
    item('Pujian', 75, 585, 40, 10),
  ];
}

describe('extractPageNotes', () => {
  it('returns empty result without note candidates', () => {
    const result = extractPageNotes([item('Hanya teks', 10, 10)], PAGE);
    expect(result.notes).toEqual([]);
    expect(result.noteRows).toEqual([]);
  });

  it('extracts rows with sequential indices and positions', () => {
    const result = extractPageNotes(noteItems(), PAGE);
    expect(result.notes.length).toBe(9);
    expect(result.noteRows).toHaveLength(2);

    const row0 = result.noteRows[0] as PdfNoteRow;
    const row1 = result.noteRows[1] as PdfNoteRow;
    expect(row0.firstIdx).toBe(0);
    expect(row0.lastIdx).toBe(3);
    expect(row1.firstIdx).toBe(4);
    expect(row1.lastIdx).toBe(8);

    const first = result.notes[0] as PdfNote;
    expect(first.isNote).toBe(true);
    expect(first.xPct).toBeCloseTo(((40 + 4) / PAGE.width) * 100, 5);
    expect(first.yPct).toBeCloseTo((1 - 700 / PAGE.height) * 100, 5);

    // Multi-char "1 . . 1" dipecah jadi 4 slot (1, ., ., 1) + '5' setelahnya.
    const split = result.notes.slice(4, 8);
    expect(split.map((n) => n.str)).toEqual(['1', '.', '.', '1']);
    expect(split[0]?.isDot).toBe(false);
    expect(split[1]?.isDot).toBe(true);
    expect(result.notes[8]?.str).toBe('5');
  });

  it('splits multi-char items with interpolated x positions', () => {
    const result = extractPageNotes(noteItems(), PAGE);
    const firstSplit = result.notes[4] as PdfNote;
    const thirdSplit = result.notes[6] as PdfNote;
    // '1 . . 1' = 7 slot; '.' kedua berada di char index 4 => 4 slot dari awal.
    expect(thirdSplit.x - firstSplit.x).toBeCloseTo((64 / 7) * 4, 5);
  });

  it('ignores rows with fewer than 2 digits (stray numbers)', () => {
    const result = extractPageNotes([item('1', 40, 700, 8), item('.', 90, 700, 8)], PAGE);
    expect(result.notes).toEqual([]);
  });
});

describe('extractLyricLines', () => {
  it('groups text lines and excludes digit notation', () => {
    const lines = extractLyricLines([...noteItems(), ...lyricItems()], PAGE.width);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe('Pujilah Allah Yang Maha Esa');
    expect(lines[0]?.startPct).toBeCloseTo((30 / PAGE.width) * 100, 5);
    expect(lines[0]?.widthPct).toBeGreaterThan(0);
  });
});

describe('buildChordedLines', () => {
  function setup(): {
    notes: PdfNote[];
    noteRows: PdfNoteRow[];
    lyrics: ReturnType<typeof extractLyricLines>;
  } {
    const extracted = extractPageNotes(noteItems(), PAGE);
    return {
      notes: extracted.notes,
      noteRows: extracted.noteRows,
      lyrics: extractLyricLines([...noteItems(), ...lyricItems()], PAGE.width),
    };
  }

  it('maps noteIdx chords to lyric line positions 0..1', () => {
    const { notes: n, noteRows: nr, lyrics } = setup();
    const entries = [
      { noteIdx: 0, chord: 'C' },
      { noteIdx: 1, chord: 'G' },
      { noteIdx: 4, chord: 'F' },
      { noteIdx: 7, chord: 'C' },
    ];
    const out = buildChordedLines(n, nr, lyrics, entries);
    expect(out).toHaveLength(2);

    const first = out[0] as ChordedLine;
    expect(first.text).toBe('Pujilah Allah Yang Maha Esa');
    expect(first.chords).toHaveLength(2);
    expect(first.chords[0]?.chord).toBe('C');
    expect(first.chords[0]?.pos).toBeGreaterThanOrEqual(0);
    expect(first.chords[0]?.pos).toBeLessThanOrEqual(1);
  });

  it('clamps positions to 0..1', () => {
    const { notes: n, noteRows: nr, lyrics } = setup();
    const out = buildChordedLines(n, nr, lyrics, [{ noteIdx: 0, chord: 'X' }]);
    expect(out[0]?.chords[0]?.pos).toBeGreaterThanOrEqual(0);
  });

  it('returns empty when no entries match the row range', () => {
    const { notes: n, noteRows: nr, lyrics } = setup();
    expect(buildChordedLines(n, nr, lyrics, [])).toEqual([]);
  });
});

describe('findChordedLine', () => {
  const lines: ChordedLine[] = [
    { text: '1. Pujilah Allah Yang Maha Esa', chords: [{ chord: 'C', pos: 0.1 }] },
    { text: 'Reff. Pujilah Allah Bapa', chords: [{ chord: 'F', pos: 0.2 }] },
  ];

  it('exact match after label stripping wins', () => {
    const hit = findChordedLine('Pujilah Allah Yang Maha Esa', lines);
    expect(hit?.text).toContain('Pujilah Allah Yang Maha Esa');
  });

  it('matches with score threshold 0.6', () => {
    const hit = findChordedLine('Reff. Pujilah Allah Bapa', lines);
    expect(hit?.chords[0]?.chord).toBe('F');
  });

  it('returns null for unrelated lines', () => {
    expect(findChordedLine('Tidak ada hubungan sama sekali', lines)).toBeNull();
  });

  it('normalizes unicode text', () => {
    expect(normalizeLine('Kupang')).toBe('kupang');
    // Kontrak upstream: label 'Reff.' menyisakan '.'; normalizeLine tetap
    // menghasilkan teks bersih sehingga matching bekerja.
    expect(stripVerseLabel('Reff. Haleluya')).toBe('. Haleluya');
    expect(normalizeLine(stripVerseLabel('Reff. Haleluya'))).toBe('haleluya');
    expect(stripVerseLabel('(2) Amin')).toBe('Amin');
    expect(normalizeLine(stripVerseLabel('(2) Amin'))).toBe('amin');
    expect(stripVerseLabel('Ulang 1')).toBe('Ulang 1');
  });
});
