import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward } from '@phosphor-icons/react';
import { assetUrl } from '../../lib/asset-url';
import { midiEngine, type MidiStatus } from './midi-engine';
import './song-viewer.css';

const DEMO_MIDI = assetUrl('/assets/midi/KR001.mid');

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${sec}`;
}

export function MiniMidiPlayer() {
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingPct, setLoadingPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    midiEngine.setStateListener(setStatus);
    return () => midiEngine.setStateListener(null);
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => {
      setTime(midiEngine.getTime());
      setDuration(midiEngine.getDuration());
    }, 200);
    return () => window.clearInterval(id);
  }, [status]);

  const toggle = useCallback(() => {
    setError(null);
    if (midiEngine.getStatus() === 'playing') {
      midiEngine.pause();
      return;
    }
    if (midiEngine.getStatus() === 'paused' && midiEngine.getDuration() > 0) {
      midiEngine.play();
      return;
    }
    void midiEngine
      .loadMidi({ url: DEMO_MIDI, autoplay: true, onProgress: setLoadingPct })
      .then(({ duration }) => {
        setDuration(duration);
        setTime(0);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const onSeek = useCallback((value: number) => {
    midiEngine.seek(value);
    setTime(value);
  }, []);

  const loading = status === 'loading';
  const playing = status === 'playing';

  return (
    <div className="midi-player" aria-label="Pemutar MIDI">
      <button
        type="button"
        className="icon-btn midi-play"
        onClick={toggle}
        aria-label={playing ? 'Jeda' : 'Putar'}
        disabled={loading}
      >
        {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
      </button>
      <div className="midi-info">
        <span className="midi-title">KR 001 â€” demo</span>
        <div className="midi-seek">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(time, duration || 0)}
            aria-label="Posisi pemutaran"
            disabled={duration === 0}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
          {loading && <span className="midi-loading">memuatâ€¦ {Math.round(loadingPct)}%</span>}
          {error && (
            <span className="midi-error" role="alert">
              {error}
            </span>
          )}
        </div>
        <span className="midi-time">
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
      <div className="midi-aux" aria-hidden="true">
        <button type="button" className="icon-btn" aria-label="Lagu sebelumnya" disabled>
          <SkipBack size={20} />
        </button>
        <button type="button" className="icon-btn" aria-label="Lagu berikutnya" disabled>
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}
