import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = unknown[];
const flat = (args: unknown[]): Params => (args.length === 1 && Array.isArray(args[0]) ? (args[0] as Params) : args);

/** The slice of expo-sqlite's async API that the app uses, backed by Node's built-in SQLite. */
export function testDb(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => void raw.exec(sql),
    runAsync: async (sql: string, ...args: unknown[]) => void raw.prepare(sql).run(...(flat(args) as never[])),
    getFirstAsync: async (sql: string, ...args: unknown[]) => (raw.prepare(sql).get(...(flat(args) as never[])) as never) ?? null,
    getAllAsync: async (sql: string, ...args: unknown[]) => raw.prepare(sql).all(...(flat(args) as never[])) as never,
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}
