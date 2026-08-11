import type {
  ChordedLine,
  ChordPlacement,
  LyricLine,
  PdfNote,
  PdfNoteRow,
  PdfTextItem,
} from './types';

const DIGIT_RE = /^[0-7.\s]+$/;
const LYRIC_Y_TOLERANCE = 2;
const MAX_ROW_GAP = 45;
const MATCH_THRESHOLD = 0.6;

/**
 * Port dari gyschordweb `extractLyricLines` (lyrics-viewer.js): baris teks
 * (bukan notasi digit) dikelompokkan per-y lalu diurutkan kiri-ke-kanan.
 */
export function extractLyricLines(textContent: PdfTextItem[], pageWidth: number): LyricLine[] {
  const items = textContent
    .map((it) => ({
      str: String(it.str ?? '').trim(),
      x: it.transform[4] as number,
      y: it.transform[5] as number,
      w: it.width,
    }))
    .filter((it) => it.str.length > 0 && !DIGIT_RE.test(it.str));

  const groups: Array<{
    y: number;
    items: Array<{ str: string; x: number; y: number; w: number }>;
  }> = [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  for (const it of sorted) {
    const g = groups.find((gr) => Math.abs(gr.y - it.y) < LYRIC_Y_TOLERANCE);
    if (g) g.items.push(it);
    else groups.push({ y: it.y, items: [it] });
  }

  return groups
    .filter((g) => g.items.some((it) => /[A-Za-z]/.test(it.str)))
    .map((g) => {
      const its = [...g.items].sort((a, b) => a.x - b.x);
      const text = its.map((it) => it.str).join(' ');
      const startX = its[0]?.x ?? 0;
      const endX = Math.max(...its.map((it) => it.x + it.w));
      return {
        y: g.y,
        text,
        startPct: (startX / pageWidth) * 100,
        widthPct: Math.max(1, ((endX - startX) / pageWidth) * 100),
      };
    });
}

export function normalizeLine(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const VERSE_LABEL_RE = /^\s*(?:reff?|refrain|chorus|ulangan|[(（]?[0-9]+[)）]?[.\s]*)+/i;

export function stripVerseLabel(s: string): string {
  return String(s ?? '').replace(VERSE_LABEL_RE, '');
}

/**
 * Port dari gyschordweb `findChordedLine`: cocokkan baris JSON mode teks
 * dengan baris PDF ber-chord (skor 0.85*lenRatio / commonPrefix, >=0.6).
 */
export function findChordedLine(jsonLine: string, chordedLines: ChordedLine[]): ChordedLine | null {
  const target = normalizeLine(stripVerseLabel(jsonLine));
  if (!target || !Array.isArray(chordedLines) || chordedLines.length === 0) return null;
  let best: ChordedLine | null = null;
  let bestScore = 0;
  for (const cand0 of chordedLines) {
    const cand = normalizeLine(stripVerseLabel(cand0.text));
    if (!cand) continue;
    if (cand === target) return cand0;
    let score = 0;
    if (cand.includes(target) || target.includes(cand)) {
      const lenRatio = Math.min(cand.length, target.length) / Math.max(cand.length, target.length);
      score = 0.85 * lenRatio;
    } else {
      let j = 0;
      while (j < cand.length && j < target.length && cand[j] === target[j]) j++;
      score = j / Math.max(cand.length, target.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand0;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

/**
 * Port dari gyschordweb `buildChordedLines`: pasangkan setiap baris not
 * dengan baris lirik terdekat di bawahnya (gap <= 45), proyeksikan posisi
 * chord noteIdx -> posisi relatif 0..1 dalam baris lirik.
 */
export function buildChordedLines(
  notes: PdfNote[],
  noteRows: PdfNoteRow[],
  lyricLines: LyricLine[],
  entries: Array<{ noteIdx: number; chord: string }>,
): ChordedLine[] {
  const out: ChordedLine[] = [];
  if (!Array.isArray(entries) || entries.length === 0) return out;
  for (const row of noteRows) {
    let lyr: LyricLine | null = null;
    let bestDist = Infinity;
    for (const ll of lyricLines) {
      if (ll.y < row.y && row.y - ll.y <= MAX_ROW_GAP) {
        const d = row.y - ll.y;
        if (d < bestDist) {
          bestDist = d;
          lyr = ll;
        }
      }
    }
    if (!lyr) continue;
    const chords: ChordPlacement[] = [];
    for (const entry of entries) {
      if (
        !Number.isFinite(entry.noteIdx) ||
        entry.noteIdx < row.firstIdx ||
        entry.noteIdx > row.lastIdx
      )
        continue;
      const note = notes[entry.noteIdx];
      if (!note) continue;
      const pos = Math.max(0, Math.min(1, (note.xPct - lyr.startPct) / lyr.widthPct));
      chords.push({ chord: entry.chord, pos });
    }
    if (chords.length === 0) continue;
    out.push({ text: lyr.text, chords });
  }
  return out;
}
