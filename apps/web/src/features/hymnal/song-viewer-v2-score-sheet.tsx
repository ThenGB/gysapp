import { formatChordForDisplay } from '@gysapp/core';
import type { AccidentalMode, PdfChordPoint } from './song-viewer-v2-model';

export function PdfScoreSheet({
  pageNo,
  label,
  points,
  showChords,
  transposeStep,
  accidentalMode,
  canvasRef,
}: {
  pageNo: number;
  label: string;
  points: PdfChordPoint[];
  showChords: boolean;
  transposeStep: number;
  accidentalMode: AccidentalMode;
  canvasRef(element: HTMLCanvasElement | null): void;
}) {
  return (
    <div className="song-v2-score-sheet">
      <canvas ref={canvasRef} className="song-canvas" aria-label={label} />
      {showChords && (
        <div className="song-v2-pdf-chords" aria-label="Chord partitur">
          {points.map((point, index) => (
            <span
              key={`${point.chord}-${index}`}
              className="song-v2-pdf-chord"
              style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
            >
              {formatChordForDisplay(point.chord, {
                transposeStep,
                baseTransposeOffset: 0,
                accidentalMode,
              })}
            </span>
          ))}
        </div>
      )}
      <span className="visually-hidden">Halaman {pageNo}</span>
    </div>
  );
}
