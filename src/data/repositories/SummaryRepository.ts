import type { DailySummary, DateKey } from '@/domain/models';
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

export class SummaryRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(summaries: DailySummary[], updatedAt: Date = new Date()): Promise<void> {
    await this.db.transaction(async () => {
      for (const s of summaries) {
        await this.db.run(
          `INSERT INTO daily_summaries
             (date, steps, active_calories, active_minutes, workout_count, workout_minutes, activity_score, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps,
             active_calories = excluded.active_calories,
             active_minutes = excluded.active_minutes,
             workout_count = excluded.workout_count,
             workout_minutes = excluded.workout_minutes,
             activity_score = excluded.activity_score,
             updated_at = excluded.updated_at`,
          [
            s.date,
            s.steps,
            s.activeCalories,
            s.activeMinutes,
            s.workoutCount,
            s.workoutMinutes,
            s.activityScore,
            updatedAt.toISOString(),
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
