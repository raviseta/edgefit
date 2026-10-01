import type { DateKey } from './models';

/**
 * Calendar helpers. Everything works in the device's local time zone because
 * "today's steps" means the user's local day. Day arithmetic uses
 * `setDate`, not millisecond offsets, so DST transitions (23h/25h days) are safe.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight for the given key. Throws on malformed input. */
export function fromDateKey(key: DateKey): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    throw new Error(`Invalid date key: ${key}`);
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (toDateKey(date) !== key) {
    throw new Error(`Invalid date key: ${key}`);
  }
  return date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** The last `count` day keys ending with (and including) `now`'s day, oldest first. */
export function lastNDayKeys(count: number, now: Date): DateKey[] {
  const today = startOfDay(now);
  return Array.from({ length: count }, (_, i) => toDateKey(addDays(today, i - (count - 1))));
}

/** Query window covering the last `count` local days, from local midnight to `now`. */
export function lastNDaysRange(count: number, now: Date): { start: Date; end: Date } {
  return { start: addDays(startOfDay(now), -(count - 1)), end: now };
}
