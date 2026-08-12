import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ChordDocument } from '@gysapp/contracts';
import type { ChordedLine } from '@gysapp/core';
import { buildChordedLines, extractLyricLines, extractPageNotes } from '@gysapp/core';
import { createHttpManifestFetcher, ChordLazyCache } from '@gysapp/core';
import { hymnalCatalog, type ResolvedSong } from '../../data/hymnal/hymnal-catalog';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';
import { MiniMidiPlayer } from './midi-player';
import './song-viewer.css';

type PdfJs = typeof import('pdfjs-dist');

type Mode = 'pdf' | 'text';

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
  const [mode, setMode] = useState<Mode>(book === 'KR' ? 'pdf' : 'text');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [chordedLines, setChordedLines] = useState<ChordedLine[]>([]);
  const [resolved, setResolved] = useState<ResolvedSong | null>(null);
  const [missing, setMissing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const render = async () => {
      setPdfError(null);
      try {
        const pdfjs: PdfJs = await import('pdfjs-dist');
        const moduleWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = moduleWorker.default;
        const doc = await pdfjs.getDocument({ url: resolved.pdfUrl }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
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
          width: viewport.width / 1.4,
          height: viewport.height / 1.4,
        });
        const lyrics = extractLyricLines(items, viewport.width / 1.4);
        const chordDoc = await loadChordDoc(book, song);
        const pageEntries = chordDoc?.pages['1'] ?? [];
        if (!cancelled) {
          setChordedLines(
            buildChordedLines(
              extracted.notes,
              extracted.noteRows,
              lyrics,
              pageEntries as Array<{ noteIdx: number; chord: string }>,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : String(err));
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [resolved, book, song]);

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

      {mode === 'pdf' && (
        <div className="song-pdf">
          {pdfError ? (
            <div className="song-pdf-fallback">
              <p className="song-error" role="alert">
                Partitur belum tersedia untuk buku ini — menampilkan lirik.
              </p>
              <LyricsVerses verses={resolved?.entry.verses ?? []} />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="song-canvas"
              aria-label={`Partitur ${book} ${song}`}
            />
          )}
        </div>
      )}

      {mode === 'text' &&
        (chordedLines.length > 0 ? (
          <ChordedTextLines lines={chordedLines} />
        ) : (
          <LyricsVerses verses={resolved?.entry.verses ?? []} />
        ))}

      <MiniMidiPlayer
        url={resolved?.midiUrl ?? null}
        title={resolved ? `${book} ${resolved.entry.number} — ${resolved.entry.title}` : 'Pujian'}
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

export function ChordedTextLines({ lines }: { lines: ChordedLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="song-lyrics song-empty">
        <p>Belum ada data chord untuk lagu ini.</p>
        <p className="song-empty-sub">Chord dimuat otomatis saat lagu dibuka (lazy cache).</p>
      </div>
    );
  }
  return (
    <div className="song-lyrics">
      {lines.map((line, i) => (
        <div key={i} className="song-line">
          <div className="song-chord-row" aria-hidden="false">
            {line.chords.map((c, j) => (
              <span
                key={j}
                className="song-chord-badge"
                style={{ left: `${(c.pos * 100).toFixed(2)}%` }}
              >
                {c.chord}
              </span>
            ))}
          </div>
          <p className="song-line-text">{line.text}</p>
        </div>
      ))}
    </div>
  );
}
