import {
  NATURAL_NOTE_INDEX,
  NOTE_NAMES_FLAT,
  NOTE_NAMES_SHARP,
  NOTE_NAMES_SHARP_ASCII,
  NUMBER_TO_NOTE,
  wrapSemitone,
} from './notes';

export interface TransposeContext {
  /** Transposisi pengguna, range (-11..11). */
  transposeStep: number;
  /** Selisih nada dasar PDF vs chord keluarga (display-key coordinates). */
  baseTransposeOffset: number;
  accidentalMode: 'sharp' | 'flat';
}

export const DEFAULT_TRANSPOSE_CONTEXT: TransposeContext = {
  transposeStep: 0,
  baseTransposeOffset: 0,
  accidentalMode: 'sharp',
};

export interface ParsedChordToken {
  semitone: number;
  suffix: string;
  bassSemitone: number | null;
  suffixAfter: string;
}

function normalizeAccidental(raw: string): string {
  return raw === '♭' ? 'b' : raw === '♯' ? '#' : raw;
}

function semitoneOf(rootLetter: string, accidental: string): number {
  const natural = NATURAL_NOTE_INDEX[rootLetter];
  if (!Number.isInteger(natural)) return NaN;
  let semi = natural as number;
  if (accidental === '#') semi += 1;
  if (accidental === 'b') semi -= 1;
  return semi;
}

export interface SlashBass {
  suffixBefore: string;
  bassSemitone: number | null;
  suffixAfter: string;
}

/** Port dari gyschordweb `_parseSlashBass`. */
export function parseSlashBass(suffix: string): SlashBass {
  const match = suffix.match(/^(.*)\/([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (!match) return { suffixBefore: suffix, bassSemitone: null, suffixAfter: '' };
  const bassRoot = (match[2] as string).toUpperCase();
  const bassAcc = normalizeAccidental(match[3] ?? '');
  const semi = semitoneOf(bassRoot, bassAcc);
  if (!Number.isInteger(semi)) return { suffixBefore: suffix, bassSemitone: null, suffixAfter: '' };
  return {
    suffixBefore: match[1] ?? '',
    bassSemitone: wrapSemitone(semi),
    suffixAfter: match[4] ?? '',
  };
}

/**
 * Port dari gyschordweb `parseChordToken`. Mendukung format A-G dengan
 * aksen (#/b/♯/♭) dan format legacy numerik 1-7.
 */
export function parseChordToken(token: string): ParsedChordToken | null {
  const newFormat = token.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (newFormat) {
    const root = (newFormat[1] as string).toUpperCase();
    const accidental = normalizeAccidental(newFormat[2] ?? '');
    const semitone = semitoneOf(root, accidental);
    if (!Number.isInteger(semitone)) return null;
    const bass = parseSlashBass(newFormat[3] ?? '');
    return {
      semitone: wrapSemitone(semitone),
      suffix: bass.suffixBefore,
      bassSemitone: bass.bassSemitone,
      suffixAfter: bass.suffixAfter,
    };
  }
  const legacyFormat = token.match(/^([1-7])([#♯b♭]?)(.*)$/);
  if (!legacyFormat) return null;
  const legacyRoot = NUMBER_TO_NOTE[legacyFormat[1] as string] as string;
  const accidental = normalizeAccidental(legacyFormat[2] ?? '');
  const semitone = semitoneOf(legacyRoot, accidental);
  if (!Number.isInteger(semitone)) return null;
  const bass = parseSlashBass(legacyFormat[3] ?? '');
  return {
    semitone: wrapSemitone(semitone),
    suffix: bass.suffixBefore,
    bassSemitone: bass.bassSemitone,
    suffixAfter: bass.suffixAfter,
  };
}

/**
 * Port dari gyschordweb `formatChordForDisplay`. Root ditranspose oleh
 * (transposeStep + baseTransposeOffset); bass slash hanya transposeStep
 * (bass disimpan dalam display-key coordinates).
 */
export function formatChordForDisplay(token: string, ctx: TransposeContext): string {
  const parsed = parseChordToken(token);
  if (!parsed) return token;
  const noteSet = ctx.accidentalMode === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const transposed = wrapSemitone(parsed.semitone + ctx.transposeStep + ctx.baseTransposeOffset);

  let displaySuffix = parsed.suffix;
  if (ctx.accidentalMode === 'flat') {
    displaySuffix = displaySuffix.replace(/b(\d+)/g, '♭$1');
  } else {
    displaySuffix = displaySuffix.replace(/#(\d+)/g, '♯$1');
  }
  displaySuffix = displaySuffix.replace(/#/g, '♯');

  let bassDisplay = '';
  if (parsed.bassSemitone !== null) {
    const transposedBass = wrapSemitone(parsed.bassSemitone + ctx.transposeStep);
    bassDisplay = `/${noteSet[transposedBass]}${parsed.suffixAfter ?? ''}`;
  }
  return `${noteSet[transposed]}${displaySuffix}${bassDisplay}`;
}

/**
 * Port dari gyschordweb `encodeChordToken`. Membalik offset sehingga
 * penyimpanan tetap relatif terhadap file asli; bass hanya -transposeStep.
 * Output selalu ASCII-sharp (storage canonical).
 */
export function encodeChordToken(input: string, ctx: TransposeContext): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^([A-Ga-g1-7])([#♯b♭]?)(.*)$/);
  if (!match) return null;
  const rootRaw = match[1] as string;
  const accidentalRaw = match[2] ?? '';
  const fullSuffix = (match[3] ?? '').trim();

  const rootLetter = /[1-7]/.test(rootRaw)
    ? (NUMBER_TO_NOTE[rootRaw] as string)
    : rootRaw.toUpperCase();
  const accidental = normalizeAccidental(accidentalRaw);
  let semitone = semitoneOf(rootLetter, accidental);
  if (!Number.isInteger(semitone)) return null;

  semitone = semitone - ctx.transposeStep - ctx.baseTransposeOffset;
  const normalizedRoot = NOTE_NAMES_SHARP_ASCII[wrapSemitone(semitone)] as string;

  const bass = parseSlashBass(fullSuffix);
  if (bass.bassSemitone !== null) {
    const bassSemi = bass.bassSemitone - ctx.transposeStep;
    const normalizedBass = NOTE_NAMES_SHARP_ASCII[wrapSemitone(bassSemi)] as string;
    return `${normalizedRoot}${bass.suffixBefore}/${normalizedBass}${bass.suffixAfter}`;
  }
  return `${normalizedRoot}${fullSuffix}`;
}
