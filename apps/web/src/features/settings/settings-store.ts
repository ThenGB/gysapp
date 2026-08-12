export type ThemeMode = 'system' | 'light' | 'dark';
export type Locale = 'id' | 'en' | 'zh';
export type ComfortPreset = 'standard' | 'comfortable' | 'large';

export interface AppSettings {
  theme: ThemeMode;
  locale: Locale;
  sabatReminder: boolean;
  comfortPreset: ComfortPreset;
  uiScale: number;
  readerScale: number;
  readerLineHeight: number;
  largeTargets: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  locale: 'id',
  sabatReminder: false,
  comfortPreset: 'standard',
  uiScale: 1,
  readerScale: 1,
  readerLineHeight: 1.7,
  largeTargets: false,
  highContrast: false,
  reduceMotion: false,
};

export const COMFORT_PRESETS: Record<
  ComfortPreset,
  Pick<AppSettings, 'uiScale' | 'readerScale' | 'readerLineHeight' | 'largeTargets'>
> = {
  standard: { uiScale: 1, readerScale: 1, readerLineHeight: 1.7, largeTargets: false },
  comfortable: { uiScale: 1.05, readerScale: 1.15, readerLineHeight: 1.78, largeTargets: true },
  large: { uiScale: 1.12, readerScale: 1.35, readerLineHeight: 1.85, largeTargets: true },
};

const STORAGE_KEY = 'gysapp.settings.v2';
const LEGACY_STORAGE_KEY = 'gysapp.settings.v1';

function validTheme(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function validLocale(value: unknown): value is Locale {
  return value === 'id' || value === 'en' || value === 'zh';
}

function validPreset(value: unknown): value is ComfortPreset {
  return value === 'standard' || value === 'comfortable' || value === 'large';
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalize(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const s = value as Partial<AppSettings> & { fontSize?: number };
  const preset = validPreset(s.comfortPreset) ? s.comfortPreset : 'standard';
  const defaults = COMFORT_PRESETS[preset];
  return {
    theme: validTheme(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    locale: validLocale(s.locale) ? s.locale : DEFAULT_SETTINGS.locale,
    sabatReminder: typeof s.sabatReminder === 'boolean' ? s.sabatReminder : false,
    comfortPreset: preset,
    uiScale: clamp(s.uiScale ?? s.fontSize, 0.9, 1.3, defaults.uiScale),
    readerScale: clamp(s.readerScale, 0.9, 1.6, defaults.readerScale),
    readerLineHeight: clamp(s.readerLineHeight, 1.5, 2, defaults.readerLineHeight),
    largeTargets: typeof s.largeTargets === 'boolean' ? s.largeTargets : defaults.largeTargets,
    highContrast: Boolean(s.highContrast),
    reduceMotion: Boolean(s.reduceMotion),
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = normalize(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Corrupt settings should never block app startup.
  }
  return { ...DEFAULT_SETTINGS };
}

let snapshotRaw = '';
let snapshot: AppSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

function emit(): void {
  snapshotRaw = '';
  for (const listener of listeners) listener();
}

export function getSettingsSnapshot(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '';
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = loadSettings();
  }
  return snapshot;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(settings)));
  emit();
}

export function updateSettings(partial: Partial<AppSettings>): void {
  saveSettings({ ...loadSettings(), ...partial });
}

export function applyComfortPreset(preset: ComfortPreset): AppSettings {
  const next = { ...loadSettings(), comfortPreset: preset, ...COMFORT_PRESETS[preset] };
  saveSettings(next);
  return next;
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

/** Apply visual/accessibility settings as design-system tokens and data attributes. */
export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--font-scale', String(settings.uiScale));
  root.style.setProperty('--reader-scale', String(settings.readerScale));
  root.style.setProperty('--reader-line-height', String(settings.readerLineHeight));
  root.dataset.largeTargets = String(settings.largeTargets);
  root.dataset.highContrast = String(settings.highContrast);
  root.dataset.reduceMotion = String(settings.reduceMotion);
  root.dataset.comfort = settings.comfortPreset;

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
