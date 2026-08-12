import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ChordDocument } from '@gysapp/contracts';
import type { ChordedLine } from '@gysapp/core';
import {
  buildChordedLines,
  extractLyricLines,
  extractPageNotes,
  formatChordForDisplay,
} from '@gysapp/core';
import { createHttpManifestFetcher, ChordLazyCache } from '@gysapp/core';
import { hymnalCatalog, type ResolvedSong } from '../../data/hymnal/hymnal-catalog';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';
import {
  setHymnalPlayerTrack,
  updateHymnalPlayerPrefs,
  useHymnalPlayerState,
} from './hymnal-player-store';
import { midiEngine } from './midi-engine';
import './song-viewer.css';

type PdfJs = typeof import('pdfjs-dist');
type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type Mode = 'pdf' | 'text';
type PageMode = 1 | 2;
type FitMode = 'page' | 'width';
type AccidentalMode = 'sharp' | 'flat';

type ViewerPrefs = {
  pageMode: PageMode;
  fitMode: FitMode;
  zoom: number;
};

type SongViewState = ViewerPrefs & {
  mode: Mode;
  transposeStep: number;
  scrollY: number;
};

type StoredSongViewState = SongViewState & { updatedAt: number };

const VIEW_PREFS_KEY = 'gysapp.hymnal.viewer.v1';
const SONG_STATE_KEY = 'gysapp.hymnal.song-state.v1';
const ACCIDENTAL_KEY = 'gysapp.hymnal.accidental.v1';
const MAX_SAVED_SONG_STATES = 80;

// Instalasi baru tidak membawa chord. Setiap lagu yang dibuka melakukan
// conditional manifest check; request dalam window 60 detik didedup supaya
// navigasi cepat tidak membanjiri gyschordweb. Blob tetap content-addressed:
// SHA sama = nol download, SHA baru = file baru + pointer aktif atomik.
const chordCache = new ChordLazyCache({
  store: new IndexedDbBlobStore('gysapp-chords'),
  fetchManifest: createHttpManifestFetcher({
    url: 'https://raw.githubusercontent.com/gyspnk/gyschordweb/main/docs/assets-chord-manifest.json',
  }),
  ttlChordsMs: 0,
  ttlMissingMs: 0,
  manifestDedupMs: 60_000,
});

function clampZoom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.7 && value <= 2
    ? value
    : 1;
}

function clampTranspose(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(-11, Math.min(11, Math.round(value)));
}

function readViewerPrefs(): ViewerPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_PREFS_KEY) ?? '{}') as Record<string, unknown>;
    return {
      pageMode: raw.pageMode === 2 ? 2 : 1,
      fitMode: raw.fitMode === 'width' ? 'width' : 'page',
      zoom: clampZoom(raw.zoom),
    };
  } catch {
    return { pageMode: 1, fitMode: 'page', zoom: 1 };
  }
}

function songStateKey(book: string, song: string): string {
  return `${book}:${song}`;
}

function readSongViewState(book: string, song: string, fallback: ViewerPrefs): SongViewState {
  const defaults: SongViewState = {
    ...fallback,
    mode: book === 'KR' ? 'pdf' : 'text',
    transposeStep: 0,
    scrollY: 0,
  };
  try {
    const map = JSON.parse(localStorage.getItem(SONG_STATE_KEY) ?? '{}') as Record<
      string,
      Partial<StoredSongViewState>
    >;
    const saved = map[songStateKey(book, song)];
    if (!saved) return defaults;
    return {
      mode: saved.mode === 'text' || saved.mode === 'pdf' ? saved.mode : defaults.mode,
      pageMode: saved.pageMode === 2 ? 2 : saved.pageMode === 1 ? 1 : defaults.pageMode,
      fitMode:
        saved.fitMode === 'width' || saved.fitMode === 'page' ? saved.fitMode : defaults.fitMode,
      zoom: saved.zoom === undefined ? defaults.zoom : clampZoom(saved.zoom),
      transposeStep: clampTranspose(saved.transposeStep),
      scrollY:
        typeof saved.scrollY === 'number' && Number.isFinite(saved.scrollY) && saved.scrollY > 0
          ? saved.scrollY
          : 0,
    };
  } catch {
    return defaults;
  }
}

function writeSongViewState(book: string, song: string, state: SongViewState): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(SONG_STATE_KEY) ?? '{}') as Record<
      string,
      StoredSongViewState
    >;
    parsed[songStateKey(book, song)] = { ...state, updatedAt: Date.now() };
    const trimmed = Object.fromEntries(
      Object.entries(parsed)
        .sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, MAX_SAVED_SONG_STATES),
    );
    localStorage.setItem(SONG_STATE_KEY, JSON.stringify(trimmed));
  } catch {
    // Viewer tetap usable ketika storage diblok browser.
  }
}

function readAccidentalMode(): AccidentalMode {
  try {
    return localStorage.getItem(ACCIDENTAL_KEY) === 'flat' ? 'flat' : 'sharp';
  } catch {
    return 'sharp';
  }
}

async function loadChordDoc(book: string, song: string): Promise<ChordDocument | null> {
  try {
    const result = await chordCache.ensureChordForSong(book, song);
    return result.document;
  } catch {
    return null;
  }
}

export function SongViewer() {
  const { book = 'KR', song = '001' } = useParams();
  const initialPrefs = useRef(readViewerPrefs()).current;
  const initialSongState = useRef(readSongViewState(book, song, initialPrefs)).current;
  const playerState = useHymnalPlayerState();
  const currentTrackKey = `${book}:${song}`;
  const [mode, setMode] = useState<Mode>(initialSongState.mode);
  const [pageMode, setPageMode] = useState<PageMode>(initialSongState.pageMode);
  const [fitMode, setFitMode] = useState<FitMode>(initialSongState.fitMode);
  const [zoom, setZoom] = useState(initialSongState.zoom);
  const [pageCount, setPageCount] = useState(0);
  const [pdfRevision, setPdfRevision] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [chordedLines, setChordedLines] = useState<ChordedLine[]>([]);
  const [resolved, setResolved] = useState<ResolvedSong | null>(null);
  const [missing, setMissing] = useState(false);
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>(readAccidentalMode);
  const [transposeStep, setTransposeStep] = useState(initialSongState.transposeStep);
  const [viewerWidth, setViewerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 900 : window.innerHeight,
  );
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<{ url: string; doc: PdfDocumentProxy } | null>(null);
  const snapshotRef = useRef<SongViewState>(initialSongState);

  snapshotRef.current = {
    mode,
    pageMode,
    fitMode,
    zoom,
    transposeStep,
    scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
  };

  useEffect(() => {
    const saved = readSongViewState(book, song, initialPrefs);
    setMode(saved.mode);
    setPageMode(saved.pageMode);
    setFitMode(saved.fitMode);
    setZoom(saved.zoom);
    setTransposeStep(saved.transposeStep);
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      writeSongViewState(book, song, {
        ...snapshotRef.current,
        scrollY: window.scrollY,
      });
    };
  }, [book, song, initialPrefs]);

  useEffect(() => {
    const save = () => {
      writeSongViewState(book, song, {
        ...snapshotRef.current,
        scrollY: window.scrollY,
      });
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [book, song]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify({ pageMode, fitMode, zoom }));
    } catch {
      // Viewer tetap usable ketika storage diblok browser.
    }
  }, [pageMode, fitMode, zoom]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCIDENTAL_KEY, accidentalMode);
    } catch {
      // no-op
    }
  }, [accidentalMode]);

  useEffect(() => {
    if (playerState.track?.key !== currentTrackKey) return;
    if (playerState.accidentalMode !== accidentalMode) {
      setAccidentalMode(playerState.accidentalMode);
    }
    if (playerState.transposeStep !== transposeStep) {
      setTransposeStep(playerState.transposeStep);
    }
  }, [accidentalMode, currentTrackKey, playerState, transposeStep]);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setMissing(false);
    hymnalCatalog.resolveSong(book, song).then((result) => {
      if (cancelled) return;
      setResolved(result);
      setMissing(result === null);
    });
    return () => {
      cancelled = true;
    };
  }, [book, song]);

  useEffect(() => {
    if (!resolved?.midiUrl) return;
    setHymnalPlayerTrack(
      {
        key: currentTrackKey,
        url: resolved.midiUrl,
        title: `${book} ${resolved.entry.number} — ${resolved.entry.title}`,
      },
      { accidentalMode, transposeStep },
    );
  }, [accidentalMode, book, currentTrackKey, resolved, transposeStep]);

  // Load PDF + ekstraksi teks/chord hanya ketika lagu berubah. Resize/zoom tidak
  // mengulang pekerjaan mahal ini; render canvas ditangani effect terpisah.
  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;

    const load = async () => {
      setPdfError(null);
      setPageCount(0);
      setChordedLines([]);
      try {
        const pdfjs: PdfJs = await import('pdfjs-dist');
        const moduleWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = moduleWorker.default;

        let doc: PdfDocumentProxy;
        if (pdfDocRef.current?.url === resolved.pdfUrl) {
          doc = pdfDocRef.current.doc;
        } else {
          const previous = pdfDocRef.current;
          doc = await pdfjs.getDocument({ url: resolved.pdfUrl }).promise;
          pdfDocRef.current = { url: resolved.pdfUrl, doc };
          if (previous) void previous.doc.cleanup().catch(() => undefined);
        }
        if (cancelled) return;

        setPageCount(doc.numPages);
        setPdfRevision((value) => value + 1);

        const chordDoc = await loadChordDoc(book, song);
        const nextLines: ChordedLine[] = [];
        for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
          if (cancelled) return;
          const page = await doc.getPage(pageNo);
          const logicalViewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const items: Array<{ str: string; transform: number[]; width: number }> = [];
          for (const item of content.items) {
            if ('str' in item && 'transform' in item) {
              items.push({
                str: String(item.str),
                transform: item.transform as number[],
                width: item.width as number,
              });
            }
          }

          const extracted = extractPageNotes(items, {
            width: logicalViewport.width,
            height: logicalViewport.height,
          });
          const lyrics = extractLyricLines(items, logicalViewport.width);
          const pageEntries = chordDoc?.pages[String(pageNo)] ?? [];
          nextLines.push(
            ...buildChordedLines(
              extracted.notes,
              extracted.noteRows,
              lyrics,
              pageEntries as Array<{ noteIdx: number; chord: string }>,
            ),
          );
        }

        if (!cancelled) setChordedLines(nextLines);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : String(err));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [resolved, book, song]);

  useEffect(() => {
    if (mode !== 'pdf') return;
    const node = pdfContainerRef.current;
    if (!node) return;

    const update = () => {
      const width = Math.round(node.clientWidth);
      const height = window.innerHeight;
      setViewerWidth((current) => (Math.abs(current - width) > 1 ? width : current));
      setViewportHeight((current) => (current !== height ? height : current));
    };

    update();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            update();
          });
    observer?.observe(node);
    window.addEventListener('resize', update, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [mode]);

  // True autofit: ukuran CSS canvas dihitung dari container/viewport, sementara
  // backing bitmap dirender sesuai devicePixelRatio agar partitur tetap tajam.
  useEffect(() => {
    if (mode !== 'pdf' || pdfRevision === 0) return;
    const doc = pdfDocRef.current?.doc;
    if (!doc) return;
    let cancelled = false;
    const renderTasks: Array<{ cancel(): void }> = [];

    const render = async () => {
      const container = pdfContainerRef.current;
      const measuredWidth = viewerWidth || container?.clientWidth || window.innerWidth;
      const horizontalPadding = window.innerWidth <= 680 ? 16 : 32;
      const usableWidth = Math.max(260, measuredWidth - horizontalPadding);
      const portraitTwoPage =
        pageMode === 2 && window.innerWidth <= 860 && window.innerHeight >= window.innerWidth;
      const layoutWidth = portraitTwoPage ? Math.max(760, usableWidth) : usableWidth;
      const gap = pageMode === 2 ? 12 : 0;
      const slotWidth = Math.max(240, (layoutWidth - gap) / pageMode);
      const top = container?.getBoundingClientRect().top ?? 220;
      const navReserve = window.innerWidth < 600 ? 104 : 28;
      const availableHeight = Math.max(280, viewportHeight - top - navReserve);
      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const renderLimit = Math.min(pageMode, doc.numPages);

      for (let pageNo = 1; pageNo <= renderLimit; pageNo += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current[pageNo - 1];
        if (!canvas) continue;
        const page = await doc.getPage(pageNo);
        const logicalViewport = page.getViewport({ scale: 1 });
        const fitWidthScale = slotWidth / logicalViewport.width;
        const fitPageScale = Math.min(fitWidthScale, availableHeight / logicalViewport.height);
        const baseScale = fitMode === 'width' ? fitWidthScale : fitPageScale;
        const displayScale = Math.max(0.2, Math.min(4, baseScale * zoom));
        const renderScale = displayScale * pixelRatio;
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(logicalViewport.width * displayScale)}px`;
        canvas.style.height = `${Math.ceil(logicalViewport.height * displayScale)}px`;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const task = page.render({ canvas, canvasContext: context, viewport });
        renderTasks.push(task);
        await task.promise;
      }
    };

    void render().catch((err: unknown) => {
      if (!cancelled) setPdfError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        try {
          task.cancel();
        } catch {
          // no-op
        }
      }
    };
  }, [mode, pageMode, fitMode, zoom, viewerWidth, viewportHeight, pdfRevision]);

  const changeAccidentalMode = (next: AccidentalMode) => {
    setAccidentalMode(next);
    if (playerState.track?.key === currentTrackKey) {
      updateHymnalPlayerPrefs({ accidentalMode: next });
    }
  };

  const bumpTranspose = (delta: number) => {
    const next = clampTranspose(transposeStep + delta);
    setTransposeStep(next);
    if (playerState.track?.key === currentTrackKey) {
      updateHymnalPlayerPrefs({ transposeStep: next });
      void Promise.resolve(midiEngine.setTranspose(next)).catch(() => undefined);
    }
  };

  if (missing) {
    return (
      <div className="content-shell song-page">
        <h1 className="section-title">Pujian tidak ditemukan</h1>
      </div>
    );
  }

  return (
    <div className="content-shell song-page">
      <div className="song-toolbar">
        <h1>
          {resolved?.entry.number}
          {resolved?.entry.number2 ? `/${resolved.entry.number2}` : ''} —{' '}
          {resolved?.entry.title ?? 'Memuat…'}
        </h1>
        <div className="song-mode-tabs" role="group" aria-label="Mode tampilan">
          <button
            type="button"
            className={`chip${mode === 'pdf' ? ' chip-active' : ''}`}
            aria-pressed={mode === 'pdf'}
            onClick={() => setMode('pdf')}
          >
            Partitur
          </button>
          <button
            type="button"
            className={`chip${mode === 'text' ? ' chip-active' : ''}`}
            aria-pressed={mode === 'text'}
            onClick={() => setMode('text')}
          >
            Teks & Chord
          </button>
        </div>
      </div>

      <div className="song-controlbar" aria-label="Kontrol tampilan pujian">
        <div className="song-controlgroup" role="group" aria-label="Notasi accidental">
          <button
            type="button"
            className={`chip${accidentalMode === 'sharp' ? ' chip-active' : ''}`}
            aria-pressed={accidentalMode === 'sharp'}
            onClick={() => changeAccidentalMode('sharp')}
          >
            ♯ Sharp
          </button>
          <button
            type="button"
            className={`chip${accidentalMode === 'flat' ? ' chip-active' : ''}`}
            aria-pressed={accidentalMode === 'flat'}
            onClick={() => changeAccidentalMode('flat')}
          >
            ♭ Mol
          </button>
        </div>

        <div className="song-transpose-control" role="group" aria-label="Transpose pujian">
          <button
            type="button"
            className="icon-btn mini"
            aria-label="Turunkan nada pujian"
            onClick={() => bumpTranspose(-1)}
          >
            −
          </button>
          <span>Nada {transposeStep > 0 ? `+${transposeStep}` : transposeStep}</span>
          <button
            type="button"
            className="icon-btn mini"
            aria-label="Naikkan nada pujian"
            onClick={() => bumpTranspose(1)}
          >
            +
          </button>
        </div>

        {mode === 'pdf' && (
          <>
            <div className="song-controlgroup" role="group" aria-label="Jumlah halaman">
              <button
                type="button"
                className={`chip${pageMode === 1 ? ' chip-active' : ''}`}
                aria-pressed={pageMode === 1}
                onClick={() => setPageMode(1)}
              >
                1 halaman
              </button>
              <button
                type="button"
                className={`chip${pageMode === 2 ? ' chip-active' : ''}`}
                aria-pressed={pageMode === 2}
                disabled={pageCount === 1}
                onClick={() => setPageMode(2)}
              >
                2 halaman
              </button>
            </div>
            <div className="song-controlgroup" role="group" aria-label="Mode fitting">
              <button
                type="button"
                className={`chip${fitMode === 'page' ? ' chip-active' : ''}`}
                aria-pressed={fitMode === 'page'}
                onClick={() => setFitMode('page')}
              >
                Fit halaman
              </button>
              <button
                type="button"
                className={`chip${fitMode === 'width' ? ' chip-active' : ''}`}
                aria-pressed={fitMode === 'width'}
                onClick={() => setFitMode('width')}
              >
                Fit lebar
              </button>
            </div>
            <div className="song-zoom-control" role="group" aria-label="Zoom partitur">
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Perkecil partitur"
                onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="icon-btn mini"
                aria-label="Perbesar partitur"
                onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(1))))}
              >
                +
              </button>
            </div>
          </>
        )}
      </div>

      {mode === 'pdf' && pageMode === 2 && (
        <p className="song-landscape-hint">
          Untuk 2 halaman di layar kecil, gunakan posisi landscape agar partitur lebih nyaman
          dibaca.
        </p>
      )}

      {mode === 'pdf' && (
        <div
          ref={pdfContainerRef}
          className={`song-pdf song-pdf-${fitMode} song-pdf-pages-${pageMode}`}
        >
          {pdfError ? (
            <div className="song-pdf-fallback">
              <p className="song-error" role="alert">
                Partitur belum tersedia untuk buku ini — menampilkan lirik.
              </p>
              <LyricsVerses verses={resolved?.entry.verses ?? []} />
            </div>
          ) : (
            <div className="song-pdf-pages">
              <canvas
                ref={(element) => {
                  canvasRefs.current[0] = element;
                }}
                className="song-canvas"
                aria-label={`Partitur ${book} ${song} halaman 1`}
              />
              {pageMode === 2 && (
                <canvas
                  ref={(element) => {
                    canvasRefs.current[1] = element;
                  }}
                  className={`song-canvas${pageCount < 2 ? ' song-canvas-hidden' : ''}`}
                  aria-label={`Partitur ${book} ${song} halaman 2`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'text' &&
        (chordedLines.length > 0 ? (
          <ChordedTextLines
            lines={chordedLines}
            accidentalMode={accidentalMode}
            transposeStep={transposeStep}
          />
        ) : (
          <LyricsVerses verses={resolved?.entry.verses ?? []} />
        ))}
    </div>
  );
}

function LyricsVerses({ verses }: { verses: string[] }) {
  if (verses.length === 0) {
    return (
      <div className="song-lyrics song-empty">
        <p>Lirik belum tersedia.</p>
      </div>
    );
  }
  return (
    <div className="song-lyrics">
      {verses.map((verse, index) => (
        <div key={index} className="song-line">
          <p className="song-line-text song-verse-block">{verse}</p>
        </div>
      ))}
    </div>
  );
}

export function ChordedTextLines({
  lines,
  accidentalMode = 'sharp',
  transposeStep = 0,
}: {
  lines: ChordedLine[];
  accidentalMode?: AccidentalMode;
  transposeStep?: number;
}) {
  if (lines.length === 0) {
    return (
      <div className="song-lyrics song-empty">
        <p>Belum ada data chord untuk lagu ini.</p>
        <p className="song-empty-sub">Chord dimuat otomatis saat lagu dibuka (lazy cache).</p>
      </div>
    );
  }
  return (
    <div className="song-lyrics song-lyrics-chorded">
      {lines.map((line, index) => (
        <div key={index} className="song-line">
          <div className="song-chord-row" aria-hidden="false">
            {line.chords.map((chord, chordIndex) => (
              <span
                key={chordIndex}
                className="song-chord-badge"
                style={{ left: `${(chord.pos * 100).toFixed(2)}%` }}
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
