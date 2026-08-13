import { useEffect, useRef, useState } from 'react';
import type { ChordDocument } from '@gysapp/contracts';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { chordCache } from './chord-cache';
import { updateHymnalPlayerPrefs, useHymnalPlayerState } from './hymnal-player-store';
import { midiEngine } from './midi-engine';
import { ViewerModeBar } from './song-viewer-v2-mode-bar';
import { clampTranspose, clampZoom, type AccidentalMode } from './song-viewer-v2-model';
import { HymnalPdfViewer } from './song-viewer-v2-pdf';
import { ViewerSecondaryControls } from './song-viewer-v2-secondary';
import { HymnalTextViewer } from './song-viewer-v2-text';
import { FullscreenButton, ViewerTitle } from './song-viewer-v2-title';
import { useHymnalPdfReader } from './use-hymnal-pdf-reader';
import { useResolvedHymnalSong } from './use-resolved-hymnal-song';
import { useSongViewerState } from './use-song-viewer-state';
import './song-viewer.css';
import './song-viewer-v2.css';

export function SongViewerV2() {
  const { t } = useT();
  const { book = 'KR', song = '001' } = useParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const player = useHymnalPlayerState();
  const currentTrackKey = `${book}:${song}`;
  const state = useSongViewerState(book, song);
  const { resolved, missing } = useResolvedHymnalSong({
    book,
    song,
    accidentalMode: state.accidentalMode,
    transposeStep: state.transposeStep,
  });
  const [chordDoc, setChordDoc] = useState<ChordDocument | null>(null);
  const [chordLoaded, setChordLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChordDoc(null);
    setChordLoaded(false);
    void chordCache
      .ensureChordForSong(book, song)
      .then((result) => {
        if (!cancelled) setChordDoc(result.document);
      })
      .catch(() => {
        if (!cancelled) setChordDoc(null);
      })
      .finally(() => {
        if (!cancelled) setChordLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [book, song]);

  const pdf = useHymnalPdfReader({
    pdfUrl: resolved?.pdfUrl ?? null,
    mode: state.mode,
    showChords: state.showChords,
    chordDoc,
    chordLoaded,
    pageMode: state.pageMode,
    pageStart: state.pageStart,
    fitMode: state.fitMode,
    zoom: state.zoom,
  });

  useEffect(() => {
    if (player.track?.key !== currentTrackKey) return;
    if (player.accidentalMode !== state.accidentalMode) {
      state.setAccidentalMode(player.accidentalMode);
    }
    if (player.transposeStep !== state.transposeStep) {
      state.setTransposeStep(player.transposeStep);
    }
  }, [
    currentTrackKey,
    player.accidentalMode,
    player.track?.key,
    player.transposeStep,
    state.accidentalMode,
    state.setAccidentalMode,
    state.setTransposeStep,
    state.transposeStep,
  ]);

  useEffect(() => {
    if (!pdf.pageCount) return;
    const maxStart = Math.max(1, pdf.pageCount - state.pageMode + 1);
    if (state.pageStart > maxStart) state.setPageStart(maxStart);
  }, [pdf.pageCount, state.pageMode, state.pageStart, state.setPageStart]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const setAccidental = (next: AccidentalMode) => {
    state.setAccidentalMode(next);
    if (player.track?.key === currentTrackKey) {
      updateHymnalPlayerPrefs({ accidentalMode: next });
    }
  };

  const transpose = (delta: number) => {
    const next = clampTranspose(state.transposeStep + delta);
    state.setTransposeStep(next);
    if (player.track?.key === currentTrackKey) {
      updateHymnalPlayerPrefs({ transposeStep: next });
      void Promise.resolve(midiEngine.setTranspose(next)).catch(() => undefined);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      // Fullscreen is progressive enhancement.
    }
  };

  if (missing) {
    return (
      <div className="content-shell song-page">
        <h1 className="section-title">{t('hymnNotFound')}</h1>
      </div>
    );
  }

  const verses = resolved?.entry.verses ?? [];
  return (
    <div ref={rootRef} className="content-shell song-page song-v2-page">
      <header className="song-v2-header">
        <ViewerTitle
          book={book}
          number={resolved?.entry.number ?? song}
          title={resolved?.entry.title ?? t('loading')}
        />
        <div className="song-v2-header-actions">
          <ViewerModeBar
            mode={state.mode}
            showChords={state.showChords}
            onMode={state.setMode}
            onChord={() => state.setShowChords((value) => !value)}
          />
          <FullscreenButton active={fullscreen} onClick={() => void toggleFullscreen()} />
        </div>
      </header>

      <ViewerSecondaryControls
        mode={state.mode}
        accidentalMode={state.accidentalMode}
        transposeStep={state.transposeStep}
        pageMode={state.pageMode}
        pageCount={pdf.pageCount}
        fitMode={state.fitMode}
        zoom={state.zoom}
        labels={{
          controls: t('hymnViewControls'),
          sharp: t('sharp'),
          flat: t('flat'),
          key: t('keyLabel'),
          lower: t('lowerHymnKey'),
          raise: t('raiseHymnKey'),
          onePage: t('onePage'),
          twoPages: t('twoPages'),
          fitting: t('fittingMode'),
          fitPage: t('fitPage'),
          fitWidth: t('fitWidth'),
          decreaseScore: t('decreaseScore'),
          increaseScore: t('increaseScore'),
        }}
        onAccidental={setAccidental}
        onTranspose={transpose}
        onPageMode={state.setPageMode}
        onFitMode={state.setFitMode}
        onZoom={(delta) => state.setZoom((value) => clampZoom(value + delta))}
      />

      {state.showChords && chordLoaded && !chordDoc && (
        <p className="song-v2-status" role="status">
          {t('chordUnavailable')}
        </p>
      )}

      {state.mode === 'pdf' ? (
        <HymnalPdfViewer
          pageMode={state.pageMode}
          pageStart={state.pageStart}
          pageCount={pdf.pageCount}
          fitMode={state.fitMode}
          showChords={state.showChords}
          transposeStep={state.transposeStep}
          accidentalMode={state.accidentalMode}
          error={pdf.pdfError}
          points={pdf.pdfPoints}
          lines={pdf.textLines}
          verses={verses}
          wrapRef={pdf.pdfWrapRef}
          canvasRefs={pdf.canvasRefs}
          onPage={state.setPageStart}
        />
      ) : (
        <HymnalTextViewer
          verses={verses}
          candidates={pdf.textLines}
          showChords={state.showChords}
          accidentalMode={state.accidentalMode}
          transposeStep={state.transposeStep}
        />
      )}
    </div>
  );
}
