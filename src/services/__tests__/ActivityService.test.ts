import { createTestServices } from '@/test-utils/harness';

/** A promise the test resolves by hand, to hold a health query open mid-sync. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setImmediate(r));

const TABLES =['daily_summaries', 'workouts', 'insights', 'settings'];

describe('ActivityService write coordination', () => {
  it('a sync that is in flight when local data is cleared does not write it back', async () => {
    const { services, health, db } = await createTestServices();
    const realSteps = health.getSteps.bind(health);
    const gate = deferred<void>();
    jest.spyOn(health, 'getSteps').mockImplementation(async (start, end) => {
      await gate.promise;
      return realSteps(start, end);
    });

    const refresh = services.activity.refresh();
    // Let the sync get past its settings read and into the health queries.
    await tick();
    const clear = services.activity.clearLocalData();
    // Give an uncoordinated clear time to finish while the health query is still open.
    await tick();
    gate.resolve();
    const [snapshot] = await Promise.all([refresh, clear]);

    expect(snapshot.sync).toEqual({ status: 'synced', failedMetrics: [] });
    for (const table of TABLES) {
      expect(await db.getFirst<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
    }
  });

  it('a refresh requested after clearing sees the cleared settings and reads no health data', async () => {
    const { services, health } = await createTestServices();
    await services.activity.refresh();
    await services.activity.clearLocalData();
    const spy = jest.spyOn(health, 'getSteps');
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync).toEqual({ status: 'health-disabled' });
    expect(snapshot.today).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('coalesces overlapping refreshes into one sync', async () => {
    const { services, health } = await createTestServices();
    const spy = jest.spyOn(health, 'getSteps');
    const [a, b] = await Promise.all([services.activity.refresh(), services.activity.refresh()]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('runs a new sync once the previous one has finished', async () => {
    const { services, health } = await createTestServices();
    const spy = jest.spyOn(health, 'getSteps');
    await services.activity.refresh();
    await services.activity.refresh();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('a failed clear does not block later refreshes', async () => {
    const { services, db } = await createTestServices();
    db.failing = true;
    await expect(services.activity.clearLocalData()).rejects.toThrow('Simulated database failure');
    db.failing = false;
    const snapshot = await services.activity.refresh();
    expect(snapshot.sync.status).toBe('synced');
  });
});

