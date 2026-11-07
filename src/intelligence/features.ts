import { addDaysToKey } from '@/domain/dates';
import type { ActivityData, DateKey, HourlySteps } from '@/domain/models';

/**
 * Feature extraction: the explicit boundary between processed activity data
 * and any intelligence implementation. The rule engine reads these features
 * today; an on-device model would consume the same vector later.
 */

export const BASELINE_WINDOW_DAYS = 7;
export const MIN_BASELINE_DAYS = 3;
export const CONSISTENCY_TOLERANCE = 0.25;
export const CONSISTENT_DAYS_REQUIRED = 5;
/** Below this many usual steps by now it is too early in the day to compare pace. */
export const MIN_PACE_BASELINE_STEPS = 500;

export interface ActivityFeatures {
  date: DateKey;
  todaySteps: number | null;
  todayActiveMinutes: number | null;
  yesterdayActiveMinutes: number | null;
  /** Days within the 7 days before `date` that reported steps. */
  baselineDays: number;
  baselineAvgSteps: number | null;
  /** todaySteps / baselineAvgSteps. */
  todayStepsRatio: number | null;
  /** Baseline days whose steps fall within ±25% of the baseline mean. */
  consistentDays: number;
  /** Baseline days with hourly steps, which the pace comparison needs. */
  paceBaselineDays: number;
  /** Mean steps those days had recorded by the current local time; null without hourly data. */
  baselineStepsByNow: number | null;
  /**
   * todaySteps / baselineStepsByNow. Null without enough hourly data, or while the usual
   * steps by now are under MIN_PACE_BASELINE_STEPS (too early in the day to say).
   */
  paceRatio: number | null;
}

/**
 * `pace` adds the time-of-day comparison: hourly steps for the baseline days, and the
 * moment to compare at. Without it the pace features are empty.
 */
export function extractActivityFeatures(
  activity: ActivityData[],
  date: DateKey,
  pace?: { now: Date; hourlySteps: HourlySteps[] },
): ActivityFeatures {
  const byDate = new Map(activity.map((d) => [d.date, d]));
  const today = byDate.get(date);
  const yesterday = byDate.get(addDaysToKey(date, -1));

  const baselineSteps: number[] = [];
  for (let i = 1; i <= BASELINE_WINDOW_DAYS; i++) {
    const steps = byDate.get(addDaysToKey(date, -i))?.steps;
    if (steps !== null && steps !== undefined) baselineSteps.push(steps);
  }

  const baselineAvgSteps =
    baselineSteps.length > 0 ? baselineSteps.reduce((a, b) => a + b, 0) / baselineSteps.length : null;

  const consistentDays =
    baselineAvgSteps && baselineAvgSteps > 0
      ? baselineSteps.filter((s) => Math.abs(s - baselineAvgSteps) / baselineAvgSteps <= CONSISTENCY_TOLERANCE).length
      : 0;

  const todaySteps = today?.steps ?? null;

  const byNow = pace ? baselineStepsByTimeOfDay(pace.hourlySteps, date, pace.now) : [];
  const baselineStepsByNow = byNow.length > 0 ? byNow.reduce((a, b) => a + b, 0) / byNow.length : null;
  const paceRatio =
    todaySteps !== null &&
    byNow.length >= MIN_BASELINE_DAYS &&
    baselineStepsByNow !== null &&
    baselineStepsByNow >= MIN_PACE_BASELINE_STEPS
      ? todaySteps / baselineStepsByNow
      : null;

  return {
    date,
    todaySteps,
    todayActiveMinutes: today?.activeMinutes ?? null,
    yesterdayActiveMinutes: yesterday?.activeMinutes ?? null,
    baselineDays: baselineSteps.length,
    baselineAvgSteps,
    todayStepsRatio:
      todaySteps !== null && baselineAvgSteps !== null && baselineAvgSteps > 0 ? todaySteps / baselineAvgSteps : null,
    consistentDays,
    paceBaselineDays: byNow.length,
    baselineStepsByNow,
    paceRatio,
  };
}

/**
 * Steps each baseline day with hourly data had recorded by `now`'s local time of day. The
 * current hour counts in proportion to the minutes elapsed, since today's total covers only
 * part of it.
 */
function baselineStepsByTimeOfDay(hourlySteps: HourlySteps[], date: DateKey, now: Date): number[] {
  const hour = now.getHours();
  const hourFraction = now.getMinutes() / 60;
  const totals = new Map<DateKey, number>();
  for (const h of hourlySteps) {
    const weight = h.hour < hour ? 1 : h.hour === hour ? hourFraction : 0;
    totals.set(h.date, (totals.get(h.date) ?? 0) + h.steps * weight);
  }
  const result: number[] = [];
  for (let i = 1; i <= BASELINE_WINDOW_DAYS; i++) {
    const total = totals.get(addDaysToKey(date, -i));
    if (total !== undefined) result.push(total);
  }
  return result;
}
