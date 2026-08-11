export type ThemeMode = 'system' | 'light' | 'dark';
export type Locale = 'id' | 'en' | 'zh';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  locale: Locale;
  sabatReminder: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 1,
  locale: 'id',
  sabatReminder: false,
};

const STORAGE_KEY = 'gysapp.settings.v1';

function isSettings(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<AppSettings>;
  return (
    (s.theme === 'system' || s.theme === 'light' || s.theme === 'dark') &&
    typeof s.fontSize === 'number' &&
    (s.locale === 'id' || s.locale === 'en' || s.locale === 'zh') &&
    typeof s.sabatReminder === 'boolean'
  );
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as unknown;
    return isSettings(parsed) ? { ...DEFAULT_SETTINGS, ...parsed } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Snapshot stabil untuk useSyncExternalStore: objek yang sama selama isi
// localStorage tidak berubah (identitas harus tetap agar tidak re-render).
let snapshotRaw = '';
let snapshot: AppSettings = { ...DEFAULT_SETTINGS };

export function getSettingsSnapshot(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = raw ? loadSettings() : { ...DEFAULT_SETTINGS };
  }
  return snapshot;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  emit();
}

export function updateSettings(partial: Partial<AppSettings>): void {
  const next = { ...loadSettings(), ...partial };
  saveSettings(next);
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#faf9f7',
  dark: '#1a1713',
  system: '',
};

/** Terapkan tema + skala font ke <html>. */
export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--font-scale', String(settings.fontSize));

  const resolved =
    settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : settings.theme;
  root.dataset.theme = resolved;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta)
    meta.content =
      THEME_COLORS[settings.theme] ||
      (resolved === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light);
}
