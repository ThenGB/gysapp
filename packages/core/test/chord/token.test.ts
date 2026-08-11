import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSPOSE_CONTEXT,
  encodeChordToken,
  formatChordForDisplay,
  parseChordToken,
  type TransposeContext,
} from '../../src/chord/token';

const sharp = (step: number, base = 0): TransposeContext => ({
  transposeStep: step,
  baseTransposeOffset: base,
  accidentalMode: 'sharp',
});
const flat = (step: number, base = 0): TransposeContext => ({
  transposeStep: step,
  baseTransposeOffset: base,
  accidentalMode: 'flat',
});

describe('parseChordToken', () => {
  it('parses natural roots', () => {
    expect(parseChordToken('C')).toEqual({
      semitone: 0,
      suffix: '',
      bassSemitone: null,
      suffixAfter: '',
    });
    expect(parseChordToken('G')).toEqual({
      semitone: 7,
      suffix: '',
      bassSemitone: null,
      suffixAfter: '',
    });
    expect(parseChordToken('B')).toEqual({
      semitone: 11,
      suffix: '',
      bassSemitone: null,
      suffixAfter: '',
    });
  });
  it('parses accidentals sharp and flat (ascii + unicode)', () => {
    expect(parseChordToken('C#')?.semitone).toBe(1);
    expect(parseChordToken('C♯')?.semitone).toBe(1);
    expect(parseChordToken('Db')?.semitone).toBe(1);
    expect(parseChordToken('D♭')?.semitone).toBe(1);
    expect(parseChordToken('Bb')?.semitone).toBe(10);
  });
  it('parses suffix and slash bass', () => {
    const t = parseChordToken('F#m7/E');
    expect(t).toEqual({ semitone: 6, suffix: 'm7', bassSemitone: 4, suffixAfter: '' });
  });
  it('parses legacy numeric notation (bass must be a letter, like upstream)', () => {
    expect(parseChordToken('1')?.semitone).toBe(0);
    expect(parseChordToken('3m/E')?.semitone).toBe(4);
    expect(parseChordToken('3m/E')?.bassSemitone).toBe(4);
    expect(parseChordToken('3m/E')?.suffix).toBe('m');
    // '5' bukan huruf A-G -> bass tidak di-parse (perilaku gyschordweb).
    expect(parseChordToken('3m/5')?.bassSemitone).toBeNull();
  });
  it('rejects invalid tokens', () => {
    expect(parseChordToken('')).toBeNull();
    expect(parseChordToken('Hm')).toBeNull();
    expect(parseChordToken('0')).toBeNull();
  });
});

describe('formatChordForDisplay', () => {
  it('formats unchanged at step 0', () => {
    expect(formatChordForDisplay('C', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C');
    expect(formatChordForDisplay('F#m7', DEFAULT_TRANSPOSE_CONTEXT)).toBe('F♯m7');
  });
  it('transposes root by transposeStep + baseTransposeOffset', () => {
    expect(formatChordForDisplay('C', sharp(2))).toBe('D');
    expect(formatChordForDisplay('G', sharp(2))).toBe('A');
    expect(formatChordForDisplay('C', sharp(0, 2))).toBe('D');
  });
  it('transposes slash bass by transposeStep only (display-key coordinates)', () => {
    expect(formatChordForDisplay('C/E', sharp(2))).toBe('D/F♯');
    expect(formatChordForDisplay('C/E', flat(2))).toBe('D/G♭');
  });
  it('uses unicode accidentals for display', () => {
    expect(formatChordForDisplay('C#', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C♯');
    expect(formatChordForDisplay('C#', flat(0))).toBe('D♭');
    expect(formatChordForDisplay('C#m7/G#', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C♯m7/G♯');
  });
  it('replaces extension accidentals like 7#9 in display mode', () => {
    expect(formatChordForDisplay('C7#9', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C7♯9');
    // Mode flat hanya mengubah nama root + b(\d); '#9' tetap ditulis '♯9'.
    expect(formatChordForDisplay('C7#9', flat(0))).toBe('C7♯9');
    expect(formatChordForDisplay('Db7', flat(0))).toBe('D♭7');
    expect(formatChordForDisplay('Cb7', flat(0))).toBe('B7');
  });
  it('returns input unchanged when unparsable', () => {
    expect(formatChordForDisplay('???', DEFAULT_TRANSPOSE_CONTEXT)).toBe('???');
  });
});

describe('encodeChordToken', () => {
  it('reverse-transposes root by -transposeStep - baseTransposeOffset', () => {
    expect(encodeChordToken('D', sharp(2))).toBe('C');
    expect(encodeChordToken('A', sharp(2))).toBe('G');
    expect(encodeChordToken('D', sharp(0, 2))).toBe('C');
  });
  it('reverse-transposes bass by -transposeStep only', () => {
    expect(encodeChordToken('D/F#', sharp(2))).toBe('C/E');
  });
  it('normalizes to ASCII sharp storage', () => {
    expect(encodeChordToken('C♯', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C#');
    expect(encodeChordToken('D♭', DEFAULT_TRANSPOSE_CONTEXT)).toBe('C#');
  });
  it('round-trips display->encode->display (semitone-equivalent)', () => {
    for (const step of [-5, -2, 0, 2, 6]) {
      const ctx = sharp(step);
      for (const token of ['C', 'F#m7', 'Bb/D', 'Gm/Eb', 'A7#9']) {
        const display = formatChordForDisplay(token, ctx);
        const encoded = encodeChordToken(display, ctx);
        expect(encoded).not.toBeNull();
        const back = formatChordForDisplay(encoded ?? '', ctx);
        const after = parseChordToken(back);
        const original = parseChordToken(display);
        expect(after?.semitone).toBe(original?.semitone);
        expect(after?.suffix).toBe(original?.suffix);
        // Bass enharmonic: bandingkan semitone, bukan ejaan.
        expect(after?.bassSemitone).toBe(original?.bassSemitone);
      }
    }
  });
  it('returns null for invalid input', () => {
    expect(encodeChordToken('', DEFAULT_TRANSPOSE_CONTEXT)).toBe('');
    expect(encodeChordToken('Hm', DEFAULT_TRANSPOSE_CONTEXT)).toBeNull();
  });
});
