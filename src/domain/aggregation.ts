import type { DailyQuantity } from '@/health/HealthService';
import { indexByDate, workoutDateKey } from '@/health/normalization';
import { calculateActivityScore } from './activityScore';
import type { ActivityData, DailySummary, DateKey, Workout } from './models';

/**
 * Daily aggregation: per-metric daily buckets → one ActivityData per day →
 * DailySummary (with workouts and score).
 */

export function buildActivityData(
  days: DateKey[],
  metrics: { steps: DailyQuantity[]; activeCalories: DailyQuantity[]; activeMinutes: DailyQuantity[] },
): ActivityData[] {
  const steps = indexByDate(metrics.steps);
  const calories = indexByDate(metrics.activeCalories);
  const minutes = indexByDate(metrics.activeMinutes);

  return days.map((date) => ({
    date,
    steps: roundOrNull(steps.get(date)),
    activeCalories: roundOrNull(calories.get(date)),
    activeMinutes: roundOrNull(minutes.get(date)),
  }));
}

export function buildDailySummaries(activity: ActivityData[], workouts: Workout[]): DailySummary[] {
  const workoutsByDay = new Map<DateKey, Workout[]>();
  for (const workout of workouts) {
    const key = workoutDateKey(workout);
    workoutsByDay.set(key, [...(workoutsByDay.get(key) ?? []), workout]);
  }

  return activity.map((day) => {
    const dayWorkouts = workoutsByDay.get(day.date) ?? [];
    const workoutMinutes = dayWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);
    const score = calculateActivityScore({
      steps: day.steps,
      activeMinutes: day.activeMinutes,
      workoutMinutes,
    });
    return {
      ...day,
      workoutCount: dayWorkouts.length,
      workoutMinutes,
      activityScore: score?.total ?? null,
    };
  });
}

function roundOrNull(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value);
}
