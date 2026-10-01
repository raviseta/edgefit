import type { Database, SqlValue } from '@/data/Database';

// Node's built-in SQLite runs the same SQL as expo-sqlite, so repository tests
// exercise real queries and migrations without a device.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: SqlValue[]): unknown;
      all(...params: SqlValue[]): unknown[];
      get(...params: SqlValue[]): unknown;
    };
    close(): void;
  };
};

export class NodeSqliteDatabase implements Database {
  private readonly db = new DatabaseSync(':memory:');
  /** Set to make every call reject, for exercising database-failure paths. */
  failing = false;

  private guard() {
    if (this.failing) throw new Error('Simulated database failure');
  }

  async exec(sql: string) {
    this.guard();
    this.db.exec(sql);
  }

  async run(sql: string, params: SqlValue[] = []) {
    this.guard();
    this.db.prepare(sql).run(...params);
  }

  async getAll<T>(sql: string, params: SqlValue[] = []) {
    this.guard();
    return this.db.prepare(sql).all(...params).map((row) => ({ ...(row as object) })) as T[];
  }

  async getFirst<T>(sql: string, params: SqlValue[] = []) {
    this.guard();
    const row = this.db.prepare(sql).get(...params);
    return row ? ({ ...(row as object) } as T) : null;
  }

  async transaction(task: () => Promise<void>) {
    this.guard();
    // Like expo-sqlite, nesting is not supported: a nested BEGIN throws.
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}
