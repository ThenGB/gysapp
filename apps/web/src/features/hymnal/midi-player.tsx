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

type WakeLockLike = {
  request(type: 'screen'): Promise<{ release(): Promise<void> }>;
};

const MIDI_INSTRUMENT_KEY = 'gysapp.hymnal.midi.instrument.v1';
const GENERAL_MIDI_INSTRUMENTS = [
  { value: -1, label: 'Asli lagu' },
  { value: 0, label: 'Piano' },
  { value: 19, label: 'Church Organ' },
  { value: 24, label: 'Nylon Guitar' },
  { value: 40, label: 'Violin' },
  { value: 48, label: 'Strings' },
  { value: 52, label: 'Choir Aahs' },
] as const;

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${sec}`;
}

function readInstrument(): number {
  try {
    const value = Number(localStorage.getItem(MIDI_INSTRUMENT_KEY));
    return GENERAL_MIDI_INSTRUMENTS.some((item) => item.value === value) ? value : -1;
  } catch {
    return -1;
  }
}

function persistInstrument(value: number): void {
  try {
    localStorage.setItem(MIDI_INSTRUMENT_KEY, String(value));
  } catch {
    // Instrument preference remains available for the current session.
  }
}

function usePlayingWakeLock(playing: boolean) {
  const sentinelRef = useRef<{ release(): Promise<void> } | null>(null);

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock || !playing) return;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || sentinelRef.current) return;
      try {
        sentinelRef.current = await wakeLock.request('screen');
      } catch {
        // Wake Lock is best-effort and can be denied by the browser/OS.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [playing]);
}

function useMidiMediaSession({
  title,
  status,
  time,
  duration,
  onPlay,
  onPause,
  onSeek,
  onPrevious,
  onNext,
}: {
  title: string;
  status: MidiStatus;
  time: number;
  duration: number;
  onPlay(): void;
  onPause(): void;
  onSeek(value: number): void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({ title, artist: 'GYS App', album: 'Pujian' });
    }

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but not every action.
      }
    };

    setHandler('play', () => onPlay());
    setHandler('pause', () => onPause());
    setHandler('previoustrack', onPrevious ? () => onPrevious() : null);
    setHandler('nexttrack', onNext ? () => onNext() : null);
    setHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') onSeek(details.seekTime);
    });
    setHandler('seekbackward', (details) => onSeek(Math.max(0, time - (details.seekOffset ?? 10))));
    setHandler('seekforward', (details) => onSeek(Math.min(duration || time + 10, time + (details.seekOffset ?? 10))));

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      setHandler('seekto', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
    };
  }, [duration, onNext, onPause, onPlay, onPrevious, onSeek, time, title]);

  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    session.playbackState = status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : 'none';
    if (duration <= 0 || !Number.isFinite(duration) || typeof session.setPositionState !== 'function') return;
    try {
      session.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.max(0, Math.min(time, Math.max(0, duration - 0.001))),
      });
    } catch {
      // Invalid/unsupported position state must never interrupt playback.
    }
  }, [duration, status, time]);
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
  onEnded,
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
  onEnded?: TrackChangeHandler;
}) {
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingPct, setLoadingPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transpose, setTranspose] = useState(transposeStep);
  const [tempo, setTempo] = useState(120);
  const [instrument, setInstrument] = useState(readInstrument);
  const [detailsOpen, setDetailsOpen] = useState(!compact);
  const previousUrl = useRef(url);
  const autoplayAfterTrackChange = useRef(false);
  const endedHandled = useRef(false);
  const transposeRef = useRef(transpose);
  const instrumentRef = useRef(instrument);
  const onTransposeChangeRef = useRef(onTransposeChange);

  transposeRef.current = transpose;
  instrumentRef.current = instrument;
  onTransposeChangeRef.current = onTransposeChange;

  const loadTrack = useCallback((targetUrl: string, autoplay: boolean) => {
    setError(null);
    setLoadingPct(0);
    return midiEngine
      .loadMidi({
        url: targetUrl,
        autoplay,
        transpose: transposeRef.current,
        instrument: instrumentRef.current,
        onProgress: setLoadingPct,
      })
      .then(({ duration: nextDuration, activated }) => {
        if (activated === false) return;
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
    endedHandled.current = false;
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

  const play = useCallback(() => {
    setError(null);
    if (!url) return;
    if (midiEngine.getStatus() === 'playing') return;
    if (midiEngine.getStatus() === 'paused' && midiEngine.getDuration() > 0) {
      midiEngine.play();
      return;
    }
    void loadTrack(url, true);
  }, [loadTrack, url]);

  const pause = useCallback(() => {
    if (midiEngine.getStatus() === 'playing') midiEngine.pause();
  }, []);

  const toggle = useCallback(() => {
    if (midiEngine.getStatus() === 'playing') pause();
    else play();
  }, [pause, play]);

  const changeTrack = useCallback(
    async (handler: TrackChangeHandler | undefined, autoplayOverride?: boolean) => {
      if (!handler) return;
      autoplayAfterTrackChange.current = autoplayOverride ?? midiEngine.getStatus() === 'playing';
      try {
        const changed = await handler();
        if (!changed) autoplayAfterTrackChange.current = false;
      } catch (err) {
        autoplayAfterTrackChange.current = false;
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  useEffect(() => {
    if (status !== 'ended' || !onEnded || endedHandled.current) return;
    endedHandled.current = true;
    void changeTrack(onEnded, true);
  }, [changeTrack, onEnded, status]);

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

  const changeInstrument = useCallback(
    (next: number) => {
      setInstrument(next);
      instrumentRef.current = next;
      persistInstrument(next);
      if (!url || midiEngine.getDuration() <= 0) return;
      const wasPlaying = midiEngine.getStatus() === 'playing';
      const position = midiEngine.getTime();
      const currentTempo = midiEngine.getTempoBpm();
      setError(null);
      void midiEngine
        .loadMidi({
          url,
          autoplay: false,
          transpose: transposeRef.current,
          instrument: next,
          tempoBpm: currentTempo,
        })
        .then(({ duration: nextDuration, activated }) => {
          if (activated === false) return;
          const nextPosition = Math.min(position, nextDuration);
          setDuration(nextDuration);
          setTime(nextPosition);
          midiEngine.seek(nextPosition);
          if (wasPlaying) midiEngine.play();
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        });
    },
    [url],
  );

  const loading = status === 'loading';
  const playing = status === 'playing';
  const hasSong = duration > 0 && url !== null;
  const showDetails = !compact || detailsOpen;

  const mediaPrevious = onPrevious && !previousDisabled && !loading
    ? () => void changeTrack(onPrevious)
    : undefined;
  const mediaNext = onNext && !nextDisabled && !loading
    ? () => void changeTrack(onNext)
    : undefined;

  useMidiMediaSession({
    title,
    status,
    time,
    duration,
    onPlay: play,
    onPause: pause,
    onSeek,
    onPrevious: mediaPrevious,
    onNext: mediaNext,
  });
  usePlayingWakeLock(playing);

  return (
    <div
      className={`midi-player midi-v2-player${compact ? ' midi-player-compact' : ''}${detailsOpen ? ' midi-player-details-open' : ''}`}
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
          {error && <span className="midi-error" role="alert">{error}</span>}
          <span className="midi-time">{formatTime(time)} / {formatTime(duration)}</span>
        </div>
        {showDetails && (
          <div className="midi-param-row midi-v2-details">
            <div className="midi-param">
              <button type="button" className="icon-btn mini" aria-label="Turunkan nada" onClick={() => bumpTranspose(-1)}>−</button>
              <span className="midi-param-value">Nada {transpose > 0 ? `+${transpose}` : transpose}</span>
              <button type="button" className="icon-btn mini" aria-label="Naikkan nada" onClick={() => bumpTranspose(1)}>+</button>
            </div>
            <div className="midi-param">
              <button type="button" className="icon-btn mini" aria-label="Perlambat tempo" onClick={() => bumpTempo(-5)}>−</button>
              <span className="midi-param-value">{tempo} BPM</span>
              <button type="button" className="icon-btn mini" aria-label="Percepat tempo" onClick={() => bumpTempo(5)}>+</button>
            </div>
            <label className="midi-v2-instrument">
              <span>Instrumen</span>
              <select
                aria-label="Instrumen MIDI"
                value={instrument}
                onChange={(event) => changeInstrument(Number(event.target.value))}
              >
                {GENERAL_MIDI_INSTRUMENTS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="midi-param midi-accidental-toggle" role="group" aria-label="Notasi chord MIDI">
              <button type="button" className={`chip${accidentalMode === 'sharp' ? ' chip-active' : ''}`} aria-pressed={accidentalMode === 'sharp'} onClick={() => onAccidentalModeChange?.('sharp')}>♯</button>
              <button type="button" className={`chip${accidentalMode === 'flat' ? ' chip-active' : ''}`} aria-pressed={accidentalMode === 'flat'} onClick={() => onAccidentalModeChange?.('flat')}>♭</button>
            </div>
          </div>
        )}
      </div>
      <div className="midi-aux">
        <button type="button" className="icon-btn" aria-label="Lagu sebelumnya" disabled={!onPrevious || previousDisabled || loading} onClick={() => void changeTrack(onPrevious)}>
          <SkipBack size={20} aria-hidden="true" />
        </button>
        {compact && (
          <button type="button" className="icon-btn" aria-label={detailsOpen ? 'Sembunyikan kontrol MIDI' : 'Tampilkan kontrol MIDI'} aria-expanded={detailsOpen} onClick={() => setDetailsOpen((value) => !value)}>
            <SlidersHorizontal size={20} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Lagu berikutnya" disabled={!onNext || nextDisabled || loading} onClick={() => void changeTrack(onNext)}>
          <SkipForward size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
