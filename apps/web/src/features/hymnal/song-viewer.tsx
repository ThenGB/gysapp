import { formatChordForDisplay, type ChordedLine } from '@gysapp/core';
import { useT } from '../../i18n';
import type { AccidentalMode } from './song-viewer-v2-model';

export { SongViewerV2 as SongViewer } from './song-viewer-v2';

export function ChordedTextLines({
  lines,
  accidentalMode = 'sharp',
  transposeStep = 0,
}: {
  lines: ChordedLine[];
  accidentalMode?: AccidentalMode;
  transposeStep?: number;
}) {
  const { t } = useT();
  if (lines.length === 0) {
    return (
      <div className="song-lyrics song-empty">
        <p>{t('chordUnavailable')}</p>
        <p className="song-empty-sub">{t('chordLazyHint')}</p>
      </div>
    );
  }
  return (
    <div className="song-lyrics song-lyrics-chorded">
      {lines.map((line, index) => (
        <div key={index} className="song-line">
          <div className="song-chord-row" aria-label="Chord baris">
            {line.chords.map((chord, chordIndex) => (
              <span
                key={chordIndex}
                className="song-chord-badge"
                style={{
                  left: `clamp(1.75rem, ${(chord.pos * 100).toFixed(2)}%, calc(100% - 1.75rem))`,
                }}
              >
                {formatChordForDisplay(chord.chord, {
                  transposeStep,
                  baseTransposeOffset: 0,
                  accidentalMode,
                })}
              </span>
            ))}
          </div>
          <p className="song-line-text">{line.text}</p>
        </div>
      ))}
    </div>
  );
}
