import type { Workout } from '../models';
import { buildActivityData, buildDailySummaries } from '../aggregation';

const days = ['2026-09-28', '2026-09-29', '2026-09-30'];

describe('buildActivityData', () => {
  it('produces one entry per requested day, oldest first', () => {
    const result = buildActivityData(days, {
      steps: [{ date: '2026-09-30', value: 5000 }],
      activeCalories: [],
      activeMinutes: [],
    });
    expect(result.map((d) => d.date)).toEqual(days);
  });

  it('keeps missing metrics as null rather than zero', () => {
    const [first, , last] = buildActivityData(days, {
      steps: [{ date: '2026-09-30', value: 5000 }],
      activeCalories: [{ date: '2026-09-30', value: 210.6 }],
      activeMinutes: [],
    });
    expect(first).toEqual({ date: '2026-09-28', steps: null, activeCalories: null, activeMinutes: null });
    expect(last).toEqual({ date: '2026-09-30', steps: 5000, activeCalories: 211, activeMinutes: null });
  });

  it('preserves a measured zero', () => {
    const [day] = buildActivityData(['2026-09-30'], {
      steps: [{ date: '2026-09-30', value: 0 }],
      activeCalories: [],
      activeMinutes: [],
    });
    expect(day!.steps).toBe(0);
  });

  it('sums duplicate buckets for the same day and drops invalid values', () => {
    const [day] = buildActivityData(['2026-09-30'], {
      steps: [
        { date: '2026-09-30', value: 1000 },
        { date: '2026-09-30', value: 500 },
        { date: '2026-09-30', value: -20 },
        { date: '2026-09-30', value: Number.NaN },
      ],
      activeCalories: [],
      activeMinutes: [],
    });
    expect(day!.steps).toBe(1500);
  });

  it('ignores values outside the requested days', () => {
    const result = buildActivityData(days, {
      steps: [{ date: '2026-01-01', value: 999 }],
      activeCalories: [],
      activeMinutes: [],
    });
    expect(result.every((d) => d.steps === null)).toBe(true);
  });
});

describe('buildDailySummaries', () => {
  const workout = (id: string, start: Date, durationMinutes: number): Workout => ({
    id,
    type: 'Running',
    startDate: start.toISOString(),
    durationMinutes,
  });

  it('attributes workouts to their local start day and scores the day', () => {
    const activity = buildActivityData(days, {
      steps: [{ date: '2026-09-30', value: 8000 }],
      activeCalories: [],
      activeMinutes: [{ date: '2026-09-30', value: 30 }],
    });
    const summaries = buildDailySummaries(activity, [
      workout('a', new Date(2026, 8, 30, 7, 0), 20),
      workout('b', new Date(2026, 8, 30, 18, 0), 15),
      workout('c', new Date(2026, 8, 29, 23, 30), 10),
    ]);
    expect(summaries[2]).toMatchObject({ workoutCount: 2, workoutMinutes: 35, activityScore: 100 });
    expect(summaries[1]).toMatchObject({ workoutCount: 1, workoutMinutes: 10, activityScore: 10 });
    expect(summaries[0]).toMatchObject({ workoutCount: 0, workoutMinutes: 0, activityScore: null });
  });
});
