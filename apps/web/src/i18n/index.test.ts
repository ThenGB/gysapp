import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('i18n dictionaries', () => {
  it('translates the primary release journeys in Indonesian, English, and Chinese', () => {
    expect(t('continueReading', 'id')).toBe('Lanjutkan bacaan');
    expect(t('continueReading', 'en')).toBe('Continue reading');
    expect(t('continueReading', 'zh')).toBe('继续读经');

    expect(t('literatureGuide', 'id')).toBe('Panduan Alkitab');
    expect(t('literatureGuide', 'en')).toBe('Bible Study Guides');
    expect(t('literatureGuide', 'zh')).toBe('圣经学习指南');

    expect(t('copySelection', 'id')).toBe('Salin pilihan');
    expect(t('copySelection', 'en')).toBe('Copy selection');
    expect(t('copySelection', 'zh')).toBe('复制所选');

    expect(t('themeDark', 'id')).toBe('Gelap');
    expect(t('themeDark', 'en')).toBe('Dark');
    expect(t('themeDark', 'zh')).toBe('深色');

    expect(t('openEgysSite', 'id')).toBe('Buka situs e-GYS');
    expect(t('openEgysSite', 'en')).toBe('Open e-GYS website');
    expect(t('openEgysSite', 'zh')).toBe('打开 e-GYS 网站');

    expect(t('sendFeedback', 'id')).toBe('Kirim Masukan');
    expect(t('sendFeedback', 'en')).toBe('Send Feedback');
    expect(t('sendFeedback', 'zh')).toBe('发送反馈');

    expect(t('notesTitle', 'id')).toBe('Catatan');
    expect(t('notesTitle', 'en')).toBe('Notes');
    expect(t('notesTitle', 'zh')).toBe('笔记');

    expect(t('searchHymn', 'id')).toBe('Cari pujian');
    expect(t('searchHymn', 'en')).toBe('Search hymns');
    expect(t('searchHymn', 'zh')).toBe('搜索赞美诗');

    expect(t('manageBibleLibrary', 'id')).toBe('Kelola Alkitab');
    expect(t('manageBibleLibrary', 'en')).toBe('Manage Bible');
    expect(t('manageBibleLibrary', 'zh')).toBe('管理圣经');

    expect(t('searchVerseTitle', 'id')).toBe('Cari Ayat');
    expect(t('searchVerseTitle', 'en')).toBe('Search Verses');
    expect(t('searchVerseTitle', 'zh')).toBe('搜索经文');

    expect(t('bibleReminder', 'id')).toBe('Pengingat baca Alkitab');
    expect(t('bibleReminder', 'en')).toBe('Bible reading reminders');
    expect(t('bibleReminder', 'zh')).toBe('读经提醒');
  });
});
