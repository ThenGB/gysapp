import type { MutableRefObject } from 'react';
import type { AccidentalMode, PageMode, PdfChordPoint } from './song-viewer-v2-model';
import { PdfScoreSheet } from './song-viewer-v2-score-sheet';

export function PdfCanvasList({
  start,
  mode,
  count,
  points,
  showChords,
  transposeStep,
  accidentalMode,
  canvasRefs,
}: {
  start: number;
  mode: PageMode;
  count: number;
  points: Record<number, PdfChordPoint[]>;
  showChords: boolean;
  transposeStep: number;
  accidentalMode: AccidentalMode;
  canvasRefs: MutableRefObject<Array<HTMLCanvasElement | null>>;
}) {
  const slots = mode === 2 ? [0, 1] : [0];
  return (
    <div className="song-pdf-pages">
      {slots.map((slot) => {
        const page = start + slot;
        if (page > count && count > 0) return null;
        return (
          <PdfScoreSheet
            key={page}
            pageNo={page}
            label={`Partitur halaman ${page}`}
            points={points[page] ?? []}
            showChords={showChords}
            transposeStep={transposeStep}
            accidentalMode={accidentalMode}
            canvasRef={(element) => {
              canvasRefs.current[slot] = element;
            }}
          />
        );
      })}
    </div>
  );
}
