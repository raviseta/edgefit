import { stepTargetFor } from '@/domain/activityScore';
import { rescoreSummaries } from '@/domain/aggregation';
import { buildCalendarDays, CALENDAR_DAYS, goalStreak, summarizeCalendar, type CalendarDay, type CalendarSummary } from '@/domain/calendar';
import { addDays, addDaysToKey, fromDateKey, lastNDayKeys } from '@/domain/dates';
import { HEALTH_METRICS, type ActivityInsight, type AppSettings, type DailySummary, type DateKey, type Workout } from '@/domain/models';
import type { HealthProviderKind } from '@/health/HealthService';
import { buildPersonalInsights, PERSONAL_INSIGHT_LOOKBACK_DAYS, type PersonalInsights } from '@/intelligence/personalInsights';
import type { Repositories } from '@/data/repositories';
import { isValidStepGoal, suggestStepGoal, type GoalPreferences, type GoalSuggestion } from '@/domain/stepGoals';
import { logger } from '@/lib/logger';
import { ACTIVITY_SYNC_DAYS, HISTORY_DAYS, type SyncOutcome, type SyncService } from './SyncService';

/** The 30-day calendar, read from local storage only. */
export interface CalendarSnapshot {
  settings: AppSettings;
  provider: HealthProviderKind;
  /** Oldest first; exactly CALENDAR_DAYS entries ending today. */
  days: CalendarDay[];
  summary: CalendarSummary;
  /** Days in a row at the step goal; null when no goal is set. */
  goalStreak: number | null;
  refreshedAt: string;
}

export interface HistoryDay {
  date: DateKey;
  summary: DailySummary | null;
}

/** Everything the screens render, read from local storage after a sync attempt. */
export interface ActivitySnapshot {
  stepGoals: {
    generation: number;
    preferences: GoalPreferences;
    suggestion: GoalSuggestion;
    /** Days in a row at the goal; null when no goal is set. */
    streak: number | null;
  };
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
  private generation = 0;
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
    const [settings, summaries, workouts, { goal }] = await Promise.all([
      repositories.settings.get(),
      repositories.summaries.getStoredRange(keys[0]!, keys[keys.length - 1]!),
      repositories.workouts.listStartedBetween(fromDateKey(keys[0]!), addDays(fromDateKey(keys[keys.length - 1]!), 1)),
      repositories.goals.get(),
    ]);
    const days = buildCalendarDays(now, summaries.map(({ complete: _complete, ...summary }) => summary), workouts);
    return {
      settings,
      provider: this.deps.provider,
      days,
      summary: summarizeCalendar(days),
      goalStreak: goal ? goalStreak(summaries, goal.activeSteps, now) : null,
      refreshedAt: now.toISOString(),
    };
  }

  /** Wipes every EdgeFit table once any running sync has finished. Health data itself is untouched. */
  clearLocalData(): Promise<void> {
    this.generation += 1;
    return this.exclusive(async () => {
      await this.deps.repositories.clearAll();
      // Also invalidate snapshots read while deletion was waiting behind a sync.
      this.generation += 1;
    });
  }

  /** Uses the same queue as sync and deletion; old screen actions cannot restore cleared preferences. */
  updateStepGoal(action: { kind: 'manual'; steps: number } | { kind: 'accept' | 'dismiss'; token: string }, generation: number): Promise<ActivitySnapshot> {
    return this.exclusive(async () => {
      if (generation !== this.generation) throw new Error('Local data changed. Reopen the goal card.');
      const snapshot = await this.syncAndRead();
      const { preferences, suggestion } = snapshot.stepGoals;
      const now = this.deps.now?.() ?? new Date();
      if (action.kind === 'manual') {
        if (!isValidStepGoal(action.steps)) throw new Error('Enter a whole number from 1 to 100,000.');
        preferences.goal = { activeSteps: action.steps, source: 'manual', updatedAt: now.toISOString() };
        preferences.dismissedUntil = null;
      } else {
        if (suggestion.status !== 'suggested' || suggestion.token !== action.token) throw new Error('Activity changed. Review the refreshed suggestion before continuing.');
        if (action.kind === 'accept') {
          preferences.goal = { activeSteps: suggestion.suggestedSteps, source: 'accepted_suggestion', updatedAt: now.toISOString() };
          preferences.dismissedUntil = null;
        } else {
          // A week of new complete days is required before another prompt.
          preferences.dismissedUntil = addDaysToKey(suggestion.periodEndLocal, 8);
        }
      }
      if (generation !== this.generation) throw new Error('Local data changed. Reopen the goal card.');
      await this.deps.repositories.goals.save(preferences);
      if (action.kind !== 'dismiss') await this.rescoreSyncWindow(preferences.goal?.activeSteps, now);
      return this.read(snapshot.sync);
    });
  }

  get goalGeneration(): number { return this.generation; }

  /** Re-scores the days every sync rewrites, so a new goal shows at once rather than after the next sync. */
  private async rescoreSyncWindow(goalSteps: number | undefined, now: Date): Promise<void> {
    const { summaries } = this.deps.repositories;
    const keys = lastNDayKeys(ACTIVITY_SYNC_DAYS, now);
    const stored = await summaries.getRange(keys[0]!, keys[keys.length - 1]!);
    await summaries.updateScores(rescoreSummaries(stored, stepTargetFor(goalSteps)));
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
    const storedStart = addDaysToKey(today, -(CALENDAR_DAYS - 1));

    // One read covers the 7-day history, the two-week insight window and the goal streak.
    const [settings, stored, insights, workouts, lookbackWorkouts, preferences] = await Promise.all([
      repositories.settings.get(),
      repositories.summaries.getStoredRange(storedStart, today),
      repositories.insights.list(),
      repositories.workouts.list(),
      // `list()` is capped, so the insight window gets its own bounded query.
      repositories.workouts.listStartedBetween(fromDateKey(lookbackStart), fromDateKey(today)),
      repositories.goals.get(),
    ]);

    const byDate = new Map(stored.map(({ complete: _complete, ...summary }) => [summary.date, summary]));
    const history = days.map((date) => ({ date, summary: byDate.get(date) ?? null }));

    return {
      settings,
      provider: this.deps.provider,
      sync,
      stepGoals: {
        generation: this.generation,
        preferences,
        suggestion: suggestStepGoal({ now, summaries: stored, preferences,
          available: settings.insightsEnabled && settings.healthDataEnabled && sync.status === 'synced' && !sync.failedMetrics.includes('steps'),
        }),
        streak: preferences.goal ? goalStreak(stored, preferences.goal.activeSteps, now) : null,
      },
      today: history[history.length - 1]?.summary ?? null,
      history,
      insights: settings.insightsEnabled ? insights : [],
      personalInsights: settings.insightsEnabled
        ? buildPersonalInsights({
            now,
            summaries: stored,
            workouts: lookbackWorkouts,
            unavailableMetrics: sync.status === 'synced'
              ? HEALTH_METRICS.filter((metric) => sync.failedMetrics.includes(metric))
              : HEALTH_METRICS,
          })
        : null,
      workouts,
      refreshedAt: now.toISOString(),
    };
  }
}
