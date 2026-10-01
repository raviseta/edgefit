import type { Database } from '../Database';
import { InsightRepository } from './InsightRepository';
import { SettingsRepository } from './SettingsRepository';
import { SummaryRepository } from './SummaryRepository';
import { WorkoutRepository } from './WorkoutRepository';

export { InsightRepository, SettingsRepository, SummaryRepository, WorkoutRepository };

export interface Repositories {
  summaries: SummaryRepository;
  workouts: WorkoutRepository;
  insights: InsightRepository;
  settings: SettingsRepository;
  /** Wipe every table EdgeFit owns. Health data in HealthKit itself is untouched. */
  clearAll(): Promise<void>;
}

export function createRepositories(db: Database): Repositories {
  const summaries = new SummaryRepository(db);
  const workouts = new WorkoutRepository(db);
  const insights = new InsightRepository(db);
  const settings = new SettingsRepository(db);
  return {
    summaries,
    workouts,
    insights,
    settings,
    clearAll: () =>
      db.transaction(async () => {
        await summaries.clear();
        await workouts.clear();
        await insights.clear();
        await settings.clear();
      }),
  };
}
