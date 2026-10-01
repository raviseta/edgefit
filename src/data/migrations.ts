import type { Database } from './Database';

/**
 * Schema migrations, tracked with `PRAGMA user_version`.
 *
 * Only processed, per-day data is stored. Raw HealthKit samples are never
 * persisted. Metric columns are nullable: NULL = no data reported.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY NOT NULL,
    steps INTEGER,
    active_calories INTEGER,
    active_minutes INTEGER,
    workout_count INTEGER NOT NULL DEFAULT 0,
    workout_minutes INTEGER NOT NULL DEFAULT 0,
    activity_score INTEGER,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    calories INTEGER
  );
  CREATE INDEX IF NOT EXISTS workouts_start_date ON workouts (start_date);
  CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Database): Promise<void> {
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[version]!);
      await db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
