import { useEffect, useMemo, useState } from 'react';
import { adjacentSong, randomOtherSong, songKey, type SongRef } from '@gysapp/core';
import { hymnalCatalog } from '../../data/hymnal/hymnal-catalog';
import { MiniMidiPlayer } from './midi-player';
import {
  setHymnalPlayerTrack,
  updateHymnalPlayerPrefs,
  useHymnalPlayerState,
} from './hymnal-player-store';
import { usePlaylistState } from './playlist-store';
import './global-midi-player.css';

export function GlobalMidiPlayerDock() {
  const player = useHymnalPlayerState();
  const playlists = usePlaylistState();
  const [playlistPlayable, setPlaylistPlayable] = useState<SongRef[]>([]);
  const [allPlayable, setAllPlayable] = useState<SongRef[]>([]);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const activePlaylist = useMemo(
    () => playlists.playlists.find((playlist) => playlist.id === playlists.activeId) ?? null,
    [playlists.activeId, playlists.playlists],
  );

  useEffect(() => {
    let cancelled = false;
    setPlaylistPlayable([]);
    if (!activePlaylist) {
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      activePlaylist.songs.map(async (song) => {
        try {
          const resolved = await hymnalCatalog.resolveSong(song.book, song.number);
          return resolved?.midiUrl ? song : null;
        } catch {
          return null;
        }
      }),
    ).then((songs) => {
      if (!cancelled) setPlaylistPlayable(songs.filter((song): song is SongRef => song !== null));
    });

    return () => {
      cancelled = true;
    };
  }, [activePlaylist]);

  useEffect(() => {
    let cancelled = false;
    if (playlists.loopMode !== 'shuffle-all') return () => undefined;
    void hymnalCatalog
      .loadPlayableSongs()
      .then((songs) => {
        if (!cancelled) setAllPlayable(songs);
      })
      .catch(() => {
        if (!cancelled) setAllPlayable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [playlists.loopMode]);

  const track = player.track;
  if (!track) return null;

  const wrapPlaylist = playlists.loopMode === 'playlist';
  const orderedNavigation = playlists.loopMode === 'off' || playlists.loopMode === 'playlist';
  const previousSong = orderedNavigation
    ? adjacentSong(playlistPlayable, track.key, 'previous', wrapPlaylist)
    : null;
  const nextSong = orderedNavigation
    ? adjacentSong(playlistPlayable, track.key, 'next', wrapPlaylist)
    : null;

  const switchToSong = async (song: SongRef | null): Promise<boolean> => {
    if (!song || navigationLoading) return false;
    setNavigationLoading(true);
    try {
      const resolved = await hymnalCatalog.resolveSong(song.book, song.number);
      if (!resolved?.midiUrl) return false;
      setHymnalPlayerTrack({
        key: songKey(song),
        url: resolved.midiUrl,
        title: `${song.book} ${resolved.entry.number} — ${resolved.entry.title}`,
      });
      return true;
    } finally {
      setNavigationLoading(false);
    }
  };

  const movePrevious = () => switchToSong(previousSong);
  const moveNext = () => {
    if (playlists.loopMode === 'shuffle-playlist') {
      return switchToSong(randomOtherSong(playlistPlayable, track.key));
    }
    if (playlists.loopMode === 'shuffle-all') {
      return switchToSong(randomOtherSong(allPlayable, track.key));
    }
    return switchToSong(nextSong);
  };

  const previousDisabled =
    navigationLoading || !orderedNavigation || previousSong === null || playlistPlayable.length < 2;
  const nextDisabled = (() => {
    if (navigationLoading) return true;
    if (playlists.loopMode === 'shuffle-all') {
      return allPlayable.filter((song) => songKey(song) !== track.key).length === 0;
    }
    if (playlists.loopMode === 'shuffle-playlist') {
      return playlistPlayable.filter((song) => songKey(song) !== track.key).length === 0;
    }
    return nextSong === null;
  })();

  return (
    <aside className="global-midi-dock" aria-label="Pemutar pujian aktif">
      <MiniMidiPlayer
        compact
        url={track.url}
        title={track.title}
        accidentalMode={player.accidentalMode}
        transposeStep={player.transposeStep}
        previousDisabled={previousDisabled}
        nextDisabled={nextDisabled}
        onPrevious={movePrevious}
        onNext={moveNext}
        onAccidentalModeChange={(accidentalMode) => updateHymnalPlayerPrefs({ accidentalMode })}
        onTransposeChange={(transposeStep) => updateHymnalPlayerPrefs({ transposeStep })}
      />
    </aside>
  );
}
