import { describe, expect, it } from 'vitest';
import { formatChordForDisplay, parseChordToken } from '@gysapp/core';

describe('web app core integration', () => {
  it('resolves @gysapp/core and runs chord logic', () => {
    expect(parseChordToken('F#m7')?.semitone).toBe(6);
    expect(
      formatChordForDisplay('C', {
        transposeStep: 2,
        baseTransposeOffset: 0,
        accidentalMode: 'sharp',
      }),
    ).toBe('D');
  });
});
