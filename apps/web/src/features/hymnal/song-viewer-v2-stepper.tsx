import { Minus, Plus } from '@phosphor-icons/react';

export function ViewerStepper({ label, minusLabel, plusLabel, onMinus, onPlus }: {
  label: string;
  minusLabel: string;
  plusLabel: string;
  onMinus(): void;
  onPlus(): void;
}) {
  return <div className="song-v2-stepper" role="group" aria-label={label}>
    <button type="button" aria-label={minusLabel} onClick={onMinus}><Minus size={17} aria-hidden="true" /></button>
    <span>{label}</span>
    <button type="button" aria-label={plusLabel} onClick={onPlus}><Plus size={17} aria-hidden="true" /></button>
  </div>;
}
