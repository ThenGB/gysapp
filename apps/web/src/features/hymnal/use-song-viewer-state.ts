import { useEffect, useMemo, useState } from 'react';
import {
  ACCIDENTAL_KEY,
  clampTranspose,
  clampZoom,
  readAccidentalMode,
  readSavedView,
  writeSavedView,
  type AccidentalMode,
  type FitMode,
  type PageMode,
  type ViewerMode,
} from './song-viewer-v2-model';

export function useSongViewerState(book: string, song: string) {
  const saved = useMemo(() => readSavedView(book, song), [book, song]);
  const [mode, setMode] = useState<ViewerMode>(saved.mode ?? (book === 'KR' ? 'pdf' : 'text'));
  const [showChords, setShowChords] = useState(saved.showChords ?? true);
  const [pageMode, setPageMode] = useState<PageMode>(saved.pageMode === 2 ? 2 : 1);
  const [fitMode, setFitMode] = useState<FitMode>(saved.fitMode === 'width' ? 'width' : 'page');
  const [zoom, setZoom] = useState(clampZoom(saved.zoom));
  const [pageStart, setPageStart] = useState(Math.max(1, saved.pageStart ?? 1));
  const [transposeStep, setTransposeStep] = useState(clampTranspose(saved.transposeStep));
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>(readAccidentalMode);

  useEffect(() => {
    setMode(saved.mode ?? (book === 'KR' ? 'pdf' : 'text'));
    setShowChords(saved.showChords ?? true);
    setPageMode(saved.pageMode === 2 ? 2 : 1);
    setFitMode(saved.fitMode === 'width' ? 'width' : 'page');
    setZoom(clampZoom(saved.zoom));
    setPageStart(Math.max(1, saved.pageStart ?? 1));
    setTransposeStep(clampTranspose(saved.transposeStep));
  }, [book, saved]);

  useEffect(() => {
    writeSavedView(book, song, {
      mode,
      showChords,
      pageMode,
      fitMode,
      zoom,
      pageStart,
      transposeStep,
    });
  }, [book, fitMode, mode, pageMode, pageStart, showChords, song, transposeStep, zoom]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCIDENTAL_KEY, accidentalMode);
    } catch {
      // Preferences remain usable for the session when storage is unavailable.
    }
  }, [accidentalMode]);

  return {
    mode,
    setMode,
    showChords,
    setShowChords,
    pageMode,
    setPageMode,
    fitMode,
    setFitMode,
    zoom,
    setZoom,
    pageStart,
    setPageStart,
    transposeStep,
    setTransposeStep,
    accidentalMode,
    setAccidentalMode,
  };
}
