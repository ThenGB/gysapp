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
  });
});
