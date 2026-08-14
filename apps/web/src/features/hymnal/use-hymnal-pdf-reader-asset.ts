import { useEffect, useRef, useState } from 'react';
import type { ChordDocument } from '@gysapp/contracts';
import type { ChordedLine } from '@gysapp/core';
import { hymnalPackManager } from '../../data/hymnal/hymnal-pack-manager';
import { offlineMediaCache } from '../../platform/offline-media-cache';
import {
  extractPageChordData,
  type FitMode,
  type PageMode,
  type PdfChordPoint,
  type ViewerMode,
} from './song-viewer-v2-model';

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type PdfDocumentLoadingTask = import('pdfjs-dist').PDFDocumentLoadingTask;

interface InstalledPdfSource {
  code: string;
  page: number;
  pages: number;
}

function parseInstalledPdfSource(value: string | null): InstalledPdfSource | null {
  if (!value?.startsWith('gysapp-hymnal-pack://')) return null;
  try {
    const url = new URL(value);
    const page = Number(url.searchParams.get('page'));
    const pages = Number(url.searchParams.get('pages'));
    return {
      code: decodeURIComponent(url.hostname).toUpperCase(),
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pages: Number.isInteger(pages) && pages > 0 ? pages : 1,
    };
  } catch {
    return null;
  }
}

function physicalPage(logicalPage: number, sourcePageStart: number): number {
  return sourcePageStart + logicalPage - 1;
}

export function useHymnalPdfReader({
  pdfUrl,
  pdfFallbackUrl,
  pdfBytes,
  sourcePageStart,
  sourcePageCount,
  mode,
  showChords,
  chordDoc,
  chordLoaded,
  pageMode,
  pageStart,
  fitMode,
  zoom,
}: {
  pdfUrl: string | null;
  pdfFallbackUrl?: string | null;
  pdfBytes?: Uint8Array | null;
  sourcePageStart?: number;
  sourcePageCount?: number;
  mode: ViewerMode;
  showChords: boolean;
  chordDoc: ChordDocument | null;
  chordLoaded: boolean;
  pageMode: PageMode;
  pageStart: number;
  fitMode: FitMode;
  zoom: number;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
  const [textLines, setTextLines] = useState<ChordedLine[]>([]);
  const [pdfPoints, setPdfPoints] = useState<Record<number, PdfChordPoint[]>>({});
  const [viewerWidth, setViewerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const pdfWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const installedSource = parseInstalledPdfSource(pdfUrl);
  const firstSourcePage = Math.max(1, installedSource?.page ?? sourcePageStart ?? 1);
  const requestedPageCount = Math.max(
    1,
    installedSource?.pages ?? sourcePageCount ?? Number.MAX_SAFE_INTEGER,
  );

  useEffect(() => {
    if (!pdfUrl && !pdfBytes) {
      setPdfError(null);
      setPageCount(0);
      setPdfDoc(null);
      setTextLines([]);
      setPdfPoints({});
      return;
    }
    let cancelled = false;
    let task: PdfDocumentLoadingTask | null = null;
    const abort = new AbortController();
    setPdfError(null);
    setPageCount(0);
    setPdfDoc(null);
    setTextLines([]);
    setPdfPoints({});

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        let bytes: Uint8Array<ArrayBufferLike> | null = pdfBytes ? new Uint8Array(pdfBytes) : null;
        if (!bytes && installedSource) {
          bytes = await hymnalPackManager.pdfBytes(installedSource.code);
          if (!bytes) throw new Error('Partitur Pujian yang terpasang tidak dapat dibaca.');
        }
        if (!bytes && pdfUrl) {
          try {
            bytes = await offlineMediaCache.getOrFetch(pdfUrl, 'pdf', {
              signal: abort.signal,
            });
          } catch (primaryError) {
            if (!pdfFallbackUrl || pdfFallbackUrl === pdfUrl || abort.signal.aborted) {
              throw primaryError;
            }
            bytes = await offlineMediaCache.getOrFetch(pdfFallbackUrl, 'pdf', {
              signal: abort.signal,
            });
          }
        }
        if (!bytes || cancelled) return;
        task = pdfjs.getDocument({ data: bytes });
        const doc = await task.promise;
        if (cancelled) {
          void doc.cleanup().catch(() => undefined);
          return;
        }
        const availablePages = Math.max(0, doc.numPages - firstSourcePage + 1);
        if (availablePages === 0) {
          void doc.cleanup().catch(() => undefined);
          throw new Error('Halaman partitur tidak tersedia di PDF ini.');
        }
        setPdfDoc(doc);
        setPageCount(Math.min(requestedPageCount, availablePages));
      } catch (error) {
        if (!cancelled && !abort.signal.aborted) {
          setPdfError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      if (task) void task.destroy().catch(() => undefined);
    };
  }, [
    firstSourcePage,
    installedSource?.code,
    pdfBytes,
    pdfFallbackUrl,
    pdfUrl,
    requestedPageCount,
  ]);

  useEffect(
    () => () => {
      if (pdfDoc) void pdfDoc.cleanup().catch(() => undefined);
    },
    [pdfDoc],
  );

  useEffect(() => {
    if (!pdfDoc || !chordLoaded || mode !== 'text' || !showChords || pageCount === 0) return;
    let cancelled = false;
    void (async () => {
      const next: ChordedLine[] = [];
      for (let logicalPage = 1; logicalPage <= pageCount; logicalPage += 1) {
        const data = await extractPageChordData(
          pdfDoc,
          physicalPage(logicalPage, firstSourcePage),
          chordDoc,
          logicalPage,
        );
        if (cancelled) return;
        next.push(...data.lines);
      }
      if (!cancelled) setTextLines(next);
    })().catch(() => {
      if (!cancelled) setTextLines([]);
    });
    return () => {
      cancelled = true;
    };
  }, [chordDoc, chordLoaded, firstSourcePage, mode, pageCount, pdfDoc, showChords]);

  useEffect(() => {
    if (!pdfDoc || !chordDoc || mode !== 'pdf' || !showChords || pageCount === 0) {
      setPdfPoints({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<number, PdfChordPoint[]> = {};
      const end = Math.min(pageCount, pageStart + pageMode - 1);
      for (let logicalPage = pageStart; logicalPage <= end; logicalPage += 1) {
        const data = await extractPageChordData(
          pdfDoc,
          physicalPage(logicalPage, firstSourcePage),
          chordDoc,
          logicalPage,
        );
        if (cancelled) return;
        next[logicalPage] = data.points;
      }
      if (!cancelled) setPdfPoints(next);
    })().catch(() => {
      if (!cancelled) setPdfPoints({});
    });
    return () => {
      cancelled = true;
    };
  }, [chordDoc, firstSourcePage, mode, pageCount, pageMode, pageStart, pdfDoc, showChords]);

  useEffect(() => {
    if (mode !== 'pdf') return;
    const node = pdfWrapRef.current;
    if (!node) return;
    const update = () => {
      setViewerWidth(node.clientWidth);
      setViewportHeight(window.innerHeight);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    window.addEventListener('resize', update, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [mode]);

  useEffect(() => {
    if (!pdfDoc || mode !== 'pdf' || pageCount === 0) return;
    let cancelled = false;
    const tasks: Array<{ cancel(): void }> = [];

    void (async () => {
      const usableWidth = Math.max(260, viewerWidth - (window.innerWidth <= 680 ? 16 : 32));
      const portraitTwoPage =
        pageMode === 2 && window.innerWidth <= 860 && window.innerHeight >= window.innerWidth;
      const layoutWidth = portraitTwoPage ? Math.max(760, usableWidth) : usableWidth;
      const gap = pageMode === 2 ? 12 : 0;
      const slotWidth = Math.max(240, (layoutWidth - gap) / pageMode);
      const top = pdfWrapRef.current?.getBoundingClientRect().top ?? 220;
      const reserve = window.innerWidth < 600 ? 116 : 34;
      const availableHeight = Math.max(280, viewportHeight - top - reserve);
      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      for (let slot = 0; slot < pageMode; slot += 1) {
        const logicalPage = pageStart + slot;
        const canvas = canvasRefs.current[slot];
        if (!canvas) continue;
        if (logicalPage > pageCount) {
          canvas.style.display = 'none';
          continue;
        }
        canvas.style.display = 'block';
        const page = await pdfDoc.getPage(physicalPage(logicalPage, firstSourcePage));
        if (cancelled) return;
        const logical = page.getViewport({ scale: 1 });
        const widthScale = slotWidth / logical.width;
        const pageScale = Math.min(widthScale, availableHeight / logical.height);
        const baseScale = fitMode === 'width' ? widthScale : pageScale;
        const displayScale = Math.max(0.2, Math.min(4, baseScale * zoom));
        const viewport = page.getViewport({ scale: displayScale * pixelRatio });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(logical.width * displayScale)}px`;
        canvas.style.height = `${Math.ceil(logical.height * displayScale)}px`;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const renderTask = page.render({ canvas, canvasContext: context, viewport });
        tasks.push(renderTask);
        await renderTask.promise;
      }
    })().catch((error: unknown) => {
      if (!cancelled) setPdfError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      for (const task of tasks) {
        try {
          task.cancel();
        } catch {
          // no-op
        }
      }
    };
  }, [
    firstSourcePage,
    fitMode,
    mode,
    pageCount,
    pageMode,
    pageStart,
    pdfDoc,
    viewerWidth,
    viewportHeight,
    zoom,
  ]);

  return { pageCount, pdfError, textLines, pdfPoints, pdfWrapRef, canvasRefs };
}
