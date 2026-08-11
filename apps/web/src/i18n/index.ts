import { useSyncExternalStore } from 'react';
import {
  loadSettings,
  subscribeSettings,
  updateSettings,
  type Locale,
} from '../features/settings/settings-store';

export { subscribeSettings } from '../features/settings/settings-store';

const dictionaries = {
  id: {
    home: 'Beranda',
    bible: 'Alkitab',
    hymnal: 'Pujian',
    faith: 'Iman',
    more: 'Lainnya',
    shalom: 'Shalom',
    retry: 'Coba lagi',
    open: 'Buka',
    readMore: 'Baca selengkapnya',
    search: 'Cari',
    back: 'Kembali',
    settings: 'Pengaturan',
  },
  en: {
    home: 'Home',
    bible: 'Bible',
    hymnal: 'Hymns',
    faith: 'Faith',
    more: 'More',
    shalom: 'Shalom',
    retry: 'Retry',
    open: 'Open',
    readMore: 'Read more',
    search: 'Search',
    back: 'Back',
    settings: 'Settings',
  },
  zh: {
    home: '首页',
    bible: '圣经',
    hymnal: '赞美诗',
    faith: '信仰',
    more: '更多',
    shalom: '沙伦',
    retry: '重试',
    open: '打开',
    readMore: '阅读全文',
    search: '搜索',
    back: '返回',
    settings: '设置',
  },
} as const;

export type TranslationKey = keyof (typeof dictionaries)['id'];

export function setLocale(locale: Locale): void {
  updateSettings({ locale });
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeSettings, () => loadSettings().locale);
}

export function t(key: TranslationKey, locale: Locale): string {
  return dictionaries[locale][key];
}

/** Hook i18n: terjemahan + locale saat ini. */
export function useT() {
  const locale = useLocale();
  return { locale, t: (key: TranslationKey) => t(key, locale) };
}
