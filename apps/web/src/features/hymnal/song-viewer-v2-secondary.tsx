import type { AccidentalMode, FitMode, PageMode, ViewerMode } from './song-viewer-v2-model';
import { ViewerStepper } from './song-viewer-v2-stepper';

export function ViewerSecondaryControls({
  mode,
  accidentalMode,
  transposeStep,
  pageMode,
  pageCount,
  fitMode,
  zoom,
  labels,
  onAccidental,
  onTranspose,
  onPageMode,
  onFitMode,
  onZoom,
}: {
  mode: ViewerMode;
  accidentalMode: AccidentalMode;
  transposeStep: number;
  pageMode: PageMode;
  pageCount: number;
  fitMode: FitMode;
  zoom: number;
  labels: {
    controls: string;
    sharp: string;
    flat: string;
    key: string;
    lower: string;
    raise: string;
    onePage: string;
    twoPages: string;
    fitting: string;
    fitPage: string;
    fitWidth: string;
    decreaseScore: string;
    increaseScore: string;
  };
  onAccidental(mode: AccidentalMode): void;
  onTranspose(delta: number): void;
  onPageMode(mode: PageMode): void;
  onFitMode(mode: FitMode): void;
  onZoom(delta: number): void;
}) {
  return (
    <div className="song-v2-secondary" aria-label={labels.controls}>
      <div className="song-v2-controlgroup" role="group" aria-label="Notasi chord">
        <button type="button" className={accidentalMode === 'sharp' ? 'active' : ''} aria-pressed={accidentalMode === 'sharp'} onClick={() => onAccidental('sharp')}>♯ {labels.sharp}</button>
        <button type="button" className={accidentalMode === 'flat' ? 'active' : ''} aria-pressed={accidentalMode === 'flat'} onClick={() => onAccidental('flat')}>♭ {labels.flat}</button>
      </div>
      <ViewerStepper label={`${labels.key} ${transposeStep > 0 ? `+${transposeStep}` : transposeStep}`} minusLabel={labels.lower} plusLabel={labels.raise} onMinus={() => onTranspose(-1)} onPlus={() => onTranspose(1)} />
      {mode === 'pdf' && (
        <>
          <div className="song-v2-controlgroup" role="group" aria-label="Jumlah halaman">
            <button type="button" className={pageMode === 1 ? 'active' : ''} aria-pressed={pageMode === 1} onClick={() => onPageMode(1)}>{labels.onePage}</button>
            <button type="button" className={pageMode === 2 ? 'active' : ''} aria-pressed={pageMode === 2} disabled={pageCount <= 1} onClick={() => onPageMode(2)}>{labels.twoPages}</button>
          </div>
          <div className="song-v2-controlgroup" role="group" aria-label={labels.fitting}>
            <button type="button" className={fitMode === 'page' ? 'active' : ''} aria-pressed={fitMode === 'page'} onClick={() => onFitMode('page')}>{labels.fitPage}</button>
            <button type="button" className={fitMode === 'width' ? 'active' : ''} aria-pressed={fitMode === 'width'} onClick={() => onFitMode('width')}>{labels.fitWidth}</button>
          </div>
          <ViewerStepper label={`${Math.round(zoom * 100)}%`} minusLabel={labels.decreaseScore} plusLabel={labels.increaseScore} onMinus={() => onZoom(-0.1)} onPlus={() => onZoom(0.1)} />
        </>
      )}
    </div>
  );
}
