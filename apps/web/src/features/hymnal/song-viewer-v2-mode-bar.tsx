import { FilePdf, MusicNotes, TextT } from '@phosphor-icons/react';
import type { ViewerMode } from './song-viewer-v2-model';

export function ViewerModeBar({ mode, showChords, onMode, onChord }: {
  mode: ViewerMode;
  showChords: boolean;
  onMode(mode: ViewerMode): void;
  onChord(): void;
}) {
  return <div className="song-v2-primary-actions">
    <div className="song-v2-mode-tabs" role="group" aria-label="Mode viewer">
      <button type="button" className={mode === 'pdf' ? 'active' : ''} aria-pressed={mode === 'pdf'} onClick={() => onMode('pdf')}><FilePdf size={18} aria-hidden="true" /><span>PDF</span></button>
      <button type="button" className={mode === 'text' ? 'active' : ''} aria-pressed={mode === 'text'} onClick={() => onMode('text')}><TextT size={18} aria-hidden="true" /><span>Teks</span></button>
    </div>
    <button type="button" className={`song-v2-chord-toggle${showChords ? ' active' : ''}`} aria-pressed={showChords} onClick={onChord}><MusicNotes size={18} aria-hidden="true" /><span>Chord</span></button>
  </div>;
}
