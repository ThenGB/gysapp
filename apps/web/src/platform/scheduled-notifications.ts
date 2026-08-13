import {
  ISO_WEEKDAYS,
  isoWeekdayToTauri,
  splitReminderTime,
  type BibleReminderSchedule,
} from '../lib/reminder-schedule';

export const SABAT_NOTIFICATION_ID = 31111;
const BIBLE_NOTIFICATION_BASE_ID = 321000;
export const GYS_REMINDER_NOTIFICATION_IDS = [
  SABAT_NOTIFICATION_ID,
  ...ISO_WEEKDAYS.map((weekday) => BIBLE_NOTIFICATION_BASE_ID + weekday),
];

export interface ReminderNotificationCopy {
  sabatTitle: string;
  sabatBody: string;
  bibleTitle: string;
  bibleBody: string;
}

export interface ReminderSettingsInput {
  sabatReminder: boolean;
  bibleReminders: BibleReminderSchedule;
}

export type ReminderApplyStatus = 'scheduled' | 'disabled' | 'unsupported' | 'permission-denied';

type NotificationSchedule = unknown;
type NativeNotificationApi = {
  Schedule?: {
    interval: (
      interval: { weekday?: number; hour?: number; minute?: number; second?: number },
      allowWhileIdle?: boolean,
    ) => NotificationSchedule;
  };
  isPermissionGranted?: () => Promise<boolean>;
  requestPermission?: () => Promise<NotificationPermission>;
  sendNotification?: (options: {
    id: number;
    title: string;
    body: string;
    schedule: NotificationSchedule;
  }) => void;
  cancel?: (ids: number[]) => Promise<void>;
};

type TauriNotificationWindow = Window & {
  __TAURI__?: { notification?: NativeNotificationApi };
};

function notificationApi(): Required<NativeNotificationApi> | null {
  if (typeof window === 'undefined') return null;
  const api = (window as TauriNotificationWindow).__TAURI__?.notification;
  if (
    !api?.Schedule?.interval ||
    !api.isPermissionGranted ||
    !api.requestPermission ||
    !api.sendNotification ||
    !api.cancel
  ) {
    return null;
  }
  return api as Required<NativeNotificationApi>;
}

export function isNativeReminderAvailable(): boolean {
  return notificationApi() !== null;
}

async function ensurePermission(
  api: Required<NativeNotificationApi>,
  requestPermission: boolean,
): Promise<boolean> {
  if (await api.isPermissionGranted()) return true;
  if (!requestPermission) return false;
  return (await api.requestPermission()) === 'granted';
}

function hasBibleReminders(schedule: BibleReminderSchedule): boolean {
  return ISO_WEEKDAYS.some((weekday) => Boolean(schedule[weekday]));
}

export async function applyNativeReminderSettings(
  settings: ReminderSettingsInput,
  copy: ReminderNotificationCopy,
  requestPermission = true,
): Promise<ReminderApplyStatus> {
  const api = notificationApi();
  if (!api) return 'unsupported';

  const hasAny = settings.sabatReminder || hasBibleReminders(settings.bibleReminders);
  if (hasAny && !(await ensurePermission(api, requestPermission))) return 'permission-denied';

  await api.cancel(GYS_REMINDER_NOTIFICATION_IDS);
  if (!hasAny) return 'disabled';

  try {
    if (settings.sabatReminder) {
      api.sendNotification({
        id: SABAT_NOTIFICATION_ID,
        title: copy.sabatTitle,
        body: copy.sabatBody,
        schedule: api.Schedule.interval({ weekday: 6, hour: 17, minute: 0, second: 0 }, true),
      });
    }

    for (const weekday of ISO_WEEKDAYS) {
      const time = settings.bibleReminders[weekday];
      if (!time) continue;
      const { hour, minute } = splitReminderTime(time);
      api.sendNotification({
        id: BIBLE_NOTIFICATION_BASE_ID + weekday,
        title: copy.bibleTitle,
        body: copy.bibleBody,
        schedule: api.Schedule.interval(
          { weekday: isoWeekdayToTauri(weekday), hour, minute, second: 0 },
          true,
        ),
      });
    }
  } catch (error) {
    await api.cancel(GYS_REMINDER_NOTIFICATION_IDS).catch(() => undefined);
    throw error;
  }

  return 'scheduled';
}

export async function cancelAllGysReminders(): Promise<void> {
  const api = notificationApi();
  if (!api) return;
  await api.cancel(GYS_REMINDER_NOTIFICATION_IDS);
}
