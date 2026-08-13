import { useMemo } from 'react';
import type { ChordedLine } from '@gysapp/core';
import { buildLineFallback, type AccidentalMode } from './song-viewer-v2-model';
import { HymnalVerse } from './song-viewer-v2-verse';

export function HymnalTextViewer({ verses, candidates, showChords, accidentalMode, transposeStep }: { verses: string[]; candidates: ChordedLine[]; showChords: boolean; accidentalMode: AccidentalMode; transposeStep: number }) {
  const fallback = useMemo(() => buildLineFallback(verses, candidates), [candidates, verses]);
  if (!verses.length) return <div className="song-lyrics song-v2-text song-empty"><p>Lirik belum tersedia.</p></div>;
  return <div className={`song-lyrics song-v2-text${showChords ? ' chords-on' : ''}`}>{verses.map((verse, index) => <HymnalVerse key={index} verse={verse} index={index} candidates={candidates} fallback={fallback} showChords={showChords} accidentalMode={accidentalMode} transposeStep={transposeStep} />)}</div>;
}
