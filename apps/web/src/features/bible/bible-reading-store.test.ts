import { beforeEach, describe, expect, it } from 'vitest';
import {
  getBibleReadingSnapshot,
  isBibleBookmarked,
  rememberBibleLocation,
  toggleBibleBookmark,
  updateBibleReadingSettings,
} from './bible-reading-store';

describe('Bible reading store', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the latest chapter and deduplicates history', () => {
    rememberBibleLocation({ version: 'b_tb', bookId: 43, chapter: 3 }, 'Yohanes 3');
    rememberBibleLocation({ version: 'b_tb', bookId: 43, chapter: 3 }, 'Yohanes 3');
    const state = getBibleReadingSnapshot();
    expect(state.last).toMatchObject({ version: 'b_tb', bookId: 43, chapter: 3 });
    expect(state.history).toHaveLength(1);
  });

  it('toggles bookmarks and persists split preferences', () => {
    const location = { version: 'b_tb' as const, bookId: 43, chapter: 3, verse: 16 };
    expect(
      toggleBibleBookmark({
        ...location,
        label: 'Yohanes 3:16',
        text: 'Karena begitu besar kasih Allah',
      }),
    ).toBe(true);
    expect(isBibleBookmarked(location)).toBe(true);
    updateBibleReadingSettings({ split: true, syncScroll: false, readerScale: 1.3 });
    expect(getBibleReadingSnapshot().settings).toMatchObject({
      split: true,
      syncScroll: false,
      readerScale: 1.3,
    });
  });
});
