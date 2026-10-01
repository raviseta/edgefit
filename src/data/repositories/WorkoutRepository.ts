import type { Workout } from '@/domain/models';
import type { Database } from '../Database';

interface WorkoutRow {
  id: string;
  type: string;
  start_date: string;
  duration_minutes: number;
  calories: number | null;
}

const toWorkout = (row: WorkoutRow): Workout => {
  const workout: Workout = {
    id: row.id,
    type: row.type,
    startDate: row.start_date,
    durationMinutes: row.duration_minutes,
  };
  if (row.calories !== null) workout.calories = row.calories;
  return workout;
};

/** Cached workout metadata (type, time, duration, energy). No routes, heart rate or other samples. */
export class WorkoutRepository {
  constructor(private readonly db: Database) {}

  /**
   * Replace every cached workout that started within [start, end] with `workouts`.
   * This mirrors deletions made in the Health app instead of keeping stale rows.
   */
  async replaceRange(start: Date, end: Date, workouts: Workout[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM workouts WHERE start_date >= ? AND start_date <= ?', [
        start.toISOString(),
        end.toISOString(),
      ]);
      for (const w of workouts) {
        await this.db.run(
          `INSERT OR REPLACE INTO workouts (id, type, start_date, duration_minutes, calories)
           VALUES (?, ?, ?, ?, ?)`,
          [w.id, w.type, w.startDate, w.durationMinutes, w.calories ?? null],
        );
      }
    });
  }

  /** Most recent first. */
  async list(limit = 100): Promise<Workout[]> {
    const rows = await this.db.getAll<WorkoutRow>('SELECT * FROM workouts ORDER BY start_date DESC LIMIT ?', [limit]);
    return rows.map(toWorkout);
  }

  async deleteBefore(date: Date): Promise<void> {
    await this.db.run('DELETE FROM workouts WHERE start_date < ?', [date.toISOString()]);
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM workouts');
  }
}
