import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GYS_REMINDER_NOTIFICATION_IDS,
  SABAT_NOTIFICATION_ID,
  applyNativeReminderSettings,
  cancelAllGysReminders,
  isNativeReminderAvailable,
} from './scheduled-notifications';

type TestWindow = Window & { __TAURI__?: unknown };

function installApi(permission = true) {
  const interval = vi.fn((value, allowWhileIdle = false) => ({
    at: undefined,
    interval: { interval: value, allowWhileIdle },
    every: undefined,
  }));
  const api = {
    Schedule: { interval },
    isPermissionGranted: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
    sendNotification: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, '__TAURI__', {
    configurable: true,
    writable: true,
    value: { notification: api },
  });
  return api;
}

const copy = {
  sabatTitle: 'Sabbath',
  sabatBody: 'Prepare',
  bibleTitle: 'Bible',
  bibleBody: 'Read',
};

afterEach(() => {
  delete (window as TestWindow).__TAURI__;
  vi.restoreAllMocks();
});

describe('scheduled notifications adapter', () => {
  it('reports unsupported outside Tauri', () => {
    expect(isNativeReminderAvailable()).toBe(false);
  });

  it('schedules Friday Sabbath and maps ISO Monday/Sunday to Tauri weekdays', async () => {
    const api = installApi();
    const status = await applyNativeReminderSettings(
      { sabatReminder: true, bibleReminders: { 1: '07:15', 7: '20:30' } },
      copy,
    );

    expect(status).toBe('scheduled');
    expect(api.cancel).toHaveBeenCalledWith(GYS_REMINDER_NOTIFICATION_IDS);
    expect(api.sendNotification).toHaveBeenCalledTimes(3);
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SABAT_NOTIFICATION_ID,
        schedule: expect.objectContaining({
          interval: expect.objectContaining({
            interval: expect.objectContaining({ weekday: 6, hour: 17, minute: 0 }),
          }),
        }),
      }),
    );
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 321001,
        schedule: expect.objectContaining({
          interval: expect.objectContaining({
            interval: expect.objectContaining({ weekday: 2, hour: 7, minute: 15 }),
          }),
        }),
      }),
    );
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 321007,
        schedule: expect.objectContaining({
          interval: expect.objectContaining({
            interval: expect.objectContaining({ weekday: 1, hour: 20, minute: 30 }),
          }),
        }),
      }),
    );
  });

  it('requests permission before creating active schedules', async () => {
    const api = installApi(false);
    await expect(
      applyNativeReminderSettings({ sabatReminder: true, bibleReminders: {} }, copy, true),
    ).resolves.toBe('scheduled');
    expect(api.requestPermission).toHaveBeenCalledOnce();
  });

  it('does not replace existing schedules when permission is denied', async () => {
    const api = installApi(false);
    api.requestPermission.mockResolvedValue('denied');
    await expect(
      applyNativeReminderSettings({ sabatReminder: true, bibleReminders: {} }, copy, true),
    ).resolves.toBe('permission-denied');
    expect(api.cancel).not.toHaveBeenCalled();
    expect(api.sendNotification).not.toHaveBeenCalled();
  });

  it('can cancel all GYSApp-owned reminder ids without requesting permission', async () => {
    const api = installApi(false);
    await cancelAllGysReminders();
    expect(api.cancel).toHaveBeenCalledWith(GYS_REMINDER_NOTIFICATION_IDS);
    expect(api.requestPermission).not.toHaveBeenCalled();
  });
});
