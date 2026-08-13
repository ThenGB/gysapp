import type { MutableRefObject, RefObject } from 'react';
import type {
  AccidentalMode,
  FitMode,
  PageMode,
  PdfChordPoint,
} from './song-viewer-v2-model';
import { PdfCanvasList } from './song-viewer-v2-canvas-list';

export function PdfSurface({
  pageMode,
  pageStart,
  pageCount,
  fitMode,
  showChords,
  transposeStep,
  accidentalMode,
  points,
  wrapRef,
  canvasRefs,
}: {
  pageMode: PageMode;
  pageStart: number;
  pageCount: number;
  fitMode: FitMode;
  showChords: boolean;
  transposeStep: number;
  accidentalMode: AccidentalMode;
  points: Record<number, PdfChordPoint[]>;
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRefs: MutableRefObject<Array<HTMLCanvasElement | null>>;
}) {
  return (
    <div
      ref={wrapRef}
      className={`song-pdf song-v2-pdf song-pdf-${fitMode} song-pdf-pages-${pageMode}`}
    >
      <PdfCanvasList
        start={pageStart}
        mode={pageMode}
        count={pageCount}
        points={points}
        showChords={showChords}
        transposeStep={transposeStep}
        accidentalMode={accidentalMode}
        canvasRefs={canvasRefs}
      />
    </div>
  );
}
