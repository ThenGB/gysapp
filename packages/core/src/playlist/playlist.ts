export type LoopMode = 'off' | 'playlist' | 'shuffle-all' | 'shuffle-playlist';

export interface SongRef {
  book: string;
  number: string;
  title: string;
}

export interface Playlist {
  id: string;
  name: string;
  songs: SongRef[];
  createdAt: number;
}

export interface PlaylistState {
  playlists: Playlist[];
  activeId: string | null;
  loopMode: LoopMode;
}

export const PLAYLIST_STORAGE_KEY = 'gysapp.playlists.v1';

export function emptyPlaylistState(): PlaylistState {
  return { playlists: [], activeId: null, loopMode: 'off' };
}

export function createId(): string {
  return crypto.randomUUID();
}

export function songKey(song: SongRef): string {
  return `${song.book}:${song.number}`;
}

/** Buat playlist baru (dedup nama case-insensitive). */
export function createPlaylist(state: PlaylistState, name: string): PlaylistState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const id = createId();
  const playlist: Playlist = { id, name: trimmed, songs: [], createdAt: Date.now() };
  return { ...state, playlists: [...state.playlists, playlist] };
}

export function renamePlaylist(state: PlaylistState, id: string, name: string): PlaylistState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return {
    ...state,
    playlists: state.playlists.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
  };
}

export function deletePlaylist(state: PlaylistState, id: string): PlaylistState {
  return {
    ...state,
    playlists: state.playlists.filter((p) => p.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  };
}

export function setActivePlaylist(state: PlaylistState, id: string | null): PlaylistState {
  return { ...state, activeId: id };
}

export function addSongToPlaylist(
  state: PlaylistState,
  playlistId: string,
  song: SongRef,
): PlaylistState {
  return {
    ...state,
    playlists: state.playlists.map((p) =>
      p.id === playlistId && !p.songs.some((s) => songKey(s) === songKey(song))
        ? { ...p, songs: [...p.songs, song] }
        : p,
    ),
  };
}

export function removeSongFromPlaylist(
  state: PlaylistState,
  playlistId: string,
  song: SongRef,
): PlaylistState {
  return {
    ...state,
    playlists: state.playlists.map((p) =>
      p.id === playlistId
        ? { ...p, songs: p.songs.filter((s) => songKey(s) !== songKey(song)) }
        : p,
    ),
  };
}

export function moveSong(
  state: PlaylistState,
  playlistId: string,
  from: number,
  to: number,
): PlaylistState {
  return {
    ...state,
    playlists: state.playlists.map((p) => {
      if (
        p.id !== playlistId ||
        from < 0 ||
        to < 0 ||
        from >= p.songs.length ||
        to >= p.songs.length
      )
        return p;
      const songs = [...p.songs];
      const [moved] = songs.splice(from, 1);
      if (!moved) return p;
      songs.splice(to, 0, moved);
      return { ...p, songs };
    }),
  };
}

export function cycleLoopMode(mode: LoopMode): LoopMode {
  const order: LoopMode[] = ['off', 'playlist', 'shuffle-all', 'shuffle-playlist'];
  const idx = order.indexOf(mode);
  return order[(idx + 1) % order.length] as LoopMode;
}

export function parsePlaylistState(input: unknown): PlaylistState {
  if (typeof input !== 'object' || input === null) return emptyPlaylistState();
  const raw = input as Partial<PlaylistState>;
  if (!Array.isArray(raw.playlists)) return emptyPlaylistState();
  return {
    playlists: raw.playlists as Playlist[],
    activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
    loopMode: (['off', 'playlist', 'shuffle-all', 'shuffle-playlist'] as LoopMode[]).includes(
      raw.loopMode as LoopMode,
    )
      ? (raw.loopMode as LoopMode)
      : 'off',
  };
}
