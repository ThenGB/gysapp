import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHymnalRecent,
  getHymnalRecentSnapshot,
  loadHymnalRecent,
  rememberHymnalSong,
} from './hymnal-recent-store';

describe('hymnal recent store', () => {
  beforeEach(() => {
    localStorage.clear();
    clearHymnalRecent();
    vi.restoreAllMocks();
  });

  it('persists the most recently opened song and deduplicates by book/song', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    rememberHymnalSong({ book: 'KR', song: '001', title: 'Pujilah Tuhan' });
    rememberHymnalSong({ book: 'KR', song: '001', title: 'Pujilah Tuhan (baru)' });

    expect(loadHymnalRecent()).toEqual([
      { book: 'KR', song: '001', title: 'Pujilah Tuhan (baru)', openedAt: 200 },
    ]);
  });

  it('keeps only the latest twelve songs', () => {
    for (let index = 1; index <= 15; index += 1) {
      vi.spyOn(Date, 'now').mockReturnValueOnce(index);
      rememberHymnalSong({
        book: 'KR',
        song: String(index).padStart(3, '0'),
        title: `Lagu ${index}`,
      });
    }

    const recent = loadHymnalRecent();
    expect(recent).toHaveLength(12);
    expect(recent[0]?.song).toBe('015');
    expect(recent.at(-1)?.song).toBe('004');
  });

  it('exposes an external-store snapshot and clears safely', () => {
    rememberHymnalSong({ book: 'KR', song: '010', title: 'Lagu 10' });
    expect(getHymnalRecentSnapshot()[0]?.song).toBe('010');

    clearHymnalRecent();
    expect(getHymnalRecentSnapshot()).toEqual([]);
  });
});
