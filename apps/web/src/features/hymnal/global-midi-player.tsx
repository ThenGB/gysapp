import { MiniMidiPlayer } from './midi-player';
import { updateHymnalPlayerPrefs, useHymnalPlayerState } from './hymnal-player-store';
import './global-midi-player.css';

export function GlobalMidiPlayerDock() {
  const player = useHymnalPlayerState();
  if (!player.track) return null;

  return (
    <aside className="global-midi-dock" aria-label="Pemutar pujian aktif">
      <MiniMidiPlayer
        compact
        url={player.track.url}
        title={player.track.title}
        accidentalMode={player.accidentalMode}
        transposeStep={player.transposeStep}
        onAccidentalModeChange={(accidentalMode) => updateHymnalPlayerPrefs({ accidentalMode })}
        onTransposeChange={(transposeStep) => updateHymnalPlayerPrefs({ transposeStep })}
      />
    </aside>
  );
}
