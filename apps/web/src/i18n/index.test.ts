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
  });
});
