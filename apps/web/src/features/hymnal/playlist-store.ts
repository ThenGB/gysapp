import { useSyncExternalStore } from 'react';
import {
  PLAYLIST_STORAGE_KEY,
  emptyPlaylistState,
  parsePlaylistState,
  type PlaylistState,
} from '@gysapp/core';

const CHANGE_EVENT = 'gysapp:playlist-change';

let state: PlaylistState = emptyPlaylistState();
let hydrated = false;

function readPersisted(): PlaylistState {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    return raw ? parsePlaylistState(JSON.parse(raw)) : emptyPlaylistState();
  } catch {
    return emptyPlaylistState();
  }
}

function hydrate(): void {
  if (hydrated) return;
  state = readPersisted();
  hydrated = true;
}

function emit(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getPlaylistState(): PlaylistState {
  hydrate();
  return state;
}

export function persistPlaylistState(next: PlaylistState): void {
  state = next;
  hydrated = true;
  try {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // State memory tetap usable ketika storage browser diblok.
  }
  emit();
}

export function updatePlaylistState(transform: (current: PlaylistState) => PlaylistState): void {
  persistPlaylistState(transform(getPlaylistState()));
}

export function refreshPlaylistState(): void {
  state = readPersisted();
  hydrated = true;
  emit();
}

export function subscribePlaylistState(listener: () => void): () => void {
  const onLocalChange = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PLAYLIST_STORAGE_KEY) return;
    state = event.newValue
      ? (() => {
          try {
            return parsePlaylistState(JSON.parse(event.newValue));
          } catch {
            return emptyPlaylistState();
          }
        })()
      : emptyPlaylistState();
    hydrated = true;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePlaylistState(): PlaylistState {
  return useSyncExternalStore(subscribePlaylistState, getPlaylistState, getPlaylistState);
}
