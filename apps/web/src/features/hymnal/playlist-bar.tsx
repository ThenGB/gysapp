import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPlus, Plus, Repeat, Trash } from '@phosphor-icons/react';
import {
  PLAYLIST_STORAGE_KEY,
  addSongToPlaylist,
  createPlaylist,
  cycleLoopMode,
  deletePlaylist,
  parsePlaylistState,
  removeSongFromPlaylist,
  setActivePlaylist,
  type PlaylistState,
  type SongRef,
} from '@gysapp/core';
import './playlist-bar.css';

function load(): PlaylistState {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    return raw ? parsePlaylistState(JSON.parse(raw)) : parsePlaylistState(null);
  } catch {
    return parsePlaylistState(null);
  }
}

export function PlaylistBar({ song, onAdded }: { song?: SongRef; onAdded?: () => void }) {
  const [state, setState] = useState<PlaylistState>(load);
  const [newName, setNewName] = useState('');

  const persist = (next: PlaylistState) => {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(next));
    setState(next);
  };

  const active = state.playlists.find((p) => p.id === state.activeId) ?? null;

  const addCurrent = () => {
    if (!song) return;
    if (!active) {
      const created = createPlaylist(state, 'Favorit');
      const id = created.playlists[0]?.id ?? null;
      persist(addSongToPlaylist({ ...created, activeId: id }, id ?? '', song));
    } else {
      persist(addSongToPlaylist(state, active.id, song));
    }
    onAdded?.();
  };

  return (
    <section className="playlist-bar" aria-label="Playlist">
      <div className="playlist-row">
        <div className="playlist-controls">
          <input
            className="faith-search playlist-name-input"
            placeholder="Nama playlist baru…"
            aria-label="Nama playlist baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                persist(createPlaylist(state, newName));
                setNewName('');
              }
            }}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Buat playlist"
            disabled={!newName.trim()}
            onClick={() => {
              persist(createPlaylist(state, newName));
              setNewName('');
            }}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          <select
            className="bible-book-select"
            aria-label="Playlist aktif"
            value={active?.id ?? ''}
            onChange={(e) => persist(setActivePlaylist(state, e.target.value || null))}
          >
            <option value="">— pilih playlist —</option>
            {state.playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.songs.length})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="chip"
            aria-pressed={state.loopMode !== 'off'}
            aria-label={`Mode ulang: ${state.loopMode}`}
            onClick={() => persist({ ...state, loopMode: cycleLoopMode(state.loopMode) })}
          >
            <Repeat size={18} aria-hidden="true" /> {state.loopMode}
          </button>
        </div>
        {song && (
          <button type="button" className="btn-primary playlist-add" onClick={addCurrent}>
            <ListPlus size={20} aria-hidden="true" /> Tambah lagu ini
          </button>
        )}
      </div>

      {active && (
        <ul className="playlist-songs">
          {active.songs.length === 0 && <li className="playlist-empty">Playlist kosong.</li>}
          {active.songs.map((s) => (
            <li key={`${s.book}:${s.number}`} className="playlist-song">
              <Link to={`/hymnal/${s.book}/${s.number}`}>
                {s.number} — {s.title}
              </Link>
              <button
                type="button"
                className="icon-btn playlist-remove"
                aria-label={`Hapus ${s.title} dari playlist`}
                onClick={() => persist(removeSongFromPlaylist(state, active.id, s))}
              >
                <Trash size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
          {active && state.playlists.length > 0 && (
            <li className="playlist-actions">
              <button
                type="button"
                className="btn-text"
                onClick={() => persist(deletePlaylist(state, active.id))}
              >
                Hapus playlist ini
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
