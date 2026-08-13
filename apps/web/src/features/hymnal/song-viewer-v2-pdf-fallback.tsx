import type { ChordedLine } from '@gysapp/core';
import { useT } from '../../i18n';
import type { AccidentalMode } from './song-viewer-v2-model';
import { HymnalTextViewer } from './song-viewer-v2-text';

export function PdfFallback({ verses, lines, showChords, accidentalMode, transposeStep }: { verses: string[]; lines: ChordedLine[]; showChords: boolean; accidentalMode: AccidentalMode; transposeStep: number }) {
  const { t } = useT();
  return <div className="song-pdf-fallback"><p className="song-error" role="alert">{t('scoreUnavailableLyrics')}</p><HymnalTextViewer verses={verses} candidates={lines} showChords={showChords} accidentalMode={accidentalMode} transposeStep={transposeStep} /></div>;
}
