export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];
export type BibleReminderSchedule = Partial<Record<IsoWeekday, string>>;

export function isIsoWeekday(value: number): value is IsoWeekday {
  return ISO_WEEKDAYS.includes(value as IsoWeekday);
}

export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeBibleReminderSchedule(value: unknown): BibleReminderSchedule {
  if (!value || typeof value !== 'object') return {};
  const normalized: BibleReminderSchedule = {};
  for (const [rawWeekday, rawTime] of Object.entries(value)) {
    const weekday = Number(rawWeekday);
    if (isIsoWeekday(weekday) && isReminderTime(rawTime)) normalized[weekday] = rawTime;
  }
  return normalized;
}

export function splitReminderTime(time: string): { hour: number; minute: number } {
  if (!isReminderTime(time)) throw new Error(`Invalid reminder time: ${time}`);
  const [hour, minute] = time.split(':').map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

/** ISO weekday: Monday=1..Sunday=7. Tauri notification: Sunday=1..Saturday=7. */
export function isoWeekdayToTauri(weekday: IsoWeekday): number {
  return weekday === 7 ? 1 : weekday + 1;
}
