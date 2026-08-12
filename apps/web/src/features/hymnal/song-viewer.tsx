import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ChordedLine } from '@gysapp/core';
import { buildChordedLines, extractLyricLines, extractPageNotes } from '@gysapp/core';
import { parseChordDocument } from '@gysapp/contracts';
import { assetUrl } from '../../lib/asset-url';
import { MiniMidiPlayer } from './midi-player';
import './song-viewer.css';

type PdfJs = typeof import('pdfjs-dist');

/** Data demo: KR 001. Versi final: index lagu + lazy chord cache + asset manager. */
const DEMO_CHORD_URL = assetUrl('/pdf/chords/KR_001.chord.json');

type Mode = 'pdf' | 'text';

async function loadChordDoc(url: string): Promise<ReturnType<typeof parseChordDocument> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseChordDocument(await res.json());
  } catch {
    return null;
  }
}

async function loadingTaskDestroy(_doc: unknown): Promise<void> {
  // PDFDocumentProxy v5 tidak punya destroy(); dibersihkan oleh GC.
}

export function SongViewer() {
  const { song = '001' } = useParams();
  const [mode, setMode] = useState<Mode>('pdf');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [chordedLines, setChordedLines] = useState<ChordedLine[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      setPdfError(null);
      try {
        const pdfjs: PdfJs = await import('pdfjs-dist');
        const moduleWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = moduleWorker.default;
        const doc = await pdfjs.getDocument({ url: assetUrl('/pdf/KR001.pdf') }).promise;
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
        const chordDoc = await loadChordDoc(DEMO_CHORD_URL);
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
        await loadingTaskDestroy(doc);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : String(err));
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [song, canvasRef]);

  return (
    <div className="content-shell song-page">
      <div className="song-toolbar">
        <h1>KR 001 â€” Pujilah Allah Yang Maha Esa</h1>
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
            <p className="song-error" role="alert">
              Partitur gagal dimuat: {pdfError}
            </p>
          ) : (
            <canvas ref={canvasRef} className="song-canvas" aria-label="Partitur KR 001" />
          )}
        </div>
      )}

      {mode === 'text' && <ChordedTextLines lines={chordedLines} />}

      <MiniMidiPlayer />
    </div>
  );
}

/** Baris lirik dengan badge chord sejajar di atas kata (mode teks). */
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
