import type { Database } from '@/data/Database';
import { migrate } from '@/data/migrations';
import { createRepositories, type Repositories } from '@/data/repositories';
import type { HealthService } from '@/health/HealthService';
import type { ActivityIntelligenceService } from '@/intelligence/ActivityIntelligenceService';
import { RuleBasedActivityIntelligenceService } from '@/intelligence/RuleBasedActivityIntelligenceService';
import { ActivityService } from './ActivityService';
import { SyncService } from './SyncService';

/** The dependency graph. UI code only ever sees this interface. */
export interface AppServices {
  health: HealthService;
  repositories: Repositories;
  intelligence: ActivityIntelligenceService;
  activity: ActivityService;
}

export async function createAppServices(options: {
  db: Database;
  health: HealthService;
  intelligence?: ActivityIntelligenceService;
  now?: () => Date;
}): Promise<AppServices> {
  await migrate(options.db);
  const repositories = createRepositories(options.db);
  const intelligence = options.intelligence ?? new RuleBasedActivityIntelligenceService(options.now);
  const sync = new SyncService({ health: options.health, repositories, intelligence, now: options.now });
  const activity = new ActivityService({ sync, repositories, provider: options.health.provider, now: options.now });
  return { health: options.health, repositories, intelligence, activity };
}
