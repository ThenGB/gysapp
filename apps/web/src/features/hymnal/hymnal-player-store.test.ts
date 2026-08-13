import { describe, expect, it } from 'vitest';
import {
  clearHymnalPlayerTrack,
  getHymnalPlayerState,
  setHymnalPlayerTrack,
  updateHymnalPlayerPrefs,
} from './hymnal-player-store';

describe('hymnal player store', () => {
  it('keeps the active track available at app scope', () => {
    clearHymnalPlayerTrack();
    setHymnalPlayerTrack(
      { key: 'KR:001', url: '/001.mid', title: 'KR 001 — Test' },
      { accidentalMode: 'flat', transposeStep: 2 },
    );

    expect(getHymnalPlayerState()).toEqual({
      track: { key: 'KR:001', url: '/001.mid', title: 'KR 001 — Test' },
      accidentalMode: 'flat',
      transposeStep: 2,
    });
  });

  it('synchronizes notation and clamps transpose', () => {
    updateHymnalPlayerPrefs({ accidentalMode: 'sharp', transposeStep: 99 });
    expect(getHymnalPlayerState().accidentalMode).toBe('sharp');
    expect(getHymnalPlayerState().transposeStep).toBe(11);
  });
});
