import type { HymnalPdfViewProps } from './song-viewer-v2-pdf-types';
import { PdfFallback } from './song-viewer-v2-pdf-fallback';
import { PdfPageNav } from './song-viewer-v2-page-nav';
import { PdfSurface } from './song-viewer-v2-pdf-surface';

export function HymnalPdfViewer(props: HymnalPdfViewProps) {
  return <>
    {props.pageMode === 2 && <p className="song-landscape-hint">Gunakan landscape pada layar sempit untuk dua halaman.</p>}
    <PdfPageNav pageStart={props.pageStart} pageMode={props.pageMode} pageCount={props.pageCount} onChange={props.onPage} />
    {props.error ? <PdfFallback verses={props.verses} lines={props.lines} showChords={props.showChords} accidentalMode={props.accidentalMode} transposeStep={props.transposeStep} /> : <PdfSurface pageMode={props.pageMode} pageStart={props.pageStart} pageCount={props.pageCount} fitMode={props.fitMode} showChords={props.showChords} transposeStep={props.transposeStep} accidentalMode={props.accidentalMode} points={props.points} wrapRef={props.wrapRef} canvasRefs={props.canvasRefs} />}
  </>;
}
