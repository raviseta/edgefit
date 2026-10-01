import { fixtures } from '@/health/fixtures';
import { logger } from '@/lib/logger';
import { createTestServices } from '@/test-utils/harness';

beforeEach(() => logger.clear());

describe('ActivityService.refresh (sync pipeline)', () => {
  it('normal fixture: persists summaries, workouts and insights', async () => {
    const { services } = await createTestServices();
    const snapshot = await services.activity.refresh();

    expect(snapshot.sync).toEqual({ status: 'synced', failedMetrics: [] });
    expect(snapshot.provider).toBe('mock');
    expect(snapshot.history.map((d) => d.date)).toEqual([
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
    expect(snapshot.today).toEqual({
      date: '2026-09-30',
      steps: 6420,
      activeCalories: 296,
      activeMinutes: 34,
      workoutCount: 1,
      workoutMinutes: 42,
      activityScore: 92,
    });
    expect(snapshot.workouts.map((w) => w.type)).toEqual(['Running', 'Walking', 'Strength Training', 'Cycling']);
    expect(snapshot.insights[0]!.type).toBe('below-average');

    // The 8th (baseline-only) day is persisted too.
    expect(await services.repositories.summaries.getByDate('2026-09-23')).not.toBeNull();
  });

  it('multiple workouts on one day are counted and scored', async () => {
    const { services } = await createTestServices({ fixture: fixtures.multipleWorkouts });
    const { today, workouts } = await services.activity.refresh();
    expect(today).toMatchObject({ workoutCount: 3, workoutMinutes: 95 });
    expect(workouts).toHaveLength(6);
  });

  it('empty fixture: stores days with null metrics and no score', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    const snapshot = await services.activity.refresh();
    expect(snapshot.today).toMatchObject({ steps: null, activeCalories: null, activeMinutes: null, activityScore: null });
    expect(snapshot.workouts).toEqual([]);
  });

  it('missing metrics: keeps per-metric gaps', async () => {
    const { services } = await createTestServices({ fixture: fixtures.missingMetrics });
    const { history } = await services.activity.refresh();
    const byDate = Object.fromEntries(history.map((d) => [d.date, d.summary]));
    expect(byDate['2026-09-26']).toMatchObject({ steps: null, activeCalories: null, activityScore: null });
    expect(byDate['2026-09-27']).toMatchObject({ steps: null, activeCalories: 280, activityScore: null });
    expect(byDate['2026-09-30']).toMatchObject({ steps: 3400, activeMinutes: null, activityScore: 17 });
  });

  it('does not read health data when the user has not enabled it', async () => {
    const { services, health } = await createTestServices({ settings: { healthDataEnabled: false } });
    const spy = jest.spyOn(health, 'getSteps');
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'health-disabled' });
    expect(spy).not.toHaveBeenCalled();
    expect(snapshot.today).toBeNull();
  });

  it('skips insight generation when insights are turned off', async () => {
    const { services } = await createTestServices({ settings: { analyticsEnabled: false } });
    const generate = jest.spyOn(services.intelligence, 'generateInsights');
    const snapshot = await services.activity.refresh();
    expect(generate).not.toHaveBeenCalled();
    expect(snapshot.insights).toEqual([]);
    expect(snapshot.today).not.toBeNull();
  });

  it('reports an unavailable provider', async () => {
    const { services } = await createTestServices({ health: { authorization: 'unavailable' } });
    expect((await services.activity.refresh()).sync).toEqual({ status: 'unavailable' });
  });

  it('keeps going when one metric fails and reports which', async () => {
    const { services, health } = await createTestServices();
    jest.spyOn(health, 'getActiveCalories').mockRejectedValue(new Error('boom'));
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'synced', failedMetrics: ['activeCalories'] });
    expect(snapshot.today).toMatchObject({ steps: 6420, activeCalories: null });
  });

  it('falls back to cached data when every health query fails', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    for (const method of ['getSteps', 'getActiveCalories', 'getActiveMinutes', 'getWorkouts'] as const) {
      jest.spyOn(health, method).mockRejectedValue(new Error('HealthKit exploded'));
    }
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'failed' });
    expect(snapshot.today?.steps).toBe(6420);
    expect(logger.recent().some((e) => e.event === 'sync.failed')).toBe(true);
  });

  it('propagates database failures so the UI can show an error state', async () => {
    const { services, db } = await createTestServices();
    db.failing = true;
    await expect(services.activity.refresh()).rejects.toThrow('Simulated database failure');
  });

  it('logs failures without health values', async () => {
    const { services, health } = await createTestServices();
    jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('query failed'));
    await services.activity.refresh();
    const serialized = JSON.stringify(logger.recent());
    expect(serialized).toContain('health.query_failed');
    for (const value of ['6420', '296', '34']) expect(serialized).not.toContain(value);
  });

  it('applies the 30-day retention window', async () => {
    const { services } = await createTestServices();
    await services.repositories.summaries.upsertMany([
      { date: '2026-08-01', steps: 1, activeCalories: 1, activeMinutes: 1, workoutCount: 0, workoutMinutes: 0, activityScore: 1 },
    ]);
    await services.repositories.workouts.replaceRange(new Date(2026, 7, 1), new Date(2026, 7, 2), [
      { id: 'ancient', type: 'Walking', startDate: new Date(2026, 7, 1, 9).toISOString(), durationMinutes: 10 },
    ]);
    await services.activity.refresh();
    expect(await services.repositories.summaries.getByDate('2026-08-01')).toBeNull();
    expect((await services.repositories.workouts.list()).map((w) => w.id)).not.toContain('ancient');
  });
});
