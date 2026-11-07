import { toDateKey } from '@/domain/dates';
import type { DateKey, HourlySteps, Workout } from '@/domain/models';
import type { DailyQuantity, WorkoutData } from './HealthService';

/**
 * Normalization: platform DTOs → domain models. Kept separate from the
 * platform services so the same rules apply to HealthKit, Health Connect and
 * the mock provider.
 */

/** Index daily quantities by day. Non-finite or negative values are dropped as invalid. */
export function indexByDate(values: DailyQuantity[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>();
  for (const { date, value } of values) {
    if (!Number.isFinite(value) || value < 0) continue;
    map.set(date, (map.get(date) ?? 0) + value);
  }
  return map;
}

/**
 * Sums hourly buckets by local day and clock hour, oldest first. When clocks go back, the
 * repeated hour arrives as two buckets with the same local hour; they are added together.
 * Non-finite or negative values are dropped as invalid.
 */
export function sumByLocalHour(buckets: { start: Date; value: number }[]): HourlySteps[] {
  const sums = new Map<string, HourlySteps>();
  for (const { start, value } of buckets) {
    if (!Number.isFinite(value) || value < 0) continue;
    const date = toDateKey(start);
    const hour = start.getHours();
    const key = `${date}T${hour}`;
    const existing = sums.get(key);
    if (existing) existing.steps += value;
    else sums.set(key, { date, hour, steps: value });
  }
  return [...sums.values()].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
}

const WORKOUT_LABEL_OVERRIDES: Record<string, string> = {
  traditionalStrengthTraining: 'Strength Training',
  functionalStrengthTraining: 'Functional Strength',
  highIntensityIntervalTraining: 'HIIT',
  mixedCardio: 'Mixed Cardio',
  mixedMetabolicCardioTraining: 'Mixed Cardio',
  coreTraining: 'Core Training',
  mindAndBody: 'Mind & Body',
  preparationAndRecovery: 'Recovery',
  stairClimbing: 'Stair Climbing',
  swimBikeRun: 'Multisport',
  other: 'Workout',
};

/** "crossCountrySkiing" → "Cross Country Skiing". */
export function workoutTypeLabel(activityType: string): string {
  const override = WORKOUT_LABEL_OVERRIDES[activityType];
  if (override) return override;
  if (!activityType) return 'Workout';
  const words = activityType.replace(/([a-z])([A-Z])/g, '$1 $2');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function normalizeWorkout(data: WorkoutData): Workout {
  const workout: Workout = {
    id: data.id,
    type: workoutTypeLabel(data.activityType),
    startDate: data.startDate.toISOString(),
    durationMinutes: Math.max(0, Math.round(data.durationSeconds / 60)),
  };
  if (data.energyKcal !== undefined && Number.isFinite(data.energyKcal) && data.energyKcal > 0) {
    workout.calories = Math.round(data.energyKcal);
  }
  return workout;
}

export function workoutDateKey(workout: Workout): DateKey {
  return toDateKey(new Date(workout.startDate));
}
