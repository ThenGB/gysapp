import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { PageMode } from './song-viewer-v2-model';

export function PdfPageNav({ pageStart, pageMode, pageCount, onChange }: { pageStart: number; pageMode: PageMode; pageCount: number; onChange(page: number): void }) {
  if (pageCount <= pageMode) return null;
  const maxStart = Math.max(1, pageCount - pageMode + 1);
  return <div className="song-v2-page-nav" role="group" aria-label="Navigasi halaman partitur">
    <button type="button" aria-label="Halaman sebelumnya" disabled={pageStart <= 1} onClick={() => onChange(Math.max(1, pageStart - pageMode))}><CaretLeft size={18} aria-hidden="true" /></button>
    <span>{pageStart} / {pageCount}</span>
    <button type="button" aria-label="Halaman berikutnya" disabled={pageStart + pageMode - 1 >= pageCount} onClick={() => onChange(Math.min(maxStart, pageStart + pageMode))}><CaretRight size={18} aria-hidden="true" /></button>
  </div>;
}
