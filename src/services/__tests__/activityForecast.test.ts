import { addDaysToKey, toDateKey } from '@/domain/dates';
import { fixtures } from '@/health/fixtures';
import { createTestServices, TEST_NOW } from '@/test-utils/harness';

describe('activity forecast experiment read model', () => {
  it('makes the baseline and retrospective dataset available from retained summaries', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    const snapshot = await services.activity.refresh();
    expect(snapshot.activityForecast).toMatchObject({
      dataSource: 'demo', featureVersion: 'steps-v1',
      baseline: { status: 'ready', method: 'baseline', targetDate: '2026-10-01', predictedSteps: 9000 },
    });
    expect(snapshot.activityForecast?.dataset).toHaveLength(6);
    expect(snapshot.activityForecast?.dataset.at(-1)).toMatchObject({
      issuedOn: '2026-09-28', targetDate: '2026-09-29', actualSteps: 9300,
    });
  });

  it('reads the full retained window without increasing HealthKit sync depth', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    const today = toDateKey(TEST_NOW);
    await services.repositories.summaries.upsertMany(
      Array.from({ length: 40 }, (_, index) => ({
        date: addDaysToKey(today, index - 39), steps: 5000,
        activeCalories: null, activeMinutes: null,
        workoutCount: 0, workoutMinutes: 0, stepTarget: 8000, activityScore: null,
      })), TEST_NOW,
    );
    const spy = jest.spyOn(health, 'getSteps');
    const snapshot = await services.activity.refresh();
    expect(snapshot.activityForecast?.dataset).toHaveLength(21);
    expect(snapshot.activityForecast?.dataset[0]?.inputStart).toBe('2026-09-01');
    expect(toDateKey(spy.mock.calls[0]![0])).toBe('2026-09-16');
    expect(snapshot.history).toHaveLength(7);
    expect(snapshot.personalInsights?.weeklySteps).toMatchObject({ current: { validDays: 7 }, previous: { validDays: 7 } });
  });

  it('returns an explicit insufficient-data state for a new installation', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    expect((await services.activity.refresh()).activityForecast).toMatchObject({
      baseline: { status: 'insufficient-data', observedDays: 0 }, dataset: [],
    });
  });

  it.each([{ insightsEnabled: false }, { healthDataEnabled: false }])('does not derive forecasts when settings disable them (%j)', async (settings) => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    await services.repositories.settings.update(settings);
    expect((await services.activity.refresh()).activityForecast).toBeNull();
  });

  it('withholds cached predictions after a failed step read and recovers on the next sync', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    const spy = jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('unavailable'));
    expect((await services.activity.refresh()).activityForecast).toMatchObject({
      baseline: { status: 'unavailable' }, dataset: [],
    });
    spy.mockRestore();
    expect((await services.activity.refresh()).activityForecast?.baseline.status).toBe('ready');
  });

  it('still uses steps when an unrelated metric fails', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    jest.spyOn(health, 'getWorkouts').mockRejectedValue(new Error('unavailable'));
    expect((await services.activity.refresh()).activityForecast?.baseline.status).toBe('ready');
  });

  it.each(['failed', 'unavailable'] as const)('withholds the experiment after health becomes %s', async (status) => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    if (status === 'failed') jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('unavailable'));
    else jest.spyOn(health, 'isAvailable').mockResolvedValue(false);
    expect((await services.activity.refresh()).activityForecast).toMatchObject({
      baseline: { status: 'unavailable' }, dataset: [],
    });
  });

  it('recalculates when source data is removed instead of retaining orphaned examples', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    expect((await services.activity.refresh()).activityForecast?.dataset.length).toBeGreaterThan(0);
    jest.spyOn(health, 'getSteps').mockResolvedValue([]);
    expect((await services.activity.refresh()).activityForecast).toMatchObject({
      baseline: { status: 'insufficient-data', observedDays: 0 }, dataset: [],
    });
  });

  it('clears the experiment with local data and leaves step goals unchanged', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    const before = await services.repositories.goals.get();
    await services.activity.refresh();
    expect(await services.repositories.goals.get()).toEqual(before);
    await services.activity.clearLocalData();
    const snapshot = await services.activity.refresh();
    expect(snapshot.activityForecast).toBeNull();
    expect(snapshot.today).toBeNull();
  });
});
