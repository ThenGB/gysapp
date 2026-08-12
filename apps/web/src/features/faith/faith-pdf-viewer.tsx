import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { fetchFaithPdfManifest } from '@gysapp/core';
import '../hymnal/song-viewer.css';

type PdfJs = typeof import('pdfjs-dist');

interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: Record<string, unknown>): { promise: Promise<unknown> };
}

interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
  destroy?(): Promise<void>;
}

function lastPageKey(number: number): string {
  return `faith_pdf_last_page_${number}`;
}

export function FaithPdfViewerPage() {
  const { number = '1' } = useParams();
  const topic = Number(number);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(() => {
    const saved = Number(localStorage.getItem(lastPageKey(topic)) ?? '1');
    return Number.isFinite(saved) && saved >= 1 ? saved : 1;
  });
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const manifestQuery = useQuery({
    queryKey: ['faith-pdfs-manifest'],
    queryFn: () => fetchFaithPdfManifest(),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const item = manifestQuery.data?.items.find((i) => i.number === topic);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    let doc: PdfDocLike | null = null;
    const render = async () => {
      setError(null);
      setLoaded(false);
      try {
        const pdfjs: PdfJs = await import('pdfjs-dist');
        const moduleWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = moduleWorker.default;
        const loadedDoc = (await pdfjs.getDocument({ url: item.downloadUrl })
          .promise) as unknown as PdfDocLike;
        if (cancelled) return;
        doc = loadedDoc;
        setPageCount(loadedDoc.numPages);
        const target = Math.min(page, loadedDoc.numPages);
        const pdfPage = await loadedDoc.getPage(target);
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void render();
    return () => {
      cancelled = true;
      void doc?.destroy?.().catch(() => undefined);
    };
  }, [item, page]);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(pageCount || 1, next));
      setPage(clamped);
      localStorage.setItem(lastPageKey(topic), String(clamped));
    },
    [pageCount, topic],
  );

  if (manifestQuery.isLoading) return <div className="content-shell">Memuat…</div>;
  if (!item) return <div className="content-shell">Bacaan belum tersedia.</div>;

  return (
    <div className="content-shell song-page">
      <div className="bible-toolbar">
        <Link to="/faith" className="icon-btn" aria-label="Kembali ke Iman">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">{item.name.replace('.pdf', '')}</h1>
      </div>

      <div className="song-pdf">
        {error ? (
          <p className="song-error" role="alert">
            Bacaan gagal dimuat: {error}
          </p>
        ) : (
          <canvas ref={canvasRef} className="song-canvas" aria-label={`Bacaan Iman ${topic}`} />
        )}
        {!loaded && !error && <p aria-busy="true">Memuat halaman…</p>}
      </div>

      <div className="bible-chapter-nav faith-pdf-nav" role="group" aria-label="Navigasi halaman">
        <button
          type="button"
          className="icon-btn"
          aria-label="Halaman sebelumnya"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <CaretLeft size={22} aria-hidden="true" />
        </button>
        <span className="bible-chapter-label">
          Halaman {page} / {pageCount}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Halaman berikutnya"
          disabled={page >= pageCount}
          onClick={() => goToPage(page + 1)}
        >
          <CaretRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
