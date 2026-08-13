import type { ChordDocument } from '@gysapp/contracts';
import type { ChordedLine } from '@gysapp/core';
import {
  buildChordedLines,
  extractLyricLines,
  extractPageNotes,
} from '@gysapp/core';

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
export type ViewerMode = 'pdf' | 'text';
export type PageMode = 1 | 2;
export type FitMode = 'page' | 'width';
export type AccidentalMode = 'sharp' | 'flat';
export type PdfChordPoint = { chord: string; xPct: number; yPct: number };

export type SavedView = {
  mode?: ViewerMode;
  showChords?: boolean;
  pageMode?: PageMode;
  fitMode?: FitMode;
  zoom?: number;
  pageStart?: number;
  transposeStep?: number;
};

const VIEW_KEY = 'gysapp.hymnal.viewer-v2';
export const ACCIDENTAL_KEY = 'gysapp.hymnal.accidental.v1';

export function clampZoom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.7, Math.min(2, value))
    : 1;
}

export function clampTranspose(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(-11, Math.min(11, Math.round(value)))
    : 0;
}

export function readSavedView(book: string, song: string): SavedView {
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Record<
      string,
      SavedView
    >;
    return all[`${book}:${song}`] ?? {};
  } catch {
    return {};
  }
}

export function writeSavedView(book: string, song: string, value: SavedView): void {
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Record<
      string,
      SavedView
    >;
    delete all[`${book}:${song}`];
    all[`${book}:${song}`] = value;
    const entries = Object.entries(all).slice(-80);
    localStorage.setItem(VIEW_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage is optional.
  }
}

export function readAccidentalMode(): AccidentalMode {
  try {
    return localStorage.getItem(ACCIDENTAL_KEY) === 'flat' ? 'flat' : 'sharp';
  } catch {
    return 'sharp';
  }
}

function normalizeLine(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/^\s*(?:reff?|refrain|chorus|ulangan|[([]?[0-9]+[)\]]?[.\s]*)+/i, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function commonPrefix(a: string, b: string): number {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return index;
}

export function findBestChordLine(
  text: string,
  candidates: ChordedLine[],
): ChordedLine | null {
  const target = normalizeLine(text);
  if (!target) return null;
  let best: ChordedLine | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const value = normalizeLine(candidate.text);
    if (!value) continue;
    if (value === target) return candidate;
    const score =
      value.includes(target) || target.includes(value)
        ? 0.85 * (Math.min(value.length, target.length) / Math.max(value.length, target.length))
        : commonPrefix(value, target) / Math.max(value.length, target.length);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

export function buildLineFallback(
  verses: string[],
  candidates: ChordedLine[],
): Array<ChordedLine | null> {
  const result: Array<ChordedLine | null> = [];
  for (const verse of verses) {
    verse
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        if (!result[index]) result[index] = findBestChordLine(line, candidates);
      });
  }
  return result;
}

export async function extractPageChordData(
  doc: PdfDocumentProxy,
  pageNo: number,
  chordDoc: ChordDocument | null,
): Promise<{ lines: ChordedLine[]; points: PdfChordPoint[] }> {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: Array<{ str: string; transform: number[]; width: number }> = [];
  for (const item of content.items) {
    if ('str' in item && 'transform' in item) {
      items.push({
        str: String(item.str),
        transform: item.transform as number[],
        width: item.width as number,
      });
    }
  }
  const extracted = extractPageNotes(items, {
    width: viewport.width,
    height: viewport.height,
  });
  const entries = (chordDoc?.pages[String(pageNo)] ?? []) as Array<{
    noteIdx: number;
    chord: string;
  }>;
  const lyrics = extractLyricLines(items, viewport.width);
  const lines = buildChordedLines(extracted.notes, extracted.noteRows, lyrics, entries);
  const points = entries.flatMap((entry) => {
    const note = extracted.notes[entry.noteIdx];
    return note ? [{ chord: entry.chord, xPct: note.xPct, yPct: note.yPct }] : [];
  });
  return { lines, points };
}
