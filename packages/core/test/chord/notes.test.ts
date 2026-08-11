import { describe, expect, it } from 'vitest';
import {
  isBlackKey,
  normalizeTransposeStep,
  parsePdfKeyToSemitone,
  transposeStepForKey,
  wrapSemitone,
} from '../../src/chord/notes';

describe('wrapSemitone', () => {
  it('wraps positive and negative values into 0..11', () => {
    expect(wrapSemitone(12)).toBe(0);
    expect(wrapSemitone(-1)).toBe(11);
    expect(wrapSemitone(23)).toBe(11);
    expect(wrapSemitone(-12)).toBe(0);
    expect(wrapSemitone(7)).toBe(7);
  });
});

describe('parsePdfKeyToSemitone', () => {
  const cases: Array<[string, number]> = [
    ['C', 0],
    ['c', 0],
    ['Cis', 1],
    ['Des', 1],
    ['D', 2],
    ['Dis', 3],
    ['Es', 3],
    ['Eb', 3],
    ['E', 4],
    ['F', 5],
    ['Fis', 6],
    ['Ges', 6],
    ['G', 7],
    ['Gis', 8],
    ['As', 8],
    ['Ab', 8],
    ['A', 9],
    ['Ais', 10],
    ['Bes', 10],
    ['Bb', 10],
    ['B', 11],
    ['H', 11],
    ['C#', 1],
    ['Db', 1],
    ['F#m', 6],
    ['Dm', 2],
  ];
  for (const [input, expected] of cases) {
    it(`maps ${input} -> ${expected}`, () => {
      expect(parsePdfKeyToSemitone(input)).toBe(expected);
    });
  }
  it('returns null for unknown keys', () => {
    expect(parsePdfKeyToSemitone('Q')).toBeNull();
    expect(parsePdfKeyToSemitone('')).toBeNull();
  });
});

describe('transposeStepForKey', () => {
  it('computes diff in range (-6, 6] with wrap', () => {
    expect(transposeStepForKey(7, 0, 0)).toBe(-5);
    expect(transposeStepForKey(5, 0, 0)).toBe(5);
    expect(transposeStepForKey(2, 7, 0)).toBe(-5);
  });
  it('wraps to (-6, 6]', () => {
    expect(transposeStepForKey(8, 0, 0)).toBe(-4);
    expect(transposeStepForKey(6, 0, 0)).toBe(6);
    expect(transposeStepForKey(-1, 0, 0)).toBe(-1);
  });
  it('accounts for baseTransposeOffset', () => {
    expect(transposeStepForKey(0, 7, -1)).toBe(6);
    expect(transposeStepForKey(0, 7, 1)).toBe(4);
  });
});

describe('normalizeTransposeStep', () => {
  it('resets out-of-range steps to 0 like gyschordweb onTranspose', () => {
    expect(normalizeTransposeStep(12)).toBe(0);
    expect(normalizeTransposeStep(-12)).toBe(0);
    expect(normalizeTransposeStep(11)).toBe(11);
    expect(normalizeTransposeStep(-11)).toBe(-11);
  });
});

describe('isBlackKey', () => {
  it('detects black keys', () => {
    expect(isBlackKey(1)).toBe(true);
    expect(isBlackKey(3)).toBe(true);
    expect(isBlackKey(10)).toBe(true);
    expect(isBlackKey(0)).toBe(false);
    expect(isBlackKey(7)).toBe(false);
  });
});
