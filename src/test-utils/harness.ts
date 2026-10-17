import type { AppSettings } from '@/domain/models';
import { fixtures, type HealthFixture } from '@/health/fixtures';
import { MockHealthService, type MockHealthServiceOptions } from '@/health/MockHealthService';
import { createAppServices } from '@/services/createAppServices';
import { NodeSqliteDatabase } from './NodeSqliteDatabase';

/** Fixed clock for every test: Wednesday 30 Sep 2026, 20:00 local time. */
export const TEST_NOW = new Date(2026, 8, 30, 20, 0, 0);
export const testNow = () => new Date(TEST_NOW.getTime());

export async function createTestServices(
  options: {
    fixture?: HealthFixture;
    health?: MockHealthServiceOptions;
    settings?: Partial<AppSettings>;
    /** Clock override for date-boundary tests. Defaults to TEST_NOW. */
    now?: () => Date;
  } = {},
) {
  const now = options.now ?? testNow;
  const db = new NodeSqliteDatabase();
  const health = new MockHealthService(options.fixture ?? fixtures.normal, { now, ...options.health });
  const services = await createAppServices({ db, health, now });
  await services.repositories.settings.update({
    onboardingCompleted: true,
    healthDataEnabled: true,
    ...options.settings,
  });
  return { db, health, services };
}
