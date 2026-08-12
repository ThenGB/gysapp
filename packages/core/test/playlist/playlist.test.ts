import { describe, expect, it } from 'vitest';
import {
  PLAYLIST_STORAGE_KEY,
  addSongToPlaylist,
  createPlaylist,
  cycleLoopMode,
  deletePlaylist,
  emptyPlaylistState,
  moveSong,
  parsePlaylistState,
  removeSongFromPlaylist,
  renamePlaylist,
  setActivePlaylist,
  type PlaylistState,
  type SongRef,
} from '../../src/playlist/playlist';

const songA: SongRef = { book: 'KR', number: '001', title: 'Pujilah Allah' };
const songB: SongRef = { book: 'KR', number: '002', title: 'Pujilah Yang Mahakudus' };

describe('playlist core', () => {
  it('creates playlists with unique ids, trims names, and deduplicates names', () => {
    const state = createPlaylist(emptyPlaylistState(), '  Ibadah Pagi ');
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0]?.name).toBe('Ibadah Pagi');
    expect(createPlaylist(state, '').playlists).toHaveLength(1);
    expect(createPlaylist(state, 'ibadah pagi').playlists).toHaveLength(1);
  });

  it('renames without allowing a duplicate name', () => {
    let state = createPlaylist(emptyPlaylistState(), 'Pagi');
    state = createPlaylist(state, 'Malam');
    const first = state.playlists[0]!.id;
    const second = state.playlists[1]!.id;
    state = renamePlaylist(state, first, 'Pagi Baru');
    expect(state.playlists[0]?.name).toBe('Pagi Baru');
    state = renamePlaylist(state, second, 'pagi baru');
    expect(state.playlists[1]?.name).toBe('Malam');
  });

  it('adds songs without duplicates', () => {
    let state: PlaylistState = createPlaylist(emptyPlaylistState(), 'P1');
    const id = state.playlists[0]!.id;
    state = addSongToPlaylist(state, id, songA);
    state = addSongToPlaylist(state, id, songA);
    state = addSongToPlaylist(state, id, songB);
    expect(state.playlists[0]?.songs).toHaveLength(2);
  });

  it('removes songs and reorders', () => {
    let state: PlaylistState = createPlaylist(emptyPlaylistState(), 'P1');
    const id = state.playlists[0]!.id;
    state = addSongToPlaylist(state, id, songA);
    state = addSongToPlaylist(state, id, songB);
    state = moveSong(state, id, 1, 0);
    expect(state.playlists[0]?.songs[0]?.number).toBe('002');
    state = removeSongFromPlaylist(state, id, songB);
    expect(state.playlists[0]?.songs).toHaveLength(1);
  });

  it('deletes playlists and clears active reference', () => {
    let state: PlaylistState = createPlaylist(emptyPlaylistState(), 'P1');
    const id = state.playlists[0]!.id;
    state = setActivePlaylist(state, id);
    state = deletePlaylist(state, id);
    expect(state.playlists).toHaveLength(0);
    expect(state.activeId).toBeNull();
  });

  it('cycles loop modes in order', () => {
    expect(cycleLoopMode('off')).toBe('playlist');
    expect(cycleLoopMode('playlist')).toBe('shuffle-all');
    expect(cycleLoopMode('shuffle-all')).toBe('shuffle-playlist');
    expect(cycleLoopMode('shuffle-playlist')).toBe('off');
  });

  it('parses persisted state and rejects garbage', () => {
    const valid: PlaylistState = {
      playlists: [{ id: 'x', name: 'P', songs: [songA], createdAt: 1 }],
      activeId: 'x',
      loopMode: 'shuffle-all',
    };
    expect(parsePlaylistState(valid)).toEqual(valid);
    expect(parsePlaylistState(null)).toEqual(emptyPlaylistState());
    expect(parsePlaylistState({ playlists: 'nope' })).toEqual(emptyPlaylistState());
    expect(parsePlaylistState({ playlists: [], loopMode: 'bogus' }).loopMode).toBe('off');
  });

  it('exposes stable storage key', () => {
    expect(PLAYLIST_STORAGE_KEY).toBe('gysapp.playlists.v1');
  });
});
