import { lastNDaysRange } from '@/domain/dates';
import { TEST_NOW, testNow } from '@/test-utils/harness';
import { fixtures } from '../fixtures';
import { MockHealthService } from '../MockHealthService';

describe('MockHealthService', () => {
  const { start, end } = lastNDaysRange(8, TEST_NOW);

  it('is deterministic for a fixed clock', async () => {
    const a = await new MockHealthService(fixtures.normal, { now: testNow }).getSteps(start, end);
    const b = await new MockHealthService(fixtures.normal, { now: testNow }).getSteps(start, end);
    expect(a).toEqual(b);
    expect(a).toHaveLength(8);
    expect(a[a.length - 1]).toEqual({ date: '2026-09-30', value: 6420 });
  });

  it('omits days and metrics that the fixture leaves out', async () => {
    const service = new MockHealthService(fixtures.missingMetrics, { now: testNow });
    const steps = await service.getSteps(start, end);
    const minutes = await service.getActiveMinutes(start, end);
    expect(steps.map((s) => s.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-28', '2026-09-29', '2026-09-30']);
    expect(minutes.map((s) => s.date)).toEqual(['2026-09-23', '2026-09-28']);
  });

  it('returns nothing for the empty fixture', async () => {
    const service = new MockHealthService(fixtures.empty, { now: testNow });
    expect(await service.getSteps(start, end)).toEqual([]);
    expect(await service.getWorkouts(start, end)).toEqual([]);
  });

  it('returns workouts within range, newest first', async () => {
    const service = new MockHealthService(fixtures.multipleWorkouts, { now: testNow });
    const workouts = await service.getWorkouts(start, end);
    expect(workouts.map((w) => w.id)).toEqual(['wk-multi-3', 'wk-multi-2', 'wk-multi-1', 'wk-multi-5', 'wk-multi-4', 'wk-multi-6']);
    expect(workouts[0]!.startDate).toEqual(new Date(2026, 8, 30, 18, 15));
  });

  it('excludes workouts that start after the range end', async () => {
    const service = new MockHealthService(fixtures.multipleWorkouts, { now: testNow });
    const workouts = await service.getWorkouts(start, new Date(2026, 8, 30, 13, 0));
    expect(workouts.map((w) => w.id)).not.toContain('wk-multi-3');
  });

  it('reports authorization outcomes', async () => {
    const granted = new MockHealthService(fixtures.normal);
    expect(await granted.getPermissionRequestStatus()).toBe('shouldRequest');
    expect(await granted.requestAuthorization()).toEqual({ status: 'requested' });
    expect(await granted.getPermissionRequestStatus()).toBe('requested');
    expect(await new MockHealthService(fixtures.normal, { authorization: 'denied' }).requestAuthorization()).toEqual({
      status: 'denied',
    });
    expect(await new MockHealthService(fixtures.normal, { authorization: 'unavailable' }).isAvailable()).toBe(false);
  });

  it('can simulate query failures', async () => {
    const service = new MockHealthService(fixtures.normal, { failQueries: true });
    await expect(service.getSteps(start, end)).rejects.toThrow('Mock health query failure');
  });
});
