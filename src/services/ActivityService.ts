import { buildCalendarDays, CALENDAR_DAYS, summarizeCalendar, type CalendarDay, type CalendarSummary } from '@/domain/calendar';
import { addDays, addDaysToKey, fromDateKey, lastNDayKeys } from '@/domain/dates';
import type { ActivityInsight, AppSettings, DailySummary, DateKey, Workout } from '@/domain/models';
import type { HealthProviderKind } from '@/health/HealthService';
import { buildPersonalInsights, PERSONAL_INSIGHT_LOOKBACK_DAYS, type PersonalInsights } from '@/intelligence/personalInsights';
import type { Repositories } from '@/data/repositories';
import { logger } from '@/lib/logger';
import { HISTORY_DAYS, type SyncOutcome, type SyncService } from './SyncService';

/** The 30-day calendar, read from local storage only. */
export interface CalendarSnapshot {
  settings: AppSettings;
  provider: HealthProviderKind;
  /** Oldest first; exactly CALENDAR_DAYS entries ending today. */
  days: CalendarDay[];
  summary: CalendarSummary;
  refreshedAt: string;
}

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
  /** Two-week personal insights from saved data; null when insights are turned off. */
  personalInsights: PersonalInsights | null;
  workouts: Workout[];
  refreshedAt: string;
}

/**
 * Read model for the UI. A failed health sync is *recoverable*: cached data is
 * still returned along with `sync.status === 'failed'`. A failed database read
 * is not, and propagates so the screen can show an error state.
 *
 * Syncs and Clear Local Data run one at a time, so a sync that started before
 * a clear cannot write health data back afterwards, and overlapping refreshes
 * (focus refetch + pull-to-refresh) share one sync.
 */
export class ActivityService {
  private queue: Promise<unknown> = Promise.resolve();
  private inFlight: Promise<ActivitySnapshot> | null = null;

  constructor(
    private readonly deps: {
      sync: SyncService;
      repositories: Repositories;
      provider: HealthProviderKind;
      now?: () => Date;
    },
  ) {}

  refresh(): Promise<ActivitySnapshot> {
    if (!this.inFlight) {
      this.inFlight = this.exclusive(() => this.syncAndRead()).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /**
   * Reads the 30-day calendar from persisted summaries and workouts. Does not
   * sync: screens refresh health data through `refresh()`.
   */
  async getCalendar(): Promise<CalendarSnapshot> {
    const { repositories } = this.deps;
    const now = this.deps.now?.() ?? new Date();
    const keys = lastNDayKeys(CALENDAR_DAYS, now);
    const [settings, summaries, workouts] = await Promise.all([
      repositories.settings.get(),
      repositories.summaries.getRange(keys[0]!, keys[keys.length - 1]!),
      repositories.workouts.listStartedBetween(fromDateKey(keys[0]!), addDays(fromDateKey(keys[keys.length - 1]!), 1)),
    ]);
    const days = buildCalendarDays(now, summaries, workouts);
    return {
      settings,
      provider: this.deps.provider,
      days,
      summary: summarizeCalendar(days),
      refreshedAt: now.toISOString(),
    };
  }

  /** Wipes every EdgeFit table once any running sync has finished. Health data itself is untouched. */
  clearLocalData(): Promise<void> {
    return this.exclusive(() => this.deps.repositories.clearAll());
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async syncAndRead(): Promise<ActivitySnapshot> {
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
    const today = days[days.length - 1]!;
    const lookbackStart = addDaysToKey(today, -PERSONAL_INSIGHT_LOOKBACK_DAYS);

    // One read covers both the 7-day history and the two-week insight window.
    const [settings, stored, insights, workouts, lookbackWorkouts] = await Promise.all([
      repositories.settings.get(),
      repositories.summaries.getStoredRange(lookbackStart, today),
      repositories.insights.list(),
      repositories.workouts.list(),
      // `list()` is capped, so the insight window gets its own bounded query.
      repositories.workouts.listStartedBetween(fromDateKey(lookbackStart), fromDateKey(today)),
    ]);

    const byDate = new Map(stored.map(({ complete: _complete, ...summary }) => [summary.date, summary]));
    const history = days.map((date) => ({ date, summary: byDate.get(date) ?? null }));

    return {
      settings,
      provider: this.deps.provider,
      sync,
      today: history[history.length - 1]?.summary ?? null,
      history,
      insights: settings.analyticsEnabled ? insights : [],
      personalInsights: settings.analyticsEnabled
        ? buildPersonalInsights({
            now,
            summaries: stored,
            workouts: lookbackWorkouts,
          })
        : null,
      workouts,
      refreshedAt: now.toISOString(),
    };
  }
}
