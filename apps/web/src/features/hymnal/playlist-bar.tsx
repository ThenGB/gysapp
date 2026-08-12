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
import { useT, type TranslationKey } from '../../i18n';
import { persistPlaylistState, usePlaylistState } from './playlist-store';
import './playlist-bar.css';

const LOOP_KEYS: Record<LoopMode, TranslationKey> = {
  off: 'loopOff',
  playlist: 'loopPlaylist',
  'shuffle-all': 'shuffleAll',
  'shuffle-playlist': 'shufflePlaylist',
};

export function PlaylistBar({ song, onAdded }: { song?: SongRef; onAdded?: () => void }) {
  const { t } = useT();
  const state = usePlaylistState();
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const persist = (next: PlaylistState) => persistPlaylistState(next);
  const active = state.playlists.find((playlist) => playlist.id === state.activeId) ?? null;
  const songAlreadyAdded =
    !!song && !!active?.songs.some((candidate) => songKey(candidate) === songKey(song));
  const loopLabel = t(LOOP_KEYS[state.loopMode]);

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
    <section className="playlist-bar" aria-label={t('playlistLabel')}>
      <div className="playlist-heading">
        <div>
          <p className="playlist-eyebrow">Playlist</p>
          <h2>{t('arrangeHymns')}</h2>
        </div>
        {active && (
          <span className="playlist-count">
            {active.songs.length} {t(active.songs.length === 1 ? 'songSingular' : 'songPlural')}
          </span>
        )}
      </div>

      <div className="playlist-row">
        <div className="playlist-controls">
          <div className="playlist-create-row">
            <input
              className="faith-search playlist-name-input"
              placeholder={t('newPlaylistName')}
              aria-label={t('newPlaylistNameLabel')}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createNamedPlaylist();
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={t('createPlaylist')}
              disabled={!newName.trim()}
              onClick={createNamedPlaylist}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>

          <select
            className="bible-book-select playlist-select"
            aria-label={t('activePlaylist')}
            value={active?.id ?? ''}
            onChange={(event) => {
              persist(setActivePlaylist(state, event.target.value || null));
              setRenaming(false);
            }}
          >
            <option value="">{t('choosePlaylist')}</option>
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
            aria-label={`${t('playMode')}: ${loopLabel}`}
            onClick={() => persist({ ...state, loopMode: cycleLoopMode(state.loopMode) })}
          >
            <Repeat size={18} aria-hidden="true" /> {loopLabel}
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
                <Check size={20} aria-hidden="true" /> {t('alreadyAdded')}
              </>
            ) : (
              <>
                <ListPlus size={20} aria-hidden="true" /> {t('addThisHymn')}
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
                  aria-label={t('renamePlaylist')}
                  value={renameValue}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') setRenaming(false);
                  }}
                />
                <button type="button" className="btn-secondary" onClick={commitRename}>
                  {t('save')}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-text playlist-rename" onClick={startRename}>
                {t('renameActivePlaylist')} “{active.name}”
              </button>
            )}
          </div>

          <ol className="playlist-songs">
            {active.songs.length === 0 && <li className="playlist-empty">{t('playlistEmpty')}</li>}
            {active.songs.map((playlistSong, index) => (
              <li key={songKey(playlistSong)} className="playlist-song">
                <span className="playlist-position" aria-hidden="true">
                  {index + 1}
                </span>
                <Link to={`/hymnal/${playlistSong.book}/${playlistSong.number}`}>
                  <strong>{playlistSong.number}</strong>
                  <span>{playlistSong.title}</span>
                </Link>
                <div
                  className="playlist-song-actions"
                  aria-label={`${t('manageSong')} ${playlistSong.title}`}
                >
                  <button
                    type="button"
                    className="icon-btn playlist-move"
                    aria-label={`${t('moveUp')} ${playlistSong.title}`}
                    disabled={index === 0}
                    onClick={() => persist(moveSong(state, active.id, index, index - 1))}
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn playlist-move"
                    aria-label={`${t('moveDown')} ${playlistSong.title}`}
                    disabled={index === active.songs.length - 1}
                    onClick={() => persist(moveSong(state, active.id, index, index + 1))}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn playlist-remove"
                    aria-label={`${t('removeFromPlaylist')} ${playlistSong.title}`}
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
              <Trash size={17} aria-hidden="true" /> {t('deleteThisPlaylist')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
