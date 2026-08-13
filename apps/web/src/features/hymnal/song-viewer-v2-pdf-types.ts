import type { MutableRefObject, RefObject } from 'react';
import type { ChordedLine } from '@gysapp/core';
import type { AccidentalMode, FitMode, PageMode, PdfChordPoint } from './song-viewer-v2-model';

export interface HymnalPdfViewProps {
  pageMode: PageMode;
  pageStart: number;
  pageCount: number;
  fitMode: FitMode;
  showChords: boolean;
  transposeStep: number;
  accidentalMode: AccidentalMode;
  error: string | null;
  points: Record<number, PdfChordPoint[]>;
  lines: ChordedLine[];
  verses: string[];
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRefs: MutableRefObject<Array<HTMLCanvasElement | null>>;
  onPage(page: number): void;
}
