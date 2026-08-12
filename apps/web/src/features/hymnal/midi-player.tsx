import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MusicNotes,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { midiEngine, type MidiStatus } from './midi-engine';
import './song-viewer.css';

type AccidentalMode = 'sharp' | 'flat';
type TrackChangeHandler = () => boolean | Promise<boolean>;

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${sec}`;
}

export function MiniMidiPlayer({
  url,
  title,
  accidentalMode = 'sharp',
  transposeStep = 0,
  compact = false,
  previousDisabled = false,
  nextDisabled = false,
  onAccidentalModeChange,
  onTransposeChange,
  onPrevious,
  onNext,
}: {
  url: string | null;
  title: string;
  accidentalMode?: AccidentalMode;
  transposeStep?: number;
  compact?: boolean;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onAccidentalModeChange?: (mode: AccidentalMode) => void;
  onTransposeChange?: (step: number) => void;
  onPrevious?: TrackChangeHandler;
  onNext?: TrackChangeHandler;
}) {
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingPct, setLoadingPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transpose, setTranspose] = useState(transposeStep);
  const [tempo, setTempo] = useState(120);
  const [detailsOpen, setDetailsOpen] = useState(!compact);
  const previousUrl = useRef(url);
  const autoplayAfterTrackChange = useRef(false);
  const transposeRef = useRef(transpose);
  const onTransposeChangeRef = useRef(onTransposeChange);

  transposeRef.current = transpose;
  onTransposeChangeRef.current = onTransposeChange;

  const loadTrack = useCallback((targetUrl: string, autoplay: boolean) => {
    setError(null);
    setLoadingPct(0);
    return midiEngine
      .loadMidi({
        url: targetUrl,
        autoplay,
        transpose: transposeRef.current,
        onProgress: setLoadingPct,
      })
      .then(({ duration: nextDuration }) => {
        const nextTranspose = midiEngine.getTranspose();
        setDuration(nextDuration);
        setTime(0);
        setTempo(midiEngine.getTempoBpm());
        setTranspose(nextTranspose);
        onTransposeChangeRef.current?.(nextTranspose);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    midiEngine.setStateListener(setStatus);
    return () => midiEngine.setStateListener(null);
  }, []);

  useEffect(() => {
    const changed = Boolean(previousUrl.current && previousUrl.current !== url);
    if (changed) midiEngine.stop();
    previousUrl.current = url;
    setStatus('idle');
    setTime(0);
    setDuration(0);
    setLoadingPct(0);
    setError(null);
    setTempo(120);

    if (changed && url && autoplayAfterTrackChange.current) {
      autoplayAfterTrackChange.current = false;
      void loadTrack(url, true);
    }
  }, [loadTrack, url]);

  useEffect(() => {
    if (compact) setDetailsOpen(false);
  }, [compact]);

  useEffect(() => {
    setTranspose(transposeStep);
  }, [transposeStep]);

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
    if (!url) return;
    if (midiEngine.getStatus() === 'playing') {
      midiEngine.pause();
      return;
    }
    if (midiEngine.getStatus() === 'paused' && midiEngine.getDuration() > 0) {
      midiEngine.play();
      return;
    }
    void loadTrack(url, true);
  }, [loadTrack, url]);

  const changeTrack = useCallback(async (handler: TrackChangeHandler | undefined) => {
    if (!handler) return;
    autoplayAfterTrackChange.current = midiEngine.getStatus() === 'playing';
    try {
      const changed = await handler();
      if (!changed) autoplayAfterTrackChange.current = false;
    } catch (err) {
      autoplayAfterTrackChange.current = false;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    midiEngine.seek(value);
    setTime(value);
  }, []);

  const bumpTranspose = useCallback(
    (delta: number) => {
      const next = Math.max(-11, Math.min(11, transpose + delta));
      setTranspose(next);
      onTransposeChange?.(next);
      void Promise.resolve(midiEngine.setTranspose(next)).catch(() => undefined);
    },
    [onTransposeChange, transpose],
  );

  const bumpTempo = useCallback(
    (delta: number) => {
      const next = Math.max(30, Math.min(220, tempo + delta));
      setTempo(next);
      void Promise.resolve(midiEngine.setTempoBpm(next)).catch(() => undefined);
    },
    [tempo],
  );

  const loading = status === 'loading';
  const playing = status === 'playing';
  const hasSong = duration > 0 && url !== null;
  const showDetails = !compact || detailsOpen;

  return (
    <div
      className={`midi-player${compact ? ' midi-player-compact' : ''}${detailsOpen ? ' midi-player-details-open' : ''}`}
      aria-label="Pemutar MIDI"
    >
      <button
        type="button"
        className="icon-btn midi-play"
        onClick={toggle}
        aria-label={playing ? 'Jeda' : 'Putar'}
        disabled={loading || !url}
      >
        {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
      </button>
      <div className="midi-info">
        <span className="midi-title">
          <MusicNotes size={16} aria-hidden="true" />{' '}
          <span className="midi-title-text">{title}</span>
        </span>
        <div className="midi-seek">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(time, duration || 0)}
            aria-label="Posisi pemutaran"
            disabled={!hasSong}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
          {loading && <span className="midi-loading">memuat… {Math.round(loadingPct)}%</span>}
          {error && (
            <span className="midi-error" role="alert">
              {error}
            </span>
          )}
          <span className="midi-time">
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
        {showDetails && (
          <div className="midi-param-row">
            <div className="midi-param">
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Turunkan nada"
                onClick={() => bumpTranspose(-1)}
              >
                −
              </button>
              <span className="midi-param-value">
                Nada {transpose > 0 ? `+${transpose}` : transpose}
              </span>
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Naikkan nada"
                onClick={() => bumpTranspose(1)}
              >
                +
              </button>
            </div>
            <div className="midi-param">
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Perlambat tempo"
                onClick={() => bumpTempo(-5)}
              >
                −
              </button>
              <span className="midi-param-value">{tempo} BPM</span>
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Percepat tempo"
                onClick={() => bumpTempo(5)}
              >
                +
              </button>
            </div>
            <div
              className="midi-param midi-accidental-toggle"
              role="group"
              aria-label="Notasi chord MIDI"
            >
              <button
                type="button"
                className={`chip${accidentalMode === 'sharp' ? ' chip-active' : ''}`}
                aria-pressed={accidentalMode === 'sharp'}
                onClick={() => onAccidentalModeChange?.('sharp')}
              >
                ♯
              </button>
              <button
                type="button"
                className={`chip${accidentalMode === 'flat' ? ' chip-active' : ''}`}
                aria-pressed={accidentalMode === 'flat'}
                onClick={() => onAccidentalModeChange?.('flat')}
              >
                ♭
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="midi-aux">
        <button
          type="button"
          className="icon-btn"
          aria-label="Lagu sebelumnya"
          disabled={!onPrevious || previousDisabled || loading}
          onClick={() => void changeTrack(onPrevious)}
        >
          <SkipBack size={20} aria-hidden="true" />
        </button>
        {compact && (
          <button
            type="button"
            className="icon-btn"
            aria-label={detailsOpen ? 'Sembunyikan kontrol MIDI' : 'Tampilkan kontrol MIDI'}
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Lagu berikutnya"
          disabled={!onNext || nextDisabled || loading}
          onClick={() => void changeTrack(onNext)}
        >
          <SkipForward size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
