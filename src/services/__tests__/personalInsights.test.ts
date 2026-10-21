import { fixtures } from '@/health/fixtures';
import { logger } from '@/lib/logger';
import { createAppServices } from '@/services/createAppServices';
import { createTestServices, TEST_NOW, testNow } from '@/test-utils/harness';

beforeEach(() => logger.clear());

describe('ActivityService personal insights (from saved data)', () => {
  it('two weeks of history: all three insights are eligible after a sync', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    const { personalInsights } = await services.activity.refresh();

    expect(personalInsights?.hasAnyHistory).toBe(true);
    expect(personalInsights?.activityConsistency).toMatchObject({ status: 'eligible', activeDays: 7, observedDays: 7 });
    expect(personalInsights?.weeklySteps).toMatchObject({
      status: 'eligible',
      direction: 'increased',
      current: { validDays: 7, averageSteps: 9000 },
      previous: { validDays: 7, averageSteps: 8000 },
    });
    // Sep 29 has two workouts, Sep 26 and Sep 23 one each; today's workout is excluded.
    expect(personalInsights?.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 3, workoutCount: 4 });
  });

  it('one week of history: the comparison is withheld with valid-day counts', async () => {
    const { services } = await createTestServices();
    const { personalInsights } = await services.activity.refresh();
    expect(personalInsights?.weeklySteps).toMatchObject({
      status: 'ineligible',
      reason: 'insufficient-data',
      current: { validDays: 7 },
      previous: { validDays: 0 },
    });
    expect(personalInsights?.activityConsistency.status).toBe('eligible');
  });

  it('no history: nothing to show', async () => {
    const { services } = await createTestServices({ fixture: fixtures.empty });
    const { personalInsights } = await services.activity.refresh();
    expect(personalInsights?.hasAnyHistory).toBe(false);
    expect(personalInsights?.weeklySteps.status).toBe('ineligible');
    expect(personalInsights?.activityConsistency.status).toBe('ineligible');
  });

  it('is turned off with insights', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks, settings: { analyticsEnabled: false } });
    expect((await services.activity.refresh()).personalInsights).toBeNull();
  });

  it('repeated refreshes give identical results', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    const first = (await services.activity.refresh()).personalInsights;
    expect((await services.activity.refresh()).personalInsights).toEqual(first);
  });

  it('a workout deleted in Health is no longer counted after the next sync', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    const all = await health.getWorkouts(new Date(2026, 8, 1), testNow());
    jest.spyOn(health, 'getWorkouts').mockResolvedValue(all.filter((w) => w.id !== 'wk-two-4'));
    const { personalInsights } = await services.activity.refresh();
    expect(personalInsights?.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 2, workoutCount: 3 });
  });

  it('Clear Local Data removes every insight derived from the deleted records', async () => {
    const { services } = await createTestServices({ fixture: fixtures.twoWeeks });
    await services.activity.refresh();
    await services.activity.clearLocalData();
    // Settings are reset too, so health reading is off and nothing is re-synced.
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'health-disabled' });
    expect(snapshot.personalInsights?.hasAnyHistory).toBe(false);
    expect(snapshot.personalInsights?.activityConsistency.status).toBe('ineligible');
    expect(snapshot.personalInsights?.weeklySteps.status).toBe('ineligible');
    expect(snapshot.personalInsights?.exerciseFrequency.status).toBe('ineligible');
  });

  it('a failed query keeps complete days complete and reuses their saved values', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    const before = (await services.activity.refresh()).personalInsights;
    jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('down'));
    jest.spyOn(health, 'getWorkouts').mockRejectedValue(new Error('down'));
    const { sync, personalInsights } = await services.activity.refresh();
    expect(sync).toEqual({ status: 'synced', failedMetrics: ['steps', 'workouts'] });
    expect(personalInsights).toEqual(before);
  });

  it('when the whole sync fails, insights come from the rows saved by the last complete sync', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    const before = (await services.activity.refresh()).personalInsights;
    jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('down'));
    const after = await services.activity.refresh();
    expect(after.sync).toEqual({ status: 'failed' });
    expect(after.personalInsights).toEqual(before);
  });

  it.each(['failed', 'health-disabled', 'unavailable'] as const)(
    'a partial day re-saved from the cache stays partial across a restart and a %s refresh, then recovers',
    async (outcome) => {
      // Last successful sync: yesterday (Sep 29) at 09:00, so Sep 29 is partial.
      let now = new Date(2026, 8, 29, 9);
      const clock = () => new Date(now.getTime());
      const { services, health, db } = await createTestServices({ fixture: fixtures.twoWeeks, now: clock });
      await services.activity.refresh();
      now = new Date(TEST_NOW.getTime());
      // Today's sync can't read steps, so Sep 29's mid-day steps are re-saved from the cache.
      const steps = jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('down'));
      await services.activity.refresh();

      // A new service instance must read completeness from SQLite, not process memory.
      const restarted = await createAppServices({ db, health, now: clock });
      const available = jest.spyOn(health, 'isAvailable');
      if (outcome === 'failed') available.mockRejectedValue(new Error('offline'));
      if (outcome === 'unavailable') available.mockResolvedValue(false);
      if (outcome === 'health-disabled') {
        await restarted.repositories.settings.update({ healthDataEnabled: false });
      }
      const snapshot = await restarted.activity.refresh();
      expect(snapshot.sync.status).toBe(outcome);
      expect(snapshot.personalInsights?.weeklySteps).toMatchObject({ current: { validDays: 6 } });
      // Workouts were read fresh after Sep 29 ended, so the failed steps query doesn't hold them back.
      expect(snapshot.personalInsights?.exerciseFrequency.status).toBe('eligible');

      available.mockRestore();
      steps.mockRestore();
      await restarted.repositories.settings.update({ healthDataEnabled: true });
      const recovered = await restarted.activity.refresh();
      expect(recovered.personalInsights?.weeklySteps).toMatchObject({ status: 'eligible', current: { validDays: 7 } });
      expect(recovered.personalInsights?.exerciseFrequency.status).toBe('eligible');
    },
  );

  it('a metric that fails on every sync only holds back the insights that use it', async () => {
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks });
    jest.spyOn(health, 'getActiveMinutes').mockRejectedValue(new Error('unsupported'));
    const { personalInsights } = await services.activity.refresh();
    expect(personalInsights?.weeklySteps).toMatchObject({ status: 'eligible', current: { validDays: 7 } });
    expect(personalInsights?.exerciseFrequency).toMatchObject({ status: 'eligible', workoutDays: 3 });
    expect(personalInsights?.activityConsistency).toMatchObject({ status: 'eligible', activeDays: 7, observedDays: 7 });
  });

  it('completeness is decided when the row is written, not reinterpreted by the reader', async () => {
    // Jest can't switch time zones mid-run, so this pins the mechanism behind the travel case:
    // a row saved before its day ended stays partial even when its timestamp would look
    // complete from another zone (here, 01:00 on Sep 30 written over the real 21:00 Sep 29).
    let now = new Date(2026, 8, 29, 21);
    const { services, health, db } = await createTestServices({ fixture: fixtures.twoWeeks, now: () => new Date(now.getTime()) });
    await services.activity.refresh();
    await db.run('UPDATE daily_summaries SET updated_at = ? WHERE date = ?', [new Date(2026, 8, 30, 1).toISOString(), '2026-09-29']);

    now = new Date(TEST_NOW.getTime());
    jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('offline'));
    const { personalInsights } = await services.activity.refresh();
    expect(personalInsights?.weeklySteps).toMatchObject({ current: { validDays: 6 } });
  });

  it('a day marked complete while the clock was ahead is reset by the next sync, even one with failures', async () => {
    // The clock was a day ahead (Oct 1), so Sep 30 was saved as if it had ended.
    let now = new Date(2026, 9, 1, 9);
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks, now: () => new Date(now.getTime()) });
    await services.activity.refresh();
    let [row] = await services.repositories.summaries.getStoredRange('2026-09-30', '2026-09-30');
    expect(row?.complete.steps).toBe(true);

    now = new Date(TEST_NOW.getTime());
    jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('down'));
    await services.activity.refresh();
    [row] = await services.repositories.summaries.getStoredRange('2026-09-30', '2026-09-30');
    expect(row?.complete.steps).toBe(false);
  });

  it('days last saved before they ended are not treated as complete', async () => {
    // Last successful sync: yesterday (Sep 29) at 09:00. Today's sync fails.
    let now = new Date(2026, 8, 29, 9);
    const { services, health } = await createTestServices({ fixture: fixtures.twoWeeks, now: () => new Date(now.getTime()) });
    await services.activity.refresh();
    now = new Date(TEST_NOW.getTime());
    jest.spyOn(health, 'isAvailable').mockRejectedValue(new Error('down'));
    const { personalInsights } = await services.activity.refresh();

    // Sep 29 was saved mid-day, so the current week has 6 complete days.
    expect(personalInsights?.activityConsistency).toMatchObject({ status: 'eligible', observedDays: 6 });
    expect(personalInsights?.weeklySteps).toMatchObject({ current: { validDays: 6 } });
    expect(personalInsights?.exerciseFrequency).toMatchObject({ status: 'ineligible', reason: 'incomplete-window' });
  });
});
