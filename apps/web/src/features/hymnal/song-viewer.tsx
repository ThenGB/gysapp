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
import { MiniMidiPlayer } from './midi-player';
import './song-viewer.css';

type PdfJs = typeof import('pdfjs-dist');
type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type Mode = 'pdf' | 'text';
type PageMode = 1 | 2;
type FitMode = 'page' | 'width';
type AccidentalMode = 'sharp' | 'flat';

const VIEW_PREFS_KEY = 'gysapp.hymnal.viewer.v1';
const ACCIDENTAL_KEY = 'gysapp.hymnal.accidental.v1';

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

function readViewerPrefs(): { pageMode: PageMode; fitMode: FitMode; zoom: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_PREFS_KEY) ?? '{}') as Record<string, unknown>;
    return {
      pageMode: raw.pageMode === 2 ? 2 : 1,
      fitMode: raw.fitMode === 'width' ? 'width' : 'page',
      zoom: typeof raw.zoom === 'number' && raw.zoom >= 0.7 && raw.zoom <= 2 ? raw.zoom : 1,
    };
  } catch {
    return { pageMode: 1, fitMode: 'page', zoom: 1 };
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
  const [mode, setMode] = useState<Mode>(book === 'KR' ? 'pdf' : 'text');
  const [pageMode, setPageMode] = useState<PageMode>(initialPrefs.pageMode);
  const [fitMode, setFitMode] = useState<FitMode>(initialPrefs.fitMode);
  const [zoom, setZoom] = useState(initialPrefs.zoom);
  const [pageCount, setPageCount] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [chordedLines, setChordedLines] = useState<ChordedLine[]>([]);
  const [resolved, setResolved] = useState<ResolvedSong | null>(null);
  const [missing, setMissing] = useState(false);
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>(readAccidentalMode);
  const [transposeStep, setTransposeStep] = useState(0);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pdfDocRef = useRef<{ url: string; doc: PdfDocumentProxy } | null>(null);

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
    let cancelled = false;
    hymnalCatalog.resolveSong(book, song).then((r) => {
      if (cancelled) return;
      setResolved(r);
      setMissing(r === null);
    });
    return () => {
      cancelled = true;
    };
  }, [book, song]);

  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;
    const renderTasks: Array<{ cancel(): void }> = [];

    const render = async () => {
      setPdfError(null);
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
        const chordDoc = await loadChordDoc(book, song);
        const nextLines: ChordedLine[] = [];
        const renderLimit = Math.min(pageMode, doc.numPages);

        for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
          if (cancelled) return;
          const page = await doc.getPage(pageNo);
          const logicalViewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const items: Array<{ str: string; transform: number[]; width: number }> = [];
          for (const it of content.items) {
            if ('str' in it && 'transform' in it) {
              items.push({
                str: String(it.str),
                transform: it.transform as number[],
                width: it.width as number,
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

          if (pageNo <= renderLimit) {
            const canvas = canvasRefs.current[pageNo - 1];
            if (!canvas) continue;
            const viewport = page.getViewport({ scale: 1.45 * zoom });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            const task = page.render({ canvas, canvasContext: ctx, viewport });
            renderTasks.push(task);
            await task.promise;
          }
        }

        if (!cancelled) setChordedLines(nextLines);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : String(err));
      }
    };

    void render();
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
  }, [resolved, book, song, pageMode, zoom]);

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
            onClick={() => setAccidentalMode('sharp')}
          >
            ♯ Sharp
          </button>
          <button
            type="button"
            className={`chip${accidentalMode === 'flat' ? ' chip-active' : ''}`}
            aria-pressed={accidentalMode === 'flat'}
            onClick={() => setAccidentalMode('flat')}
          >
            ♭ Mol
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
          Untuk 2 halaman di layar kecil, gunakan posisi landscape.
        </p>
      )}

      {mode === 'pdf' && (
        <div className={`song-pdf song-pdf-${fitMode} song-pdf-pages-${pageMode}`}>
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

      <MiniMidiPlayer
        url={resolved?.midiUrl ?? null}
        title={resolved ? `${book} ${resolved.entry.number} — ${resolved.entry.title}` : 'Pujian'}
        accidentalMode={accidentalMode}
        onAccidentalModeChange={setAccidentalMode}
        onTransposeChange={setTransposeStep}
      />
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
      {verses.map((verse, i) => (
        <div key={i} className="song-line">
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
      {lines.map((line, i) => (
        <div key={i} className="song-line">
          <div className="song-chord-row" aria-hidden="false">
            {line.chords.map((c, j) => (
              <span
                key={j}
                className="song-chord-badge"
                style={{ left: `${(c.pos * 100).toFixed(2)}%` }}
              >
                {formatChordForDisplay(c.chord, {
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
