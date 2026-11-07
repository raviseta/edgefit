import { fixtures } from '@/health/fixtures';
import { createAppServices } from '../createAppServices';
import { createTestServices, testNow } from '@/test-utils/harness';

async function setup() {
  const context = await createTestServices({ fixture: fixtures.twoWeeks });
  const snapshot = await context.services.activity.refresh();
  expect(snapshot.stepGoals.suggestion.status).toBe('suggested');
  return { ...context, snapshot };
}
it('accepts explicitly and persists across restart; manual choice pauses suggestions', async () => {
  const { services, snapshot, db, health } = await setup();
  expect(snapshot.stepGoals.preferences.goal).toBeNull();
  const accepted = await services.activity.updateStepGoal({ kind: 'accept', token: snapshot.stepGoals.suggestion.token }, 0);
  expect(accepted.stepGoals.preferences.goal?.source).toBe('accepted_suggestion');
  const restarted = await createAppServices({ db, health, now: testNow });
  expect((await restarted.activity.refresh()).stepGoals.preferences).toEqual(accepted.stepGoals.preferences);
  await restarted.activity.updateStepGoal({ kind: 'manual', steps: 1234 }, 0);
  const again = await createAppServices({ db, health, now: testNow });
  expect((await again.activity.refresh()).stepGoals).toMatchObject({ preferences: { goal: { activeSteps: 1234, source: 'manual' } }, suggestion: { reason: 'manual' } });
});
it('dismisses for a week without changing the goal, across restart', async () => {
  const { services, snapshot, db, health } = await setup();
  await services.activity.updateStepGoal({ kind: 'dismiss', token: snapshot.stepGoals.suggestion.token }, 0);
  const restarted = await createAppServices({ db, health, now: testNow });
  expect((await restarted.activity.refresh()).stepGoals).toMatchObject({ preferences: { goal: null, dismissedUntil: '2026-10-07' }, suggestion: { reason: 'dismissed' } });
});
it('rejects stale acceptance after sync changes the history', async () => {
  const { services, health, snapshot } = await setup();
  jest.spyOn(health, 'getSteps').mockResolvedValue([]);
  await expect(services.activity.updateStepGoal({ kind: 'accept', token: snapshot.stepGoals.suggestion.token }, 0)).rejects.toThrow('Activity changed');
  expect((await services.repositories.goals.get()).goal).toBeNull();
});
it('preserves cached steps on failed reads but prevents accepting their suggestion', async () => {
  const { services, health, snapshot } = await setup();
  const before = await services.repositories.summaries.getStoredRange('2026-09-16', '2026-09-29');
  jest.spyOn(health, 'getSteps').mockRejectedValue(new Error('failed'));
  await expect(services.activity.updateStepGoal({ kind: 'accept', token: snapshot.stepGoals.suggestion.token }, 0)).rejects.toThrow();
  expect(await services.repositories.summaries.getStoredRange('2026-09-16', '2026-09-29')).toEqual(before);
});
it('clear wins over running and queued actions; stale callbacks cannot resurrect goals', async () => {
  const { services, snapshot } = await setup();
  const update = services.activity.updateStepGoal({ kind: 'manual', steps: 5000 }, 0);
  const clear = services.activity.clearLocalData();
  await expect(update).rejects.toThrow('Local data changed');
  await clear;
  await expect(services.activity.updateStepGoal({ kind: 'accept', token: snapshot.stepGoals.suggestion.token }, 0)).rejects.toThrow('Local data changed');
  expect((await services.activity.refresh()).stepGoals).toMatchObject({ preferences: { goal: null, dismissedUntil: null }, suggestion: { reason: 'unavailable', validDays: 0 } });
});
it.each([0, -1, 1.5, 100001, NaN])('rejects invalid manual entry %s', async (steps) => {
  const { services } = await setup();
  await expect(services.activity.updateStepGoal({ kind: 'manual', steps }, 0)).rejects.toThrow('whole number');
});
it('expires dismissal after seven new local days and derives only the retained window', async () => {
  let now = testNow();
  const { services } = await createTestServices({ fixture: fixtures.twoWeeks, now: () => new Date(now) });
  const first = await services.activity.refresh();
  await services.activity.updateStepGoal({ kind: 'dismiss', token: first.stepGoals.suggestion.token }, 0);
  now = new Date(2026, 9, 7, 20);
  const renewed = await services.activity.refresh();
  expect(renewed.stepGoals.suggestion.status).toBe('suggested');
  expect(renewed.stepGoals.suggestion.periodStartLocal).toBe('2026-09-23');
  // Retention and disabled reads must not leave an old derived suggestion behind.
  await services.repositories.settings.update({ healthDataEnabled: false });
  now = new Date(2026, 10, 20, 20);
  expect((await services.activity.refresh()).stepGoals.suggestion).toMatchObject({ validDays: 0, reason: 'unavailable' });
});
it('falls back safely for corrupt persisted goals', async () => {
  const { db, services } = await setup();
  await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['stepGoalPreferences', '{"goal":{"activeSteps":-1},"dismissedUntil":null}']);
  expect(await services.repositories.goals.get()).toEqual({ goal: null, dismissedUntil: null });
});
it('scores days against the goal at once and on every later sync', async () => {
  const { services } = await createTestServices();
  const before = await services.activity.refresh();
  expect(before.today).toMatchObject({ steps: 6420, stepTarget: 8000 });
  expect(before.stepGoals.streak).toBeNull();

  const updated = await services.activity.updateStepGoal({ kind: 'manual', steps: 5000 }, 0);
  expect(updated.today).toMatchObject({ stepTarget: 5000, activityScore: 100 });
  expect(updated.history.every((d) => d.summary?.stepTarget === 5000)).toBe(true);
  expect((await services.activity.refresh()).today).toMatchObject({ stepTarget: 5000, activityScore: 100 });
});
it('counts days in a row at the goal on the Dashboard and the calendar', async () => {
  const { services } = await createTestServices();
  await services.activity.refresh();
  // Every fixture day, today included, has at least 6,420 steps; the day before them has none.
  const updated = await services.activity.updateStepGoal({ kind: 'manual', steps: 6000 }, 0);
  expect(updated.stepGoals.streak).toBe(8);
  expect((await services.activity.getCalendar()).goalStreak).toBe(8);
  const higher = await services.activity.updateStepGoal({ kind: 'manual', steps: 9000 }, 0);
  expect(higher.stepGoals.streak).toBe(0);
});
