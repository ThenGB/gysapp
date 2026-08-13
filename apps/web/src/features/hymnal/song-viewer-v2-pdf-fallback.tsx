import type { ChordedLine } from '@gysapp/core';
import type { AccidentalMode } from './song-viewer-v2-model';
import { HymnalTextViewer } from './song-viewer-v2-text';

export function PdfFallback({ verses, lines, showChords, accidentalMode, transposeStep }: { verses: string[]; lines: ChordedLine[]; showChords: boolean; accidentalMode: AccidentalMode; transposeStep: number }) {
  return <div className="song-pdf-fallback"><p className="song-error" role="alert">Partitur belum tersedia.</p><HymnalTextViewer verses={verses} candidates={lines} showChords={showChords} accidentalMode={accidentalMode} transposeStep={transposeStep} /></div>;
}
