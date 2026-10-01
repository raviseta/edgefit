import * as SQLite from 'expo-sqlite';

import type { Database, SqlValue } from './Database';

export const DATABASE_NAME = 'edgefit.db';

/** expo-sqlite adapter. The database file lives in the app's private sandbox. */
export class SqliteDatabase implements Database {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(name = DATABASE_NAME): Promise<SqliteDatabase> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    return new SqliteDatabase(db);
  }

  exec(sql: string) {
    return this.db.execAsync(sql);
  }

  async run(sql: string, params: SqlValue[] = []) {
    await this.db.runAsync(sql, params);
  }

  getAll<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getAllAsync<T>(sql, params);
  }

  getFirst<T>(sql: string, params: SqlValue[] = []) {
    return this.db.getFirstAsync<T>(sql, params);
  }

  transaction(task: () => Promise<void>) {
    return this.db.withTransactionAsync(task);
  }
}
