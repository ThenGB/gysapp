import { formatChordForDisplay, type ChordedLine } from '@gysapp/core';
import type { AccidentalMode } from './song-viewer-v2-model';

export function HymnalTextLine({
  line,
  chordLine,
  accidentalMode,
  transposeStep,
}: {
  line: string;
  chordLine: ChordedLine | null;
  accidentalMode: AccidentalMode;
  transposeStep: number;
}) {
  return (
    <div className="song-v2-text-line">
      {chordLine && (
        <div className="song-chord-row" aria-label="Chord baris">
          {chordLine.chords.map((item, index) => (
            <span
              key={index}
              className="song-chord-badge"
              style={{
                left: `clamp(1.75rem, ${(item.pos * 100).toFixed(2)}%, calc(100% - 1.75rem))`,
              }}
            >
              {formatChordForDisplay(item.chord, {
                transposeStep,
                baseTransposeOffset: 0,
                accidentalMode,
              })}
            </span>
          ))}
        </div>
      )}
      <p className="song-line-text">{line}</p>
    </div>
  );
}
