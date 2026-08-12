import type { BiblePackCode } from '@gysapp/core';

export interface BibleLocation {
  version: BiblePackCode;
  bookId: number;
  chapter: number;
  verse?: number;
}

export interface BibleBookmark extends BibleLocation {
  id: string;
  label: string;
  text: string;
  createdAt: number;
}

export interface BibleHistoryEntry extends BibleLocation {
  label: string;
  openedAt: number;
}

export interface BibleReadingSettings {
  split: boolean;
  syncScroll: boolean;
  secondaryVersion: BiblePackCode;
  readerScale: number;
}

interface BibleReadingState {
  last: BibleLocation;
  bookmarks: BibleBookmark[];
  history: BibleHistoryEntry[];
  settings: BibleReadingSettings;
}

const STORAGE_KEY = 'gysapp.bible.reading.v2';
const DEFAULT_STATE: BibleReadingState = {
  last: { version: 'b_tb', bookId: 1, chapter: 1 },
  bookmarks: [],
  history: [],
  settings: {
    split: false,
    syncScroll: true,
    secondaryVersion: 'b_kjv',
    readerScale: 1,
  },
};

let snapshotRaw = '';
let snapshot: BibleReadingState = structuredClone(DEFAULT_STATE);
const listeners = new Set<() => void>();

function emit(): void {
  snapshotRaw = '';
  for (const listener of listeners) listener();
}

function isVersion(value: unknown): value is BiblePackCode {
  return value === 'b_tb' || value === 'b_kjv' || value === 'b_cuv';
}

function normalizeLocation(value: unknown, fallback = DEFAULT_STATE.last): BibleLocation {
  if (!value || typeof value !== 'object') return { ...fallback };
  const item = value as Partial<BibleLocation>;
  return {
    version: isVersion(item.version) ? item.version : fallback.version,
    bookId:
      Number.isInteger(item.bookId) && Number(item.bookId) > 0
        ? Number(item.bookId)
        : fallback.bookId,
    chapter:
      Number.isInteger(item.chapter) && Number(item.chapter) > 0
        ? Number(item.chapter)
        : fallback.chapter,
    ...(Number.isInteger(item.verse) && Number(item.verse) > 0
      ? { verse: Number(item.verse) }
      : {}),
  };
}

export function loadBibleReadingState(): BibleReadingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<BibleReadingState>;
    const bookmarks = Array.isArray(parsed.bookmarks)
      ? parsed.bookmarks
          .filter((item): item is BibleBookmark => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            ...normalizeLocation(item),
            id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
            label: typeof item.label === 'string' ? item.label : 'Ayat',
            text: typeof item.text === 'string' ? item.text : '',
            createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
          }))
          .slice(0, 200)
      : [];
    const history = Array.isArray(parsed.history)
      ? parsed.history
          .filter((item): item is BibleHistoryEntry => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            ...normalizeLocation(item),
            label: typeof item.label === 'string' ? item.label : 'Alkitab',
            openedAt: Number.isFinite(item.openedAt) ? item.openedAt : Date.now(),
          }))
          .slice(0, 80)
      : [];
    const settings = parsed.settings ?? DEFAULT_STATE.settings;
    return {
      last: normalizeLocation(parsed.last),
      bookmarks,
      history,
      settings: {
        split: Boolean(settings.split),
        syncScroll: settings.syncScroll !== false,
        secondaryVersion: isVersion(settings.secondaryVersion)
          ? settings.secondaryVersion
          : DEFAULT_STATE.settings.secondaryVersion,
        readerScale:
          typeof settings.readerScale === 'number'
            ? Math.min(1.6, Math.max(0.9, settings.readerScale))
            : 1,
      },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save(state: BibleReadingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

export function getBibleReadingSnapshot(): BibleReadingState {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = loadBibleReadingState();
  }
  return snapshot;
}

export function subscribeBibleReading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateBibleReadingSettings(partial: Partial<BibleReadingSettings>): void {
  const state = loadBibleReadingState();
  save({ ...state, settings: { ...state.settings, ...partial } });
}

export function rememberBibleLocation(location: BibleLocation, label: string): void {
  const state = loadBibleReadingState();
  const normalized = normalizeLocation(location);
  const same = (entry: BibleHistoryEntry) =>
    entry.version === normalized.version &&
    entry.bookId === normalized.bookId &&
    entry.chapter === normalized.chapter;
  const history = [
    { ...normalized, label, openedAt: Date.now() },
    ...state.history.filter((entry) => !same(entry)),
  ].slice(0, 80);
  save({ ...state, last: normalized, history });
}

export function toggleBibleBookmark(bookmark: Omit<BibleBookmark, 'id' | 'createdAt'>): boolean {
  const state = loadBibleReadingState();
  const index = state.bookmarks.findIndex(
    (item) =>
      item.version === bookmark.version &&
      item.bookId === bookmark.bookId &&
      item.chapter === bookmark.chapter &&
      item.verse === bookmark.verse,
  );
  if (index >= 0) {
    save({ ...state, bookmarks: state.bookmarks.filter((_, itemIndex) => itemIndex !== index) });
    return false;
  }
  save({
    ...state,
    bookmarks: [
      {
        ...bookmark,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      },
      ...state.bookmarks,
    ].slice(0, 200),
  });
  return true;
}

export function isBibleBookmarked(location: BibleLocation): boolean {
  return loadBibleReadingState().bookmarks.some(
    (item) =>
      item.version === location.version &&
      item.bookId === location.bookId &&
      item.chapter === location.chapter &&
      item.verse === location.verse,
  );
}
