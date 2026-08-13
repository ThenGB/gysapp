import type { ChordedLine } from '@gysapp/core';
import { findBestChordLine, type AccidentalMode } from './song-viewer-v2-model';
import { HymnalTextLine } from './song-viewer-v2-text-line';

export function HymnalVerse({
  verse,
  index,
  candidates,
  fallback,
  showChords,
  accidentalMode,
  transposeStep,
}: {
  verse: string;
  index: number;
  candidates: ChordedLine[];
  fallback: Array<ChordedLine | null>;
  showChords: boolean;
  accidentalMode: AccidentalMode;
  transposeStep: number;
}) {
  const lines = verse.split('\n').map((line) => line.trim()).filter(Boolean);
  const marker = String(index + 1).padStart(2, '0');
  return (
    <section className="song-v2-verse">
      <span className="song-v2-verse-label" aria-hidden="true">
        {marker}
      </span>
      {lines.map((line, lineIndex) => (
        <HymnalTextLine
          key={lineIndex}
          line={line}
          chordLine={
            showChords
              ? findBestChordLine(line, candidates) ?? fallback[lineIndex] ?? null
              : null
          }
          accidentalMode={accidentalMode}
          transposeStep={transposeStep}
        />
      ))}
    </section>
  );
}
