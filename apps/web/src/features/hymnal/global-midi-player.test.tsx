import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SongRef } from '@gysapp/core';
import { GlobalMidiPlayerDock } from './global-midi-player';
import {
  clearHymnalPlayerTrack,
  getHymnalPlayerState,
  setHymnalPlayerTrack,
} from './hymnal-player-store';
import { refreshPlaylistState } from './playlist-store';

const { resolveSong, loadPlayableSongs } = vi.hoisted(() => ({
  resolveSong: vi.fn(),
  loadPlayableSongs: vi.fn(),
}));

vi.mock('../../data/hymnal/hymnal-catalog', () => ({
  hymnalCatalog: { resolveSong, loadPlayableSongs },
}));

vi.mock('./midi-player', () => ({
  MiniMidiPlayer: ({
    title,
    previousDisabled,
    nextDisabled,
    onPrevious,
    onNext,
  }: {
    title: string;
    previousDisabled?: boolean;
    nextDisabled?: boolean;
    onPrevious?: () => boolean | Promise<boolean>;
    onNext?: () => boolean | Promise<boolean>;
  }) => (
    <div>
      <span>{title}</span>
      <button type="button" disabled={previousDisabled} onClick={() => void onPrevious?.()}>
        Previous
      </button>
      <button type="button" disabled={nextDisabled} onClick={() => void onNext?.()}>
        Next
      </button>
    </div>
  ),
}));

const songs: SongRef[] = [
  { book: 'KR', number: '001', title: 'Satu' },
  { book: 'KR', number: '002', title: 'Dua' },
];

function seedPlaylist(loopMode: 'off' | 'playlist' | 'shuffle-all' | 'shuffle-playlist') {
  localStorage.setItem(
    'gysapp.playlists.v1',
    JSON.stringify({
      playlists: [{ id: 'p1', name: 'Ibadah', createdAt: 1, songs }],
      activeId: 'p1',
      loopMode,
    }),
  );
  refreshPlaylistState();
}

function mockResolvedSongs() {
  resolveSong.mockImplementation(async (book: string, number: string) => ({
    entry: { number, title: number === '001' ? 'Satu' : 'Dua' },
    pdfUrl: `/${number}.pdf`,
    midiUrl: `/${book}/${number}.mid`,
  }));
}

describe('GlobalMidiPlayerDock', () => {
  beforeEach(() => {
    localStorage.clear();
    refreshPlaylistState();
    clearHymnalPlayerTrack();
    resolveSong.mockReset();
    loadPlayableSongs.mockReset();
    mockResolvedSongs();
    loadPlayableSongs.mockResolvedValue(songs);
  });

  it('moves to the next playable song without changing route state', async () => {
    seedPlaylist('off');
    setHymnalPlayerTrack({ key: 'KR:001', url: '/KR/001.mid', title: 'KR 001 — Satu' });
    render(<GlobalMidiPlayerDock />);

    const next = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    await waitFor(() => expect(getHymnalPlayerState().track?.key).toBe('KR:002'));
    expect(getHymnalPlayerState().track?.url).toBe('/KR/002.mid');
  });

  it('wraps next only in playlist loop mode', async () => {
    seedPlaylist('playlist');
    setHymnalPlayerTrack({ key: 'KR:002', url: '/KR/002.mid', title: 'KR 002 — Dua' });
    render(<GlobalMidiPlayerDock />);

    const next = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    await waitFor(() => expect(getHymnalPlayerState().track?.key).toBe('KR:001'));
  });

  it('disables previous in shuffle and uses the playable catalog for shuffle-all next', async () => {
    seedPlaylist('shuffle-all');
    setHymnalPlayerTrack({ key: 'KR:001', url: '/KR/001.mid', title: 'KR 001 — Satu' });
    render(<GlobalMidiPlayerDock />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    const next = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    await waitFor(() => expect(getHymnalPlayerState().track?.key).toBe('KR:002'));
    expect(loadPlayableSongs).toHaveBeenCalledTimes(1);
  });
});
