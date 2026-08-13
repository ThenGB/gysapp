import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react';

export function ViewerTitle({
  book,
  number,
  title,
}: {
  book: string;
  number: string;
  title: string;
}) {
  return (
    <div className="song-v2-title">
      <span>{book} {number}</span>
      <h1>{title}</h1>
    </div>
  );
}

export function FullscreenButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick(): void;
}) {
  const label = active ? 'Keluar layar penuh' : 'Layar penuh';
  return (
    <button type="button" className="song-v2-fullscreen" aria-label={label} onClick={onClick}>
      {active ? (
        <ArrowsIn size={18} aria-hidden="true" />
      ) : (
        <ArrowsOut size={18} aria-hidden="true" />
      )}
      <span>{label}</span>
    </button>
  );
}
