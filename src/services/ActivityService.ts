import { lastNDayKeys } from '@/domain/dates';
import type { ActivityInsight, AppSettings, DailySummary, DateKey, Workout } from '@/domain/models';
import type { HealthProviderKind } from '@/health/HealthService';
import type { Repositories } from '@/data/repositories';
import { logger } from '@/lib/logger';
import { HISTORY_DAYS, type SyncOutcome, type SyncService } from './SyncService';

export interface HistoryDay {
  date: DateKey;
  summary: DailySummary | null;
}

/** Everything the screens render, read from local storage after a sync attempt. */
export interface ActivitySnapshot {
  settings: AppSettings;
  provider: HealthProviderKind;
  sync: SyncOutcome | { status: 'failed' };
  today: DailySummary | null;
  /** Last 7 days, oldest first; `summary` is null for days with no stored data. */
  history: HistoryDay[];
  insights: ActivityInsight[];
  workouts: Workout[];
  refreshedAt: string;
}

/**
 * Read model for the UI. A failed health sync is *recoverable*: cached data is
 * still returned along with `sync.status === 'failed'`. A failed database read
 * is not, and propagates so the screen can show an error state.
 */
export class ActivityService {
  constructor(
    private readonly deps: {
      sync: SyncService;
      repositories: Repositories;
      provider: HealthProviderKind;
      now?: () => Date;
    },
  ) {}

  async refresh(): Promise<ActivitySnapshot> {
    let sync: ActivitySnapshot['sync'];
    try {
      sync = await this.deps.sync.sync();
    } catch (error) {
      logger.error('sync.failed', error, { provider: this.deps.provider });
      sync = { status: 'failed' };
    }
    return this.read(sync);
  }

  private async read(sync: ActivitySnapshot['sync']): Promise<ActivitySnapshot> {
    const { repositories } = this.deps;
    const now = this.deps.now?.() ?? new Date();
    const days = lastNDayKeys(HISTORY_DAYS, now);

    const [settings, summaries, insights, workouts] = await Promise.all([
      repositories.settings.get(),
      repositories.summaries.getRange(days[0]!, days[days.length - 1]!),
      repositories.insights.list(),
      repositories.workouts.list(),
    ]);

    const byDate = new Map(summaries.map((s) => [s.date, s]));
    const history = days.map((date) => ({ date, summary: byDate.get(date) ?? null }));

    return {
      settings,
      provider: this.deps.provider,
      sync,
      today: history[history.length - 1]?.summary ?? null,
      history,
      insights: settings.analyticsEnabled ? insights : [],
      workouts,
      refreshedAt: now.toISOString(),
    };
  }
}
