import { fromDateKey, startOfDay, toDateKey, addDays } from '@/domain/dates';
import type { DateKey, EnergyUnit } from '@/domain/models';

/** The MVP UI is English-only, so formatting is pinned to en-US for consistent output. */
const LOCALE = 'en-US';
const KJ_PER_KCAL = 4.184;

export const EMPTY_VALUE = '—';

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString(LOCALE);
}

export function formatMetric(value: number | null): string {
  return value === null ? EMPTY_VALUE : formatNumber(value);
}

export function convertEnergy(kcal: number, unit: EnergyUnit): number {
  return unit === 'kJ' ? kcal * KJ_PER_KCAL : kcal;
}

/** Number only, in the user's unit, e.g. "1,757". */
export function formatEnergyValue(kcal: number | null | undefined, unit: EnergyUnit): string {
  if (kcal === null || kcal === undefined) return EMPTY_VALUE;
  return formatNumber(convertEnergy(kcal, unit));
}

/** Number with unit, e.g. "420 kcal". */
export function formatEnergy(kcal: number | null | undefined, unit: EnergyUnit): string {
  const value = formatEnergyValue(kcal, unit);
  return value === EMPTY_VALUE ? value : `${value} ${unit}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday", or e.g. "Mon, Sep 29". */
export function formatDayLabel(key: DateKey, now: Date): string {
  const today = toDateKey(startOfDay(now));
  if (key === today) return 'Today';
  if (key === toDateKey(addDays(now, -1))) return 'Yesterday';
  return fromDateKey(key).toLocaleDateString(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Single-letter-ish weekday for chart axes, e.g. "Mon". */
export function formatWeekday(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(LOCALE, { weekday: 'short' });
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
