import { buildActivityData, buildDailySummaries } from '@/domain/aggregation';
import { addDays, lastNDayKeys, lastNDaysRange, startOfDay, toDateKey } from '@/domain/dates';
import type { DailyQuantity, HealthService } from '@/health/HealthService';
import { normalizeWorkout } from '@/health/normalization';
import type { ActivityIntelligenceService } from '@/intelligence/ActivityIntelligenceService';
import { BASELINE_WINDOW_DAYS } from '@/intelligence/features';
import type { Repositories } from '@/data/repositories';
import { logger } from '@/lib/logger';

/** Days shown on the Activity screen (including today). */
export const HISTORY_DAYS = 7;
/** Days of activity read per sync: today plus the 7-day insight baseline. */
export const ACTIVITY_SYNC_DAYS = BASELINE_WINDOW_DAYS + 1;
/** Workouts shown in Workout History. */
export const WORKOUT_SYNC_DAYS = 30;
/** Retention: processed data older than this is deleted on every sync. */
export const RETENTION_DAYS = 30;

export type SyncOutcome =
  | { status: 'synced'; failedMetrics: string[] }
  | { status: 'health-disabled' }
  | { status: 'unavailable' };

export interface SyncDependencies {
  health: HealthService;
  repositories: Repositories;
  intelligence: ActivityIntelligenceService;
  now?: () => Date;
}

/**
 * The processing pipeline:
 *   Health platform → normalization → aggregation (+score) → SQLite → insights
 *
 * Only aggregates leave the HealthService; nothing here performs network I/O.
 */
export class SyncService {
  constructor(private readonly deps: SyncDependencies) {}

  async sync(): Promise<SyncOutcome> {
    const { health, repositories, intelligence } = this.deps;
    const now = this.deps.now?.() ?? new Date();
    const settings = await repositories.settings.get();

    if (!settings.healthDataEnabled) {
      return { status: 'health-disabled' };
    }
    if (!(await health.isAvailable())) {
      return { status: 'unavailable' };
    }

    const days = lastNDayKeys(ACTIVITY_SYNC_DAYS, now);
    const { start, end } = lastNDaysRange(ACTIVITY_SYNC_DAYS, now);
    const workoutRange = lastNDaysRange(WORKOUT_SYNC_DAYS, now);

    const [steps, activeCalories, activeMinutes, workoutData] = await Promise.allSettled([
      health.getSteps(start, end),
      health.getActiveCalories(start, end),
      health.getActiveMinutes(start, end),
      health.getWorkouts(workoutRange.start, workoutRange.end),
    ]);

    const failedMetrics: string[] = [];
    const valueOf = (name: string, result: PromiseSettledResult<DailyQuantity[]>): DailyQuantity[] => {
      if (result.status === 'fulfilled') return result.value;
      failedMetrics.push(name);
      logger.warn('health.query_failed', result.reason, { metric: name, provider: health.provider });
      return [];
    };

    const activity = buildActivityData(days, {
      steps: valueOf('steps', steps),
      activeCalories: valueOf('activeCalories', activeCalories),
      activeMinutes: valueOf('activeMinutes', activeMinutes),
    });

    let workouts = null;
    if (workoutData.status === 'fulfilled') {
      workouts = workoutData.value.map(normalizeWorkout);
    } else {
      failedMetrics.push('workouts');
      logger.warn('health.query_failed', workoutData.reason, { metric: 'workouts', provider: health.provider });
    }

    if (failedMetrics.length === 4) {
      throw new HealthSyncError('All health queries failed');
    }

    if (workouts) {
      await repositories.workouts.replaceRange(workoutRange.start, workoutRange.end, workouts);
    }
    // Score with whatever workouts are cached if the workout query failed this time.
    const workoutsForScoring = workouts ?? (await repositories.workouts.list());
    await repositories.summaries.upsertMany(buildDailySummaries(activity, workoutsForScoring), now);

    const cutoff = addDays(startOfDay(now), -(RETENTION_DAYS - 1));
    await repositories.summaries.deleteBefore(toDateKey(cutoff));
    await repositories.workouts.deleteBefore(cutoff);

    const insights = settings.analyticsEnabled ? await intelligence.generateInsights(activity) : [];
    await repositories.insights.replaceAll(insights);

    return { status: 'synced', failedMetrics };
  }
}

export class HealthSyncError extends Error {
  override name = 'HealthSyncError';
}
