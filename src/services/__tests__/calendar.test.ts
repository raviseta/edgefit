import { calculateActivityScore } from '@/domain/activityScore';
import { toDateKey } from '@/domain/dates';
import { fixtures } from '@/health/fixtures';
import { createTestServices } from '@/test-utils/harness';

describe('ActivityService.getCalendar', () => {
  it('reads 30 local days from storage, consistent with the synced snapshot', async () => {
    const { services } = await createTestServices({ fixture: fixtures.multipleWorkouts });
    const snapshot = await services.activity.refresh();
    const calendar = await services.activity.getCalendar();

    expect(calendar.days).toHaveLength(30);
    expect(calendar.days[0]!.date).toBe('2026-09-01');
    expect(calendar.days.at(-1)).toMatchObject({ date: '2026-09-30', isToday: true });

    // The last 7 days match the Activity history exactly, including today.
    const lastSeven = calendar.days.slice(-7);
    expect(lastSeven.map((d) => d.summary)).toEqual(snapshot.history.map((h) => h.summary));
    expect(calendar.days.at(-1)!.score).toBe(snapshot.today!.activityScore);

    // Workouts land on their local start day and agree with the stored workout count.
    for (const day of calendar.days) {
      expect(day.workouts.every((w) => toDateKey(new Date(w.startDate)) === day.date)).toBe(true);
      if (day.summary) expect(day.workouts).toHaveLength(day.summary.workoutCount);
    }
    expect(calendar.days.flatMap((d) => d.workouts)).toHaveLength(snapshot.workouts.length);
  });

  it('summaries use stored scores only; days never synced stay unknown', async () => {
    const { services } = await createTestServices();
    await services.activity.refresh();
    const { days, summary } = await services.activity.getCalendar();
    const stored = await services.repositories.summaries.getRange(days[0]!.date, days.at(-1)!.date);
    const scores = stored.map((s) => s.activityScore).filter((s): s is number => s !== null);

    // A sync covers today plus 7 baseline days; the other 22 days have nothing saved.
    expect(days.filter((d) => d.summary === null)).toHaveLength(22);
    expect(days.filter((d) => d.summary === null).every((d) => d.level === 'unknown')).toBe(true);
    expect(summary.scoredDays).toBe(scores.length);
    expect(summary.averageScore).toBeCloseTo(scores.reduce((a, b) => a + b, 0) / scores.length);
    expect(summary.best?.score).toBe(Math.max(...scores));
  });

  it('the stored score matches the existing Activity Score formula for each day', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    await services.activity.refresh();
    for (const day of (await services.activity.getCalendar()).days) {
      if (!day.summary) continue;
      const recomputed = calculateActivityScore({
        steps: day.summary.steps,
        activeMinutes: day.summary.activeMinutes,
        workoutMinutes: day.summary.workoutMinutes,
      });
      expect(day.score).toBe(recomputed?.total ?? null);
    }
  });

  it('shows cached workouts from older days even when that day has no score', async () => {
    const { services } = await createTestServices();
    await services.activity.refresh();
    await services.repositories.workouts.replaceRange(new Date(2026, 8, 10), new Date(2026, 8, 10, 23), [
      { id: 'older', type: 'Hiking', startDate: new Date(2026, 8, 10, 9).toISOString(), durationMinutes: 95 },
    ]);
    const day = (await services.activity.getCalendar()).days.find((d) => d.date === '2026-09-10')!;
    expect(day.workouts.map((w) => w.id)).toEqual(['older']);
    expect(day).toMatchObject({ summary: null, score: null, level: 'unknown' });
  });

  it('does not read from the health provider (no sync)', async () => {
    const { services, health } = await createTestServices();
    const spies = (['getSteps', 'getActiveCalories', 'getActiveMinutes', 'getWorkouts', 'isAvailable'] as const).map(
      (m) => jest.spyOn(health, m),
    );
    const calendar = await services.activity.getCalendar();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(calendar.summary).toEqual({ totalDays: 30, scoredDays: 0, averageScore: null, best: null });
  });
});
