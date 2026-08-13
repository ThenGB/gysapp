import { useSyncExternalStore } from 'react';

export type HymnalAccidentalMode = 'sharp' | 'flat';

export type HymnalPlayerTrack = {
  key: string;
  url: string;
  title: string;
};

export type HymnalPlayerState = {
  track: HymnalPlayerTrack | null;
  accidentalMode: HymnalAccidentalMode;
  transposeStep: number;
};

type ActiveHymnalPlayerState = Omit<HymnalPlayerState, 'track'> & {
  track: HymnalPlayerTrack;
};

let state: HymnalPlayerState = {
  track: null,
  accidentalMode: 'sharp',
  transposeStep: 0,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function clampTranspose(step: number): number {
  return Math.max(-11, Math.min(11, Math.round(step)));
}

export function setHymnalPlayerTrack(
  track: HymnalPlayerTrack,
  prefs?: Partial<Pick<HymnalPlayerState, 'accidentalMode' | 'transposeStep'>>,
): void {
  const next: ActiveHymnalPlayerState = {
    track,
    accidentalMode: prefs?.accidentalMode ?? state.accidentalMode,
    transposeStep: clampTranspose(prefs?.transposeStep ?? state.transposeStep),
  };
  if (
    state.track?.key === next.track.key &&
    state.track?.url === next.track.url &&
    state.track?.title === next.track.title &&
    state.accidentalMode === next.accidentalMode &&
    state.transposeStep === next.transposeStep
  ) {
    return;
  }
  state = next;
  emit();
}

export function updateHymnalPlayerPrefs(
  prefs: Partial<Pick<HymnalPlayerState, 'accidentalMode' | 'transposeStep'>>,
): void {
  const next: HymnalPlayerState = {
    ...state,
    accidentalMode: prefs.accidentalMode ?? state.accidentalMode,
    transposeStep:
      prefs.transposeStep === undefined ? state.transposeStep : clampTranspose(prefs.transposeStep),
  };
  if (next.accidentalMode === state.accidentalMode && next.transposeStep === state.transposeStep) {
    return;
  }
  state = next;
  emit();
}

export function clearHymnalPlayerTrack(): void {
  if (!state.track) return;
  state = { ...state, track: null };
  emit();
}

export function getHymnalPlayerState(): HymnalPlayerState {
  return state;
}

export function subscribeHymnalPlayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHymnalPlayerState(): HymnalPlayerState {
  return useSyncExternalStore(subscribeHymnalPlayer, getHymnalPlayerState, getHymnalPlayerState);
}
