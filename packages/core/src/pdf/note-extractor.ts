import type {
  NoteExtractionResult,
  PdfNote,
  PdfNoteRow,
  PdfPageMetrics,
  PdfTextItem,
} from './types';

const NOTE_CHAR_PATTERN = /^[0-7.\s]+$/;
const SINGLE_NOTE_PATTERN = /^[0-7.]$/;
const DIGIT_PATTERN = /^[1-7]$/;
const Y_TOLERANCE = 2.0;
const FONT_SIZE_TOLERANCE = 1.5;

interface RawItem {
  str: string;
  x: number;
  y: number;
  w: number;
  fontSize: number;
}

/**
 * Port dari gyschordweb `extractPageNotes` (viewer-core.js): ekstrak not
 * musik dari text layer PDF via heuristik dominant font size + grouping baris.
 * Murni — pdf.js hanya penyedia PdfTextItem[].
 */
export function extractPageNotes(
  textContent: PdfTextItem[],
  metrics: PdfPageMetrics,
): NoteExtractionResult {
  const { width: pageWidth, height: pageHeight } = metrics;
  const items: RawItem[] = textContent
    .map((item) => ({
      str: item.str.trim(),
      x: item.transform[4] as number,
      y: item.transform[5] as number,
      w: item.width,
      fontSize: Math.abs(item.transform[3] as number),
    }))
    .filter((item) => item.str.length > 0);

  const candidateItems = items.filter(
    (item) => NOTE_CHAR_PATTERN.test(item.str) && /[1-7]/.test(item.str),
  );
  if (candidateItems.length === 0) return { notes: [], noteRows: [], pageWidth, pageHeight };

  const fontSizeCounts = new Map<number, number>();
  for (const item of candidateItems) {
    const key = Math.round(item.fontSize * 10) / 10;
    fontSizeCounts.set(key, (fontSizeCounts.get(key) ?? 0) + 1);
  }
  const dominantFontSize = [...fontSizeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const rawNoteItems = items.filter(
    (item) =>
      NOTE_CHAR_PATTERN.test(item.str) &&
      Math.abs(item.fontSize - dominantFontSize) < FONT_SIZE_TOLERANCE,
  );

  const noteItems: RawItem[] = [];
  for (const item of rawNoteItems) {
    if (SINGLE_NOTE_PATTERN.test(item.str)) {
      noteItems.push(item);
      continue;
    }
    const chars = item.str.split('');
    const totalChars = chars.length;
    if (totalChars <= 1) {
      noteItems.push(item);
      continue;
    }
    const slotWidth = item.w / totalChars;
    for (let i = 0; i < totalChars; i++) {
      const ch = chars[i] as string;
      if (/[0-7.]/.test(ch)) {
        noteItems.push({
          str: ch,
          x: item.x + i * slotWidth,
          y: item.y,
          w: slotWidth,
          fontSize: item.fontSize,
        });
      }
    }
  }

  const sorted = [...noteItems].sort((a, b) => b.y - a.y);
  const rows: Array<{ y: number; items: RawItem[] }> = [];
  for (const item of sorted) {
    const existing = rows.find((r) => Math.abs(r.y - item.y) < Y_TOLERANCE);
    if (existing) existing.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  const musicRows = rows.filter(
    (row) => row.items.filter((i) => DIGIT_PATTERN.test(i.str)).length >= 2,
  );

  const notes: PdfNote[] = [];
  const noteRows: PdfNoteRow[] = [];
  for (let ri = 0; ri < musicRows.length; ri++) {
    const row = musicRows[ri] as { y: number; items: RawItem[] };
    const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
    const rowNoteIndices: number[] = [];
    for (const item of sortedItems) {
      const idx = notes.length;
      rowNoteIndices.push(idx);
      notes.push({
        idx,
        str: item.str,
        x: item.x,
        y: item.y,
        w: item.w,
        xPct: ((item.x + item.w / 2) / pageWidth) * 100,
        yPct: (1 - item.y / pageHeight) * 100,
        rowY: row.y,
        rowIndex: ri,
        isNote: DIGIT_PATTERN.test(item.str),
        isDot: item.str === '.',
        isRest: item.str === '0',
      });
    }
    noteRows.push({
      rowIndex: ri,
      y: row.y,
      firstIdx: rowNoteIndices[0] as number,
      lastIdx: rowNoteIndices[rowNoteIndices.length - 1] as number,
    });
  }

  return { notes, noteRows, pageWidth, pageHeight };
}
