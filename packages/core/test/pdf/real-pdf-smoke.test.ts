import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseChordDocument } from '@gysapp/contracts';
import {
  buildChordedLines,
  extractLyricLines,
  extractPageNotes,
} from '../../src/pdf/index-internal';
import type { PdfTextItem } from '../../src/pdf/types';

const PDF = fileURLToPath(new URL('../../../../tests/fixtures/pdf/KR001.pdf', import.meta.url));
const CHORD = fileURLToPath(
  new URL(
    '../../../../tests/fixtures/chords/files/KR_001__001_Pujilah Allah Yang Maha Esa.chord.json',
    import.meta.url,
  ),
);

async function textContentOfPage1(): Promise<{
  items: PdfTextItem[];
  width: number;
  height: number;
}> {
  const data = new Uint8Array(await readFile(PDF));
  const loadingTask = getDocument({ data });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];
  for (const it of content.items) {
    if ('str' in it && 'transform' in it) {
      items.push({
        str: String(it.str),
        transform: it.transform as number[],
        width: it.width as number,
      });
    }
  }
  await loadingTask.destroy().catch(() => undefined);
  return { items, width: viewport.width, height: viewport.height };
}

describe('pdf spike: KR 001 nyata', () => {
  it('extracts notes and projects chord fixtures onto lyric lines', async () => {
    const { items, width, height } = await textContentOfPage1();

    const extracted = extractPageNotes(items, { width, height });
    expect(extracted.notes.length).toBeGreaterThan(10);
    expect(extracted.noteRows.length).toBeGreaterThan(0);

    const lyricLines = extractLyricLines(items, width);
    expect(lyricLines.length).toBeGreaterThan(0);

    const chordDoc = parseChordDocument(JSON.parse(await readFile(CHORD, 'utf8')));
    const pageEntries = chordDoc.pages['1'] ?? [];
    const chordedLines = buildChordedLines(
      extracted.notes,
      extracted.noteRows,
      lyricLines,
      pageEntries,
    );

    // Spike lulus bila minimal 1 baris lirik mendapat >= 1 chord.
    expect(chordedLines.length).toBeGreaterThanOrEqual(1);
    const withChords = chordedLines.filter((l) => l.chords.length > 0);
    expect(withChords.length).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
