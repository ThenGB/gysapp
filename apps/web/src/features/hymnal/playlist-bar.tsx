import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ListPlus, Plus, Repeat, Trash } from '@phosphor-icons/react';
import {
  addSongToPlaylist,
  createPlaylist,
  cycleLoopMode,
  deletePlaylist,
  moveSong,
  removeSongFromPlaylist,
  renamePlaylist,
  setActivePlaylist,
  songKey,
  type LoopMode,
  type PlaylistState,
  type SongRef,
} from '@gysapp/core';
import { persistPlaylistState, usePlaylistState } from './playlist-store';
import './playlist-bar.css';

const LOOP_LABELS: Record<LoopMode, string> = {
  off: 'Tanpa ulang',
  playlist: 'Ulang playlist',
  'shuffle-all': 'Acak semua',
  'shuffle-playlist': 'Acak playlist',
};

export function PlaylistBar({ song, onAdded }: { song?: SongRef; onAdded?: () => void }) {
  const state = usePlaylistState();
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const persist = (next: PlaylistState) => persistPlaylistState(next);
  const active = state.playlists.find((playlist) => playlist.id === state.activeId) ?? null;
  const songAlreadyAdded =
    !!song && !!active?.songs.some((candidate) => songKey(candidate) === songKey(song));

  const createNamedPlaylist = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const existing = state.playlists.find(
      (playlist) => playlist.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
    );
    if (existing) {
      persist(setActivePlaylist(state, existing.id));
      setNewName('');
      return;
    }
    const created = createPlaylist(state, trimmed);
    const next = created.playlists.at(-1);
    persist(next ? setActivePlaylist(created, next.id) : created);
    setNewName('');
  };

  const addCurrent = () => {
    if (!song) return;
    if (!active) {
      const created = createPlaylist(state, 'Favorit');
      const favorite =
        created.playlists.find((playlist) => playlist.name.toLocaleLowerCase() === 'favorit') ??
        created.playlists.at(-1);
      if (!favorite) return;
      persist(addSongToPlaylist(setActivePlaylist(created, favorite.id), favorite.id, song));
    } else {
      persist(addSongToPlaylist(state, active.id, song));
    }
    onAdded?.();
  };

  const startRename = () => {
    if (!active) return;
    setRenameValue(active.name);
    setRenaming(true);
  };

  const commitRename = () => {
    if (!active) return;
    const trimmed = renameValue.trim();
    if (trimmed) persist(renamePlaylist(state, active.id, trimmed));
    setRenaming(false);
  };

  return (
    <section className="playlist-bar" aria-label="Playlist pujian">
      <div className="playlist-heading">
        <div>
          <p className="playlist-eyebrow">Playlist</p>
          <h2>Susun urutan pujian</h2>
        </div>
        {active && <span className="playlist-count">{active.songs.length} lagu</span>}
      </div>

      <div className="playlist-row">
        <div className="playlist-controls">
          <div className="playlist-create-row">
            <input
              className="faith-search playlist-name-input"
              placeholder="Nama playlist baru…"
              aria-label="Nama playlist baru"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createNamedPlaylist();
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Buat playlist"
              disabled={!newName.trim()}
              onClick={createNamedPlaylist}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>

          <select
            className="bible-book-select playlist-select"
            aria-label="Playlist aktif"
            value={active?.id ?? ''}
            onChange={(event) => {
              persist(setActivePlaylist(state, event.target.value || null));
              setRenaming(false);
            }}
          >
            <option value="">— pilih playlist —</option>
            {state.playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name} ({playlist.songs.length})
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`chip${state.loopMode !== 'off' ? ' chip-active' : ''}`}
            aria-pressed={state.loopMode !== 'off'}
            aria-label={`Mode putar: ${LOOP_LABELS[state.loopMode]}`}
            onClick={() => persist({ ...state, loopMode: cycleLoopMode(state.loopMode) })}
          >
            <Repeat size={18} aria-hidden="true" /> {LOOP_LABELS[state.loopMode]}
          </button>
        </div>

        {song && (
          <button
            type="button"
            className="btn-primary playlist-add"
            disabled={songAlreadyAdded}
            onClick={addCurrent}
          >
            {songAlreadyAdded ? (
              <>
                <Check size={20} aria-hidden="true" /> Sudah ada
              </>
            ) : (
              <>
                <ListPlus size={20} aria-hidden="true" /> Tambah lagu ini
              </>
            )}
          </button>
        )}
      </div>

      {active && (
        <div className="playlist-editor">
          <div className="playlist-active-header">
            {renaming ? (
              <div className="playlist-rename-row">
                <input
                  className="faith-search"
                  aria-label="Ubah nama playlist"
                  value={renameValue}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') setRenaming(false);
                  }}
                />
                <button type="button" className="btn-secondary" onClick={commitRename}>
                  Simpan
                </button>
              </div>
            ) : (
              <button type="button" className="btn-text playlist-rename" onClick={startRename}>
                Ubah nama “{active.name}”
              </button>
            )}
          </div>

          <ol className="playlist-songs">
            {active.songs.length === 0 && (
              <li className="playlist-empty">Playlist masih kosong. Tambahkan lagu dari viewer.</li>
            )}
            {active.songs.map((playlistSong, index) => (
              <li key={songKey(playlistSong)} className="playlist-song">
                <span className="playlist-position" aria-hidden="true">
                  {index + 1}
                </span>
                <Link to={`/hymnal/${playlistSong.book}/${playlistSong.number}`}>
                  <strong>{playlistSong.number}</strong>
                  <span>{playlistSong.title}</span>
                </Link>
                <div className="playlist-song-actions" aria-label={`Atur ${playlistSong.title}`}>
                  <button
                    type="button"
                    className="icon-btn playlist-move"
                    aria-label={`Naikkan ${playlistSong.title}`}
                    disabled={index === 0}
                    onClick={() => persist(moveSong(state, active.id, index, index - 1))}
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn playlist-move"
                    aria-label={`Turunkan ${playlistSong.title}`}
                    disabled={index === active.songs.length - 1}
                    onClick={() => persist(moveSong(state, active.id, index, index + 1))}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn playlist-remove"
                    aria-label={`Hapus ${playlistSong.title} dari playlist`}
                    onClick={() => persist(removeSongFromPlaylist(state, active.id, playlistSong))}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <div className="playlist-actions">
            <button
              type="button"
              className="btn-text playlist-delete"
              onClick={() => {
                persist(deletePlaylist(state, active.id));
                setRenaming(false);
              }}
            >
              <Trash size={17} aria-hidden="true" /> Hapus playlist ini
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
