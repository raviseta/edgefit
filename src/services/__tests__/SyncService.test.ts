import { toDateKey } from '@/domain/dates';
import { fixtures, type HealthFixture } from '@/health/fixtures';
import { logger } from '@/lib/logger';
import type { AppServices } from '@/services/createAppServices';
import { createTestServices, testNow } from '@/test-utils/harness';

beforeEach(() => logger.clear());

/** Rows well outside the 30-day retention window. */
async function seedAncientData(services: AppServices) {
  await services.repositories.summaries.upsertMany([
    { date: '2026-08-01', steps: 1, activeCalories: 1, activeMinutes: 1, workoutCount: 0, workoutMinutes: 0, activityScore: 1 },
  ]);
  await services.repositories.workouts.replaceRange(new Date(2026, 7, 1), new Date(2026, 7, 2), [
    { id: 'ancient', type: 'Walking', startDate: new Date(2026, 7, 1, 9).toISOString(), durationMinutes: 10 },
  ]);
}

async function expectAncientDataPruned(services: AppServices) {
  expect(await services.repositories.summaries.getByDate('2026-08-01')).toBeNull();
  expect((await services.repositories.workouts.list()).map((w) => w.id)).not.toContain('ancient');
}

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

  it('keeps the last saved values of a metric whose query fails on a later sync', async () => {
    const { services, health } = await createTestServices();
    const insightsBefore = (await services.activity.refresh()).insights.map((i) => i.type);
    const synced = await services.repositories.summaries.getRange('2026-09-23', '2026-09-30');
    expect(synced).toHaveLength(8);

    jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('query failed'));
    const snapshot = await services.activity.refresh();

    expect(snapshot.sync).toEqual({ status: 'synced', failedMetrics: ['steps'] });
    const after = await services.repositories.summaries.getRange('2026-09-23', '2026-09-30');
    expect(after.map((s) => [s.date, s.steps, s.activityScore])).toEqual(
      synced.map((s) => [s.date, s.steps, s.activityScore]),
    );
    expect(snapshot.today).toMatchObject({ steps: 6420, activityScore: 92 });
    expect(snapshot.insights.map((i) => i.type)).toEqual(insightsBefore);
    expect(snapshot.insights.map((i) => i.type)).not.toContain('building-baseline');
  });

  it('a metric that is fresh but missing stays missing even if the cache had a value', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    jest.spyOn(health, 'getActiveCalories').mockResolvedValue([]);
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'synced', failedMetrics: [] });
    expect(snapshot.today?.activeCalories).toBeNull();
  });

  it('applies retention even when health reading is turned off', async () => {
    const { services } = await createTestServices({ settings: { healthDataEnabled: false } });
    await seedAncientData(services);
    expect((await services.activity.refresh()).sync).toEqual({ status: 'health-disabled' });
    await expectAncientDataPruned(services);
  });

  it('applies retention even when every health query fails', async () => {
    const { services } = await createTestServices({ health: { failQueries: true } });
    await seedAncientData(services);
    expect((await services.activity.refresh()).sync).toEqual({ status: 'failed' });
    await expectAncientDataPruned(services);
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

  it('is idempotent: syncing again stores exactly the same data', async () => {
    const { services } = await createTestServices({ fixture: fixtures.multipleWorkouts });
    const read = async () => ({
      summaries: await services.repositories.summaries.getRange('2000-01-01', '2100-01-01'),
      workouts: await services.repositories.workouts.list(),
      insights: await services.repositories.insights.list(),
    });
    await services.activity.refresh();
    const first = await read();
    await services.activity.refresh();
    expect(await read()).toEqual(first);
    expect(first.workouts).toHaveLength(6);
  });

  it('just after local midnight, today is unknown rather than zero and yesterday is intact', async () => {
    const lastWeekOnly: HealthFixture = {
      name: 'normal',
      days: fixtures.normal.days.filter((d) => d.offset < 0),
      workouts: [],
    };
    const now = () => new Date(2026, 9, 1, 0, 5);
    const { services } = await createTestServices({ fixture: lastWeekOnly, now });
    const snapshot = await services.activity.refresh();

    expect(snapshot.history.at(-1)?.date).toBe('2026-10-01');
    expect(snapshot.today).toMatchObject({
      date: '2026-10-01',
      steps: null,
      activeCalories: null,
      activeMinutes: null,
      activityScore: null,
    });
    expect(snapshot.history.at(-2)?.summary).toMatchObject({ date: '2026-09-30', steps: 8840 });
    expect(snapshot.insights[0]?.type).toBe('no-activity-yet');
  });

  it.each([
    ['on the 25-hour DST fall-back day', new Date(2026, 10, 1, 23, 30), '2026-10-25'],
    ['the day after DST ends', new Date(2026, 10, 2, 9, 0), '2026-10-26'],
    ['the day after DST starts', new Date(2026, 2, 9, 0, 30), '2026-03-02'],
  ])('syncs eight distinct local days %s', async (_label, at, firstDay) => {
    const { services } = await createTestServices({ now: () => new Date(at.getTime()) });
    await services.activity.refresh();
    const stored = await services.repositories.summaries.getRange('2000-01-01', '2100-01-01');
    expect(stored).toHaveLength(8);
    expect(stored[0]!.date).toBe(firstDay);
    expect(new Set(stored.map((s) => s.date)).size).toBe(8);
    expect(stored.map((s) => s.steps)).toEqual(fixtures.normal.days.map((d) => d.steps));
  });

  it('dashboard, activity history and workout list agree on today', async () => {
    const { services } = await createTestServices({ fixture: fixtures.multipleWorkouts });
    const snapshot = await services.activity.refresh();
    expect(snapshot.today).toEqual(snapshot.history.at(-1)?.summary);
    const todaysWorkouts = snapshot.workouts.filter((w) => toDateKey(new Date(w.startDate)) === snapshot.today!.date);
    expect(snapshot.today!.workoutCount).toBe(todaysWorkouts.length);
    expect(snapshot.today!.workoutMinutes).toBe(todaysWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0));
  });

  it('a workout deleted in Health disappears on the next sync', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    const remaining = (await health.getWorkouts(new Date(2026, 8, 1), testNow())).filter((w) => w.id !== 'wk-normal-1');
    jest.spyOn(health, 'getWorkouts').mockResolvedValue(remaining);
    const snapshot = await services.activity.refresh();
    expect(snapshot.workouts.map((w) => w.id)).not.toContain('wk-normal-1');
    expect(snapshot.today).toMatchObject({ workoutCount: 0, workoutMinutes: 0 });
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
