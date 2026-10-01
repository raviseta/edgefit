import type { ActivityInsight, InsightType } from '@/domain/models';
import type { Database } from '../Database';

interface InsightRow {
  id: string;
  type: string;
  title: string;
  message: string;
  generated_at: string;
}

export class InsightRepository {
  constructor(private readonly db: Database) {}

  /** Insights are regenerated on every sync, so the stored set is replaced wholesale (order preserved). */
  async replaceAll(insights: ActivityInsight[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM insights');
      for (const [position, i] of insights.entries()) {
        await this.db.run(
          'INSERT INTO insights (id, type, title, message, generated_at, position) VALUES (?, ?, ?, ?, ?, ?)',
          [i.id, i.type, i.title, i.message, i.generatedAt, position],
        );
      }
    });
  }

  async list(): Promise<ActivityInsight[]> {
    const rows = await this.db.getAll<InsightRow>('SELECT * FROM insights ORDER BY position ASC');
    return rows.map((row) => ({
      id: row.id,
      type: row.type as InsightType,
      title: row.title,
      message: row.message,
      generatedAt: row.generated_at,
    }));
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM insights');
  }
}
