/** Item teks hasil getTextContent() pdf.js — satu-satunya ketergantungan eksternal. */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
}

export interface PdfPageMetrics {
  width: number;
  height: number;
}

export interface PdfNote {
  idx: number;
  str: string;
  x: number;
  y: number;
  w: number;
  xPct: number;
  yPct: number;
  rowY: number;
  rowIndex: number;
  isNote: boolean;
  isDot: boolean;
  isRest: boolean;
}

export interface PdfNoteRow {
  rowIndex: number;
  y: number;
  firstIdx: number;
  lastIdx: number;
}

export interface LyricLine {
  y: number;
  text: string;
  startPct: number;
  widthPct: number;
}

export interface ChordPlacement {
  chord: string;
  /** Posisi relatif 0..1 dalam baris lirik. */
  pos: number;
}

export interface ChordedLine {
  text: string;
  chords: ChordPlacement[];
}

export interface NoteExtractionResult {
  notes: PdfNote[];
  noteRows: PdfNoteRow[];
  pageWidth: number;
  pageHeight: number;
}
