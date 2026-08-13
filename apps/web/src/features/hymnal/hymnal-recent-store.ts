import { useSyncExternalStore } from 'react';

export interface HymnalRecentEntry {
  book: string;
  song: string;
  title: string;
  openedAt: number;
}

const STORAGE_KEY = 'gysapp.hymnal.recent.v1';
const MAX_RECENT = 12;
const INVALID_SNAPSHOT_RAW = '\u0000';
const listeners = new Set<() => void>();
let snapshotRaw = INVALID_SNAPSHOT_RAW;
let snapshot: HymnalRecentEntry[] = [];

function emit(): void {
  snapshotRaw = INVALID_SNAPSHOT_RAW;
  for (const listener of listeners) listener();
}

function normalize(value: unknown): HymnalRecentEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<HymnalRecentEntry>;
  if (
    typeof item.book !== 'string' ||
    !item.book.trim() ||
    typeof item.song !== 'string' ||
    !item.song.trim() ||
    typeof item.title !== 'string' ||
    !item.title.trim()
  ) {
    return null;
  }
  return {
    book: item.book.trim(),
    song: item.song.trim(),
    title: item.title.trim(),
    openedAt:
      typeof item.openedAt === 'number' && Number.isFinite(item.openedAt)
        ? item.openedAt
        : Date.now(),
  };
}

export function loadHymnalRecent(): HymnalRecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((entry): entry is HymnalRecentEntry => entry !== null)
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function persist(entries: HymnalRecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    // Recent history is convenience state; storage failure must not block viewer.
  }
  emit();
}

export function rememberHymnalSong(entry: Omit<HymnalRecentEntry, 'openedAt'>): void {
  const normalized = normalize({ ...entry, openedAt: Date.now() });
  if (!normalized) return;
  const next = [
    normalized,
    ...loadHymnalRecent().filter(
      (item) => !(item.book === normalized.book && item.song === normalized.song),
    ),
  ].slice(0, MAX_RECENT);
  persist(next);
}

export function clearHymnalRecent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
  emit();
}

export function getHymnalRecentSnapshot(): HymnalRecentEntry[] {
  let raw = '';
  try {
    raw = localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    raw = '';
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = loadHymnalRecent();
  }
  return snapshot;
}

export function subscribeHymnalRecent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHymnalRecent(): HymnalRecentEntry[] {
  return useSyncExternalStore(
    subscribeHymnalRecent,
    getHymnalRecentSnapshot,
    getHymnalRecentSnapshot,
  );
}
