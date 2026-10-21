import type { SQLiteDatabase } from 'expo-sqlite';
import type { MealType, Nutrition, Part } from './foods';
import type { Plan, Profile } from './plan';

export const DB_NAME = 'thali-tally.db';

/** Creates / upgrades the local database. Everything the app stores lives in this one on-device file. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= 1) return;
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
}
export const saveWeight = (db: SQLiteDatabase, date: string, kg: number) =>
  db.runAsync('INSERT OR REPLACE INTO weight_log (date, kg) VALUES (?, ?)', date, kg);
export const getWeights = (db: SQLiteDatabase) => db.getAllAsync<WeightEntry>('SELECT date, kg FROM weight_log ORDER BY date');
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

// --- steps ------------------------------------------------------------------------

export const saveSteps = (db: SQLiteDatabase, date: string, steps: number) =>
  db.runAsync('INSERT OR REPLACE INTO step_days (date, steps) VALUES (?, ?)', date, Math.round(steps));

export const getStepDays = (db: SQLiteDatabase, fromDate: string, toDate: string) =>
  db.getAllAsync<{ date: string; steps: number }>('SELECT date, steps FROM step_days WHERE date BETWEEN ? AND ? ORDER BY date', fromDate, toDate);

export async function getStepsForDay(db: SQLiteDatabase, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ steps: number }>('SELECT steps FROM step_days WHERE date = ?', date);
  return row?.steps ?? 0;
}

// --- danger zone --------------------------------------------------------------------

export async function eraseEverything(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM kv; DELETE FROM food_log; DELETE FROM weight_log; DELETE FROM recipes; DELETE FROM step_days;');
}
