import type { SQLiteDatabase } from 'expo-sqlite';
import type { MealType, Nutrition, Part } from './foods';
import type { SourceId, Workout } from './health/types';
import type { Plan, Profile } from './plan';

export const DB_NAME = 'thali-tally.db';

/** Creates / upgrades the local database. Everything the app stores lives in this one on-device file. */
export const SCHEMA_VERSION = 2;

export async function migrate(db: SQLiteDatabase, target: number = SCHEMA_VERSION): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1 && target >= 1) await createV1(db);
  if (version < 2 && target >= 2) await upgradeToV2(db);
}

async function createV1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE food_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      name TEXT NOT NULL,
      qty TEXT,
      kcal REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX food_log_date ON food_log(date);
    CREATE TABLE weight_log (date TEXT PRIMARY KEY, kg REAL NOT NULL);
    CREATE TABLE recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      servings REAL NOT NULL,
      ingredients TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE step_days (date TEXT PRIMARY KEY, steps INTEGER NOT NULL);
    PRAGMA user_version = 1;
  `);
}

/** v2: health-app sync — workouts, per-day active energy, and where a weight came from. */
async function upgradeToV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE step_days ADD COLUMN active_kcal REAL;
    ALTER TABLE step_days ADD COLUMN energy_basis TEXT;
    ALTER TABLE weight_log ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
    CREATE TABLE workouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      app TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      kcal REAL,
      distance_m REAL
    );
    CREATE INDEX workouts_date ON workouts(date);
    PRAGMA user_version = 2;
  `);
}

// --- key/value (profile, plan, settings) ----------------------------------

async function getJson<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function setJson(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export const getProfile = (db: SQLiteDatabase) => getJson<Profile>(db, 'profile');
export const saveProfile = (db: SQLiteDatabase, p: Profile) => setJson(db, 'profile', p);
export const getPlan = (db: SQLiteDatabase) => getJson<Plan>(db, 'plan');
export const savePlan = (db: SQLiteDatabase, p: Plan) => setJson(db, 'plan', p);

export interface Reminders {
  meals: boolean;
  weighIn: boolean;
}
export const getReminders = async (db: SQLiteDatabase): Promise<Reminders> =>
  (await getJson<Reminders>(db, 'reminders')) ?? { meals: false, weighIn: false };
export const saveReminders = (db: SQLiteDatabase, r: Reminders) => setJson(db, 'reminders', r);

// --- food log ---------------------------------------------------------------

export type FoodSource = 'dish' | 'ingredient' | 'recipe' | 'photo' | 'barcode' | 'manual';

export interface FoodEntry extends Nutrition {
  id: number;
  date: string;
  meal: MealType;
  name: string;
  qty: string | null;
  source: FoodSource;
}

export interface NewFoodEntry extends Nutrition {
  date: string;
  meal: MealType;
  name: string;
  qty?: string;
  source: FoodSource;
}

export async function addFoodEntry(db: SQLiteDatabase, e: NewFoodEntry): Promise<void> {
  await db.runAsync(
    `INSERT INTO food_log (date, meal, name, qty, kcal, protein, carbs, fat, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.date, e.meal, e.name, e.qty ?? null, e.kcal, e.protein, e.carbs, e.fat, e.source, Date.now(),
  );
}

export const deleteFoodEntry = (db: SQLiteDatabase, id: number) => db.runAsync('DELETE FROM food_log WHERE id = ?', id);

export const getFoodForDay = (db: SQLiteDatabase, date: string) =>
  db.getAllAsync<FoodEntry>('SELECT * FROM food_log WHERE date = ? ORDER BY created_at', date);

export interface DayTotals extends Nutrition {
  date: string;
}

export const getDailyTotals = (db: SQLiteDatabase, fromDate: string, toDate: string) =>
  db.getAllAsync<DayTotals>(
    `SELECT date, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
     FROM food_log WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    fromDate, toDate,
  );

// --- weight -------------------------------------------------------------------

export interface WeightEntry {
  date: string;
  kg: number;
  source?: string;
}
export const saveWeight = (db: SQLiteDatabase, date: string, kg: number) =>
  db.runAsync('INSERT OR REPLACE INTO weight_log (date, kg) VALUES (?, ?)', date, kg);
export const getWeights = (db: SQLiteDatabase) => db.getAllAsync<WeightEntry>('SELECT date, kg, source FROM weight_log ORDER BY date');

/** Adds a weight read from a health app. A weight the person typed in for that day is never overwritten. */
export const importWeight = (db: SQLiteDatabase, date: string, kg: number, source: string) =>
  db.runAsync(
    `INSERT INTO weight_log (date, kg, source) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET kg = excluded.kg, source = excluded.source WHERE weight_log.source != 'manual'`,
    date, kg, source,
  );
export const deleteWeight = (db: SQLiteDatabase, date: string) => db.runAsync('DELETE FROM weight_log WHERE date = ?', date);

// --- saved recipes --------------------------------------------------------------

export interface SavedRecipe {
  id: number;
  name: string;
  servings: number;
  parts: Part[];
}

export async function saveRecipe(db: SQLiteDatabase, name: string, servings: number, parts: Part[]): Promise<void> {
  await db.runAsync(
    'INSERT INTO recipes (name, servings, ingredients, created_at) VALUES (?, ?, ?, ?)',
    name, servings, JSON.stringify(parts), Date.now(),
  );
}

export async function getRecipes(db: SQLiteDatabase): Promise<SavedRecipe[]> {
  const rows = await db.getAllAsync<{ id: number; name: string; servings: number; ingredients: string }>(
    'SELECT id, name, servings, ingredients FROM recipes ORDER BY name',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, servings: r.servings, parts: JSON.parse(r.ingredients) as Part[] }));
}

export const deleteRecipe = (db: SQLiteDatabase, id: number) => db.runAsync('DELETE FROM recipes WHERE id = ?', id);

// --- steps, energy and workouts ---------------------------------------------------

export interface DayActivity {
  date: string;
  steps: number;
  activeKcal: number | null;
  basis: 'device' | 'estimate' | null;
}

export const saveDayActivity = (db: SQLiteDatabase, a: DayActivity) =>
  db.runAsync(
    'INSERT OR REPLACE INTO step_days (date, steps, active_kcal, energy_basis) VALUES (?, ?, ?, ?)',
    a.date, Math.round(a.steps), a.activeKcal === null ? null : Math.round(a.activeKcal), a.basis,
  );

export const saveSteps = (db: SQLiteDatabase, date: string, steps: number) =>
  db.runAsync(
    `INSERT INTO step_days (date, steps) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET steps = excluded.steps`,
    date, Math.round(steps),
  );

export const getStepDays = (db: SQLiteDatabase, fromDate: string, toDate: string) =>
  db.getAllAsync<{ date: string; steps: number; active_kcal: number | null }>(
    'SELECT date, steps, active_kcal FROM step_days WHERE date BETWEEN ? AND ? ORDER BY date',
    fromDate, toDate,
  );

export async function getStepsForDay(db: SQLiteDatabase, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ steps: number }>('SELECT steps FROM step_days WHERE date = ?', date);
  return row?.steps ?? 0;
}

interface WorkoutRow {
  id: string;
  date: string;
  source: Workout['source'];
  app: string;
  kind: Workout['kind'];
  name: string;
  start_ms: number;
  end_ms: number;
  kcal: number | null;
  distance_m: number | null;
}

export type StoredWorkout = Workout & { date: string };

const toWorkout = (r: WorkoutRow): StoredWorkout => ({
  date: r.date,
  id: r.id, source: r.source, app: r.app, kind: r.kind, name: r.name,
  startMs: r.start_ms, endMs: r.end_ms, kcal: r.kcal, distanceM: r.distance_m,
});

/** Replaces what is stored for these days and sources with the freshly synced workouts. */
export async function replaceWorkouts(
  db: SQLiteDatabase,
  days: string[],
  sources: Workout['source'][],
  byDay: Record<string, Workout[]>,
): Promise<void> {
  if (days.length === 0 || sources.length === 0) return;
  await db.withTransactionAsync(async () => {
    const dayMarks = days.map(() => '?').join(',');
    const sourceMarks = sources.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM workouts WHERE date IN (${dayMarks}) AND source IN (${sourceMarks})`, [...days, ...sources]);
    for (const day of days) {
      for (const w of byDay[day] ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO workouts (id, date, source, app, kind, name, start_ms, end_ms, kcal, distance_m)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          w.id, day, w.source, w.app, w.kind, w.name, w.startMs, w.endMs, w.kcal, w.distanceM,
        );
      }
    }
  });
}

export async function getWorkouts(db: SQLiteDatabase, fromDate: string, toDate: string): Promise<StoredWorkout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE date BETWEEN ? AND ? ORDER BY start_ms',
    fromDate, toDate,
  );
  return rows.map(toWorkout);
}

// --- connected apps -------------------------------------------------------------------

export interface IntegrationState {
  enabled: boolean;
  lastSync: number | null;
  lastError: string | null;
}
export type Integrations = Partial<Record<SourceId, IntegrationState>>;

export const getIntegrations = async (db: SQLiteDatabase): Promise<Integrations> =>
  (await getJson<Integrations>(db, 'integrations')) ?? {};
export const saveIntegrations = (db: SQLiteDatabase, i: Integrations) => setJson(db, 'integrations', i);

// --- danger zone --------------------------------------------------------------------

export async function eraseEverything(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM kv; DELETE FROM food_log; DELETE FROM weight_log; DELETE FROM recipes; DELETE FROM step_days; DELETE FROM workouts;');
}
