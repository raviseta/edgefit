import { addDaysToKey } from '@/domain/dates';
import type { ActivityData, DateKey } from '@/domain/models';

/**
 * Feature extraction: the explicit boundary between processed activity data
 * and any intelligence implementation. The rule engine reads these features
 * today; an on-device model would consume the same vector later.
 */

export const BASELINE_WINDOW_DAYS = 7;
export const MIN_BASELINE_DAYS = 3;
export const CONSISTENCY_TOLERANCE = 0.25;
export const CONSISTENT_DAYS_REQUIRED = 5;

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
}

export function extractActivityFeatures(activity: ActivityData[], date: DateKey): ActivityFeatures {
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
  };
}
