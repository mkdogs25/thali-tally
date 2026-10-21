import type { SQLiteDatabase } from 'expo-sqlite';
import { SYNCED_KEYS } from '../db';

/**
 * Two-way sync between the phone's SQLite database and an account on a server.
 *
 * The phone stays the source of truth and always works offline. Each synced row has an `updated_at` (set by the
 * device that made the change) and a `dirty` flag ("changed here since the last successful sync"). A sync first
 * pulls what changed on the server, then pushes what is dirty. When two devices changed the same row, the later
 * `updated_at` wins. Deletes travel as tombstones (`deleted = 1`) so other devices hear about them.
 */

export type SyncTable = 'food_log' | 'weight_log' | 'recipes' | 'settings';

export type RemoteRow = Record<string, unknown>;

/** The server side, kept abstract so the engine can be tested without a network. */
export interface Remote {
  /**
   * Rows changed on the server at or after `after` (an opaque, server-assigned cursor), oldest first, at most
   * `limit`. The cursor is inclusive on purpose: re-applying a row is harmless, whereas skipping rows that
   * share a timestamp would lose them.
   */
  pull(table: SyncTable, after: string | null, limit: number): Promise<RemoteRow[]>;
  /** Inserts or overwrites rows by their key. */
  push(table: SyncTable, rows: RemoteRow[]): Promise<void>;
}

interface TableDef {
  remote: SyncTable;
  local: string;
  key: string;
  /** Data columns, not counting the key, `updated_at`, `deleted` and `dirty`. */
  columns: string[];
  hasDeleted: boolean;
  /** Columns held as JSON text locally and as real JSON on the server. */
  json: string[];
}

export const TABLES: TableDef[] = [
  { remote: 'settings', local: 'kv', key: 'key', columns: ['value'], hasDeleted: false, json: ['value'] },
  { remote: 'weight_log', local: 'weight_log', key: 'date', columns: ['kg', 'source'], hasDeleted: true, json: [] },
  { remote: 'recipes', local: 'recipes', key: 'uid', columns: ['name', 'servings', 'ingredients', 'created_at'], hasDeleted: true, json: ['ingredients'] },
  {
    remote: 'food_log',
    local: 'food_log',
    key: 'uid',
    columns: ['date', 'meal', 'name', 'qty', 'kcal', 'protein', 'carbs', 'fat', 'source', 'created_at'],
    hasDeleted: true,
    json: [],
  },
];

const PAGE = 500;
const PUSH_BATCH = 200;

const SYNCED_KEY_SET: ReadonlySet<string> = new Set(SYNCED_KEYS);

// --- local key/value for sync bookkeeping (never synced itself) ------------------------------

async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value, updated_at, dirty) VALUES (?, ?, ?, 0)', key, value, Date.now());
}

const cursorKey = (t: SyncTable) => `sync.cursor.${t}`;

// --- row mapping ------------------------------------------------------------------------------

function toRemote(def: TableDef, row: Record<string, unknown>): RemoteRow {
  const out: RemoteRow = { [def.key]: row[def.key], updated_at: row.updated_at };
  for (const c of def.columns) {
    const v = row[c];
    out[c] = def.json.includes(c) && typeof v === 'string' ? JSON.parse(v) : v;
  }
  if (def.hasDeleted) out.deleted = row.deleted === 1;
  return out;
}

function fromRemote(def: TableDef, row: RemoteRow): Record<string, unknown> {
  const out: Record<string, unknown> = { [def.key]: row[def.key], updated_at: Number(row.updated_at) };
  for (const c of def.columns) {
    const v = row[c];
    out[c] = def.json.includes(c) ? JSON.stringify(v) : v ?? null;
  }
  if (def.hasDeleted) out.deleted = row.deleted ? 1 : 0;
  return out;
}

// --- pull -----------------------------------------------------------------------------------------

/** Applies one server row to the phone. Returns true if the phone's data actually changed. */
async function applyRemoteRow(db: SQLiteDatabase, def: TableDef, remote: RemoteRow): Promise<boolean> {
  const key = remote[def.key];
  if (typeof key !== 'string') return false;
  // Only the settings this app knows about may be written, so a remote row can never overwrite local-only keys.
  if (def.local === 'kv' && !SYNCED_KEY_SET.has(key)) return false;

  const row = fromRemote(def, remote);
  const local = await db.getFirstAsync<{ updated_at: number; dirty: number }>(
    `SELECT updated_at, dirty FROM ${def.local} WHERE ${def.key} = ?`,
    key,
  );
  const cols = [...def.columns, 'updated_at', ...(def.hasDeleted ? ['deleted'] : [])];

  if (!local) {
    const names = [def.key, ...cols, 'dirty'];
    await db.runAsync(
      `INSERT INTO ${def.local} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      [row[def.key], ...cols.map((c) => row[c]), 0] as never[],
    );
    return true;
  }
  // A local edit that has not been pushed yet and is newer than the server's copy wins and will be pushed.
  if (local.dirty === 1 && Number(row.updated_at) < local.updated_at) return false;
  // The inclusive cursor re-reads the boundary row; if it is already here there is nothing to do.
  if (local.dirty === 0 && Number(row.updated_at) === local.updated_at) return false;
  await db.runAsync(
    `UPDATE ${def.local} SET ${cols.map((c) => `${c} = ?`).join(', ')}, dirty = 0 WHERE ${def.key} = ?`,
    [...cols.map((c) => row[c]), key] as never[],
  );
  return true;
}

async function pullTable(db: SQLiteDatabase, remote: Remote, def: TableDef): Promise<{ read: number; changed: number }> {
  let after = await getMeta(db, cursorKey(def.remote));
  let total = 0;
  let changed = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const rows = await remote.pull(def.remote, after, PAGE);
    for (const r of rows) if (await applyRemoteRow(db, def, r)) changed++;
    total += rows.length;
    const last = rows.length > 0 ? String(rows[rows.length - 1].server_ts ?? '') : null;
    if (last) {
      await setMeta(db, cursorKey(def.remote), last);
    }
    // The cursor is inclusive, so a final short page, or one that did not move, means we are caught up.
    if (rows.length < PAGE || !last || last === after) break;
    after = last;
  }
  return { read: total, changed };
}

// --- push -------------------------------------------------------------------------------------------

async function pushTable(db: SQLiteDatabase, remote: Remote, def: TableDef): Promise<number> {
  const cols = [def.key, ...def.columns, 'updated_at', ...(def.hasDeleted ? ['deleted'] : [])];
  const where = def.local === 'kv' ? `dirty = 1 AND key IN (${SYNCED_KEYS.map(() => '?').join(',')})` : 'dirty = 1';
  const args = def.local === 'kv' ? [...SYNCED_KEYS] : [];
  let pushed = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${cols.join(', ')} FROM ${def.local} WHERE ${where} LIMIT ${PUSH_BATCH}`,
      args as never[],
    );
    if (rows.length === 0) break;
    await remote.push(def.remote, rows.map((r) => toRemote(def, r)));
    // Mark clean only if the row has not been edited again while the request was in flight.
    for (const r of rows) {
      await db.runAsync(`UPDATE ${def.local} SET dirty = 0 WHERE ${def.key} = ? AND updated_at = ?`, [r[def.key], r.updated_at] as never[]);
    }
    pushed += rows.length;
    if (rows.length < PUSH_BATCH) break;
  }
  return pushed;
}

export interface SyncStats {
  /** Rows read from the server. */
  pulled: number;
  /** Rows that actually changed this phone's data (so screens know to refresh). */
  changed: number;
  pushed: number;
}

/** Pulls then pushes every synced table. Throws if the server cannot be reached; nothing is lost, it just retries. */
export async function syncAll(db: SQLiteDatabase, remote: Remote): Promise<SyncStats> {
  const stats: SyncStats = { pulled: 0, changed: 0, pushed: 0 };
  for (const def of TABLES) {
    const r = await pullTable(db, remote, def);
    stats.pulled += r.read;
    stats.changed += r.changed;
  }
  for (const def of TABLES) stats.pushed += await pushTable(db, remote, def);
  return stats;
}

// --- who owns the data on this phone ---------------------------------------------------------------

export type OwnerCheck = 'ok' | 'other-account';

const OWNER_KEY = 'sync.owner';

async function hasLocalData(db: SQLiteDatabase): Promise<boolean> {
  for (const def of TABLES) {
    if (def.local === 'kv') continue;
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${def.local}`);
    if ((row?.n ?? 0) > 0) return true;
  }
  const marks = SYNCED_KEYS.map(() => '?').join(',');
  const kv = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM kv WHERE key IN (${marks})`, [...SYNCED_KEYS] as never[]);
  return (kv?.n ?? 0) > 0;
}

async function markAllDirty(db: SQLiteDatabase): Promise<void> {
  for (const def of TABLES) {
    if (def.local === 'kv') continue;
    await db.runAsync(`UPDATE ${def.local} SET dirty = 1`);
  }
  await db.runAsync(`UPDATE kv SET dirty = 1 WHERE key IN (${SYNCED_KEYS.map(() => '?').join(',')})`, [...SYNCED_KEYS] as never[]);
}

/**
 * Called after signing in. The first account to sign in on a phone adopts the data already there (it is
 * uploaded). A different account never silently mixes with it: the caller must ask, then call `takeOverPhone`.
 */
export async function checkOwner(db: SQLiteDatabase, userId: string): Promise<OwnerCheck> {
  const owner = await getMeta(db, OWNER_KEY);
  if (owner === userId) return 'ok';
  if (owner === null) {
    if (await hasLocalData(db)) await markAllDirty(db);
    await setMeta(db, OWNER_KEY, userId);
    return 'ok';
  }
  return 'other-account';
}

/** Replaces this phone's synced data with the signed-in account's (used after the person agrees). */
export async function takeOverPhone(db: SQLiteDatabase, userId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const def of TABLES) {
      if (def.local === 'kv') continue;
      await db.runAsync(`DELETE FROM ${def.local}`);
    }
    await db.runAsync(`DELETE FROM kv WHERE key IN (${SYNCED_KEYS.map(() => '?').join(',')})`, [...SYNCED_KEYS] as never[]);
    await db.runAsync("DELETE FROM kv WHERE key LIKE 'sync.cursor.%'");
    await setMeta(db, OWNER_KEY, userId);
  });
}

/** Forgets which account owns this phone's data and where sync was up to (a full resync follows the next sign-in). */
export async function forgetCursors(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("DELETE FROM kv WHERE key LIKE 'sync.cursor.%'");
}
