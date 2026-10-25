import { EMPTY_GOAL_PREFERENCES, isValidStepGoal, type GoalPreferences } from '@/domain/stepGoals';
import type { Database } from '../Database';

/** Reuses the existing settings table; clearAll already deletes these keys. */
export class GoalRepository {
  constructor(private readonly db: Database) {}
  async get(): Promise<GoalPreferences> {
    const row = await this.db.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['stepGoalPreferences']);
    if (row) {
      try {
        const value = JSON.parse(row.value) as GoalPreferences;
        if (value && (value.dismissedUntil === null || /^\d{4}-\d{2}-\d{2}$/.test(value.dismissedUntil)) &&
          (value.goal === null || (value.goal && isValidStepGoal(value.goal.activeSteps) &&
            ['manual', 'accepted_suggestion'].includes(value.goal.source) && Number.isFinite(Date.parse(value.goal.updatedAt))))) return value;
      } catch { /* Corrupt preferences fall back to no goal. */ }
    }
    return { ...EMPTY_GOAL_PREFERENCES };
  }
  async save(value: GoalPreferences): Promise<void> {
    await this.db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['stepGoalPreferences', JSON.stringify(value)]);
  }
}
