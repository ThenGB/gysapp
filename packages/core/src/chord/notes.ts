export const NOTE_NAMES_SHARP = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;
export const NOTE_NAMES_FLAT = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;
export const NOTE_NAMES_SHARP_ASCII = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export const NATURAL_NOTE_INDEX: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const NUMBER_TO_NOTE: Readonly<Record<string, string>> = {
  '1': 'C',
  '2': 'D',
  '3': 'E',
  '4': 'F',
  '5': 'G',
  '6': 'A',
  '7': 'B',
};

export const BLACK_KEY_SEMITONES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);

export function wrapSemitone(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function isBlackKey(semitone: number): boolean {
  return BLACK_KEY_SEMITONES.has(wrapSemitone(semitone));
}

/**
 * Port dari gyschordweb `parsePdfKeyToSemitone` (viewer-core.js).
 * Mendukung nama Jerman (cis/des/es/fis/ges/as/bes/h) + #/b fallback.
 */
export function parsePdfKeyToSemitone(keyStr: string): number | null {
  if (!keyStr) return null;
  const k = keyStr.toLowerCase().replace(/m$/, '');
  const map: Readonly<Record<string, number>> = {
    c: 0,
    cis: 1,
    des: 1,
    d: 2,
    dis: 3,
    es: 3,
    eb: 3,
    e: 4,
    f: 5,
    fis: 6,
    ges: 6,
    g: 7,
    gis: 8,
    as: 8,
    ab: 8,
    a: 9,
    ais: 10,
    bes: 10,
    bb: 10,
    b: 11,
    h: 11,
  };
  if (map[k] !== undefined) return map[k];
  if (k.includes('#')) {
    const base = { c: 0, d: 2, f: 5, g: 7, a: 9 }[k.charAt(0)];
    if (base !== undefined) return wrapSemitone(base + 1);
  }
  if (k.includes('b')) {
    const base = { c: 0, d: 2, e: 4, g: 7, a: 9, b: 11 }[k.charAt(0)];
    if (base !== undefined) return wrapSemitone(base - 1);
  }
  return null;
}

/**
 * Formula dari gyschordweb `updateFamilyChordUI`/`applyLyricsKey`:
 * diff = target - origSemi - baseTransposeOffset; wrap ke range (-6, 6].
 */
export function transposeStepForKey(
  targetSemi: number,
  origSemi: number,
  baseTransposeOffset: number,
): number {
  let diff = targetSemi - origSemi - baseTransposeOffset;
  diff %= 12;
  if (diff > 6) diff -= 12;
  if (diff < -5) diff += 12;
  return diff;
}

/**
 * Port dari gyschordweb `onTranspose`: langkah di luar (-11..11) di-reset ke 0.
 */
export function normalizeTransposeStep(step: number): number {
  return step > 11 || step < -11 ? 0 : step;
}
