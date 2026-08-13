import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, updateSettings } from './settings-store';

describe('settings reminder persistence', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes valid weekday/time reminder entries and drops invalid values', () => {
    localStorage.setItem(
      'gysapp.settings.v2',
      JSON.stringify({
        sabatReminder: true,
        bibleReminders: { 1: '07:30', 5: '20:00', 2: '25:00', 8: '08:00' },
      }),
    );
    expect(loadSettings().bibleReminders).toEqual({ 1: '07:30', 5: '20:00' });
  });

  it('persists Bible reminder schedules in the existing settings envelope', () => {
    updateSettings({ bibleReminders: { 2: '06:45', 7: '19:15' } });
    expect(loadSettings().bibleReminders).toEqual({ 2: '06:45', 7: '19:15' });
  });
});
