/**
 * Minimal SQL database port. The app uses expo-sqlite; tests use Node's
 * built-in SQLite against the same SQL, so repository tests exercise real
 * queries without a device.
 */
export type SqlValue = string | number | null;

export interface Database {
  /** Run one or more statements without parameters (DDL, PRAGMA). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  getAll<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(task: () => Promise<void>): Promise<void>;
}
