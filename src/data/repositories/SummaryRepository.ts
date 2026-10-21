import { toDateKey } from '@/domain/dates';
import { HEALTH_METRICS, type DailySummary, type DateKey, type HealthMetric, type StoredDailySummary } from '@/domain/models';
import type { Database } from '../Database';

interface SummaryRow {
  date: string;
  steps: number | null;
  active_calories: number | null;
  active_minutes: number | null;
  workout_count: number;
  workout_minutes: number;
  activity_score: number | null;
}

const toSummary = (row: SummaryRow): DailySummary => ({
  date: row.date,
  steps: row.steps,
  activeCalories: row.active_calories,
  activeMinutes: row.active_minutes,
  workoutCount: row.workout_count,
  workoutMinutes: row.workout_minutes,
  activityScore: row.activity_score,
});

/** `complete` column bit for each metric. */
const bit = (metric: HealthMetric) => 1 << HEALTH_METRICS.indexOf(metric);
const maskOf = (metrics: readonly HealthMetric[]) => metrics.reduce((mask, m) => mask | bit(m), 0);

export class SummaryRepository {
  constructor(private readonly db: Database) {}

  /**
   * Each metric in `freshMetrics` is marked complete when written after its row's
   * local day ended, judged in the writer's time zone so later travel can't
   * reclassify it. Metrics re-saved from the cache keep the completeness they had
   * (none, for a new row). A day that hasn't ended yet for the writer is never
   * complete, which also undoes flags set while the device clock was ahead.
   */
  async upsertMany(
    summaries: DailySummary[],
    updatedAt: Date = new Date(),
    freshMetrics: readonly HealthMetric[] = HEALTH_METRICS,
  ): Promise<void> {
    const writtenOn = toDateKey(updatedAt);
    const fresh = maskOf(freshMetrics);
    await this.db.transaction(async () => {
      for (const s of summaries) {
        await this.db.run(
          `INSERT INTO daily_summaries
             (date, steps, active_calories, active_minutes, workout_count, workout_minutes, activity_score, updated_at, complete)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps,
             active_calories = excluded.active_calories,
             active_minutes = excluded.active_minutes,
             workout_count = excluded.workout_count,
             workout_minutes = excluded.workout_minutes,
             activity_score = excluded.activity_score,
             updated_at = excluded.updated_at,
             complete = CASE WHEN ? THEN excluded.complete | (daily_summaries.complete & ~?) ELSE 0 END`,
          [
            s.date,
            s.steps,
            s.activeCalories,
            s.activeMinutes,
            s.workoutCount,
            s.workoutMinutes,
            s.activityScore,
            updatedAt.toISOString(),
            s.date < writtenOn ? fresh : 0,
            s.date < writtenOn ? 1 : 0,
            fresh,
          ],
        );
      }
    });
  }

  /** Inclusive range, oldest first. Days without a stored row are simply absent. */
  async getRange(start: DateKey, end: DateKey): Promise<DailySummary[]> {
    const rows = await this.db.getAll<SummaryRow>(
      'SELECT * FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [start, end],
    );
    return rows.map(toSummary);
  }

  /** Like `getRange`, including each row's per-metric completeness. */
  async getStoredRange(start: DateKey, end: DateKey): Promise<StoredDailySummary[]> {
    const rows = await this.db.getAll<SummaryRow & { complete: number }>(
      'SELECT * FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [start, end],
    );
    return rows.map((row) => ({
      ...toSummary(row),
      complete: Object.fromEntries(HEALTH_METRICS.map((m) => [m, (row.complete & bit(m)) !== 0])) as Record<HealthMetric, boolean>,
    }));
  }

  async getByDate(date: DateKey): Promise<DailySummary | null> {
    const row = await this.db.getFirst<SummaryRow>('SELECT * FROM daily_summaries WHERE date = ?', [date]);
    return row ? toSummary(row) : null;
  }

  async deleteBefore(date: DateKey): Promise<void> {
    await this.db.run('DELETE FROM daily_summaries WHERE date < ?', [date]);
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM daily_summaries');
  }
}
