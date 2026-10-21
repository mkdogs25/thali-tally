import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  addFoodEntry, deleteFoodEntry, deleteRecipe, deleteWeight, getDailyTotals, getFavourites, getFoodForDay, getProfile, getRecipes, getWeights,
  migrate, saveFavourites, saveProfile, saveRecipe, saveReminders, saveWeight, saveIntegrations,
} from '../src/lib/db';
import { checkOwner, Remote, RemoteRow, syncAll, SyncTable, takeOverPhone } from '../src/lib/sync/engine';
import { testDb } from './sqlite-adapter';

const KEYS: Record<SyncTable, string> = { food_log: 'uid', weight_log: 'date', recipes: 'uid', settings: 'key' };

/** An in-memory stand-in for the server: rows keyed per table, a monotonic server timestamp, upsert semantics. */
class FakeServer {
  tables: Record<SyncTable, Map<string, RemoteRow>> = { food_log: new Map(), weight_log: new Map(), recipes: new Map(), settings: new Map() };
  clock = 0;
  pulls: { table: SyncTable; after: string | null }[] = [];
  pushCalls = 0;
  failNext = false;
  onPush?: () => Promise<void>;

  remote(): Remote {
    return {
      pull: async (table, after, limit) => {
        if (this.failNext) { this.failNext = false; throw new Error('offline'); }
        this.pulls.push({ table, after });
        return [...this.tables[table].values()]
          .filter((r) => after === null || String(r.server_ts) >= after)
          .sort((a, b) => String(a.server_ts).localeCompare(String(b.server_ts)))
          .slice(0, limit)
          .map((r) => structuredClone(r));
      },
      push: async (table, rows) => {
        if (this.failNext) { this.failNext = false; throw new Error('offline'); }
        this.pushCalls++;
        for (const r of rows) {
          this.tables[table].set(String(r[KEYS[table]]), { ...structuredClone(r), server_ts: `T${String(++this.clock).padStart(10, '0')}` });
        }
        await this.onPush?.();
      },
    };
  }
}

async function device(): Promise<SQLiteDatabase> {
  const db = testDb();
  await migrate(db);
  return db;
}
const food = (date: string, name: string, kcal = 200) => ({ date, meal: 'lunch' as const, name, kcal, protein: 10, carbs: 20, fat: 5, source: 'dish' as const });
const profile = { sex: 'female', age: 30, heightCm: 165, weightKg: 62, activity: 'moderate' } as never;
const dirtyCount = async (db: SQLiteDatabase, table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dirty = 1`))?.n;

async function signIn(db: SQLiteDatabase, server: FakeServer, user = 'user-1') {
  assert.equal(await checkOwner(db, user), 'ok');
  return syncAll(db, server.remote());
}

test('first sign-in uploads what is already on the phone, and a second phone receives all of it', async () => {
  const server = new FakeServer();
  const a = await device();
  await addFoodEntry(a, food('2026-01-05', 'Dal'));
  await addFoodEntry(a, food('2026-01-05', 'Roti', 100));
  await saveWeight(a, '2026-01-05', 62.5);
  await saveRecipe(a, 'Rajma', 4, [{ ingredient: 'rajma', grams: 160 }]);
  await saveProfile(a, profile);
  await saveFavourites(a, [{ id: 'dish:poha', meals: ['breakfast'] }]);

  const stats = await signIn(a, server);
  assert.equal(stats.pushed, 2 + 1 + 1 + 2, 'foods, weight, recipe, profile + favourites');
  assert.equal(await dirtyCount(a, 'food_log'), 0, 'clean after a successful push');

  const b = await device();
  await signIn(b, server);
  assert.deepEqual((await getFoodForDay(b, '2026-01-05')).map((f) => f.name).sort(), ['Dal', 'Roti']);
  assert.equal((await getWeights(b))[0].kg, 62.5);
  const recipes = await getRecipes(b);
  assert.equal(recipes[0].name, 'Rajma');
  assert.deepEqual(recipes[0].parts, [{ ingredient: 'rajma', grams: 160 }], 'JSON survives the round trip');
  assert.deepEqual(await getProfile(b), profile);
  assert.deepEqual(await getFavourites(b), [{ id: 'dish:poha', meals: ['breakfast'] }]);
  assert.equal(await dirtyCount(b, 'food_log'), 0, 'pulled rows are not re-uploaded');
  assert.equal((await b.getFirstAsync<{ uid: string }>('SELECT uid FROM recipes'))?.uid, recipes[0].uid, 'same recipe id on both phones');
});

test('once caught up, syncing again uploads nothing and resumes from a saved cursor', async () => {
  const server = new FakeServer();
  const a = await device();
  await addFoodEntry(a, food('2026-01-05', 'Dal'));
  await signIn(a, server);
  // The first pull found an empty server, so no cursor yet; the next one reads back this phone's own upload once.
  await syncAll(a, server.remote());
  const third = await syncAll(a, server.remote());
  assert.equal(third.pushed, 0, 'nothing left to upload');
  assert.ok(server.pulls.filter((p) => p.table === 'food_log').at(-1)?.after, 'resumed from a saved cursor rather than starting over');
  assert.ok(third.pulled <= 4, 'at most the boundary row of each table is re-read (the cursor is inclusive)');
  assert.equal((await getFoodForDay(a, '2026-01-05')).length, 1, 're-reading a row does not duplicate it');
});

test('changes made on one phone reach the other, and the later edit wins a conflict', async () => {
  const server = new FakeServer();
  const a = await device();
  const b = await device();
  await saveWeight(a, '2026-01-05', 70);
  await signIn(a, server);
  await signIn(b, server);

  // B edits later than A.
  await b.runAsync('UPDATE weight_log SET kg = 69, updated_at = updated_at + 5000, dirty = 1 WHERE date = ?', '2026-01-05');
  await a.runAsync('UPDATE weight_log SET kg = 71, updated_at = updated_at + 1000, dirty = 1 WHERE date = ?', '2026-01-05');
  await syncAll(b, server.remote());
  await syncAll(a, server.remote());
  await syncAll(b, server.remote());
  assert.equal((await getWeights(a))[0].kg, 69, 'later edit (B) wins on A');
  assert.equal((await getWeights(b))[0].kg, 69);
  assert.equal(await dirtyCount(a, 'weight_log'), 0);
});

test('an unsynced local edit that is newer than the server copy survives a pull and is then pushed', async () => {
  const server = new FakeServer();
  const a = await device();
  const b = await device();
  await saveProfile(a, profile);
  await signIn(a, server);
  await signIn(b, server);
  await saveProfile(a, { ...(profile as object), weightKg: 60 } as never); // newer, not yet pushed
  await syncAll(a, server.remote());
  assert.equal((await getProfile(a))!.weightKg, 60, 'not overwritten by the older server copy');
  await syncAll(b, server.remote());
  assert.equal((await getProfile(b))!.weightKg, 60, 'and it reached the other phone');
});

test('deleting a food, weight or recipe on one phone removes it on the other', async () => {
  const server = new FakeServer();
  const a = await device();
  const b = await device();
  await addFoodEntry(a, food('2026-01-05', 'Dal', 300));
  await addFoodEntry(a, food('2026-01-05', 'Roti', 100));
  await saveWeight(a, '2026-01-05', 62);
  await saveRecipe(a, 'Rajma', 4, []);
  await signIn(a, server);
  await signIn(b, server);
  assert.equal((await getDailyTotals(b, '2026-01-05', '2026-01-05'))[0].kcal, 400);

  const [dal] = (await getFoodForDay(a, '2026-01-05')).filter((f) => f.name === 'Dal');
  await deleteFoodEntry(a, dal.id);
  await deleteWeight(a, '2026-01-05');
  await deleteRecipe(a, (await getRecipes(a))[0].id);
  await syncAll(a, server.remote());
  await syncAll(b, server.remote());

  assert.deepEqual((await getFoodForDay(b, '2026-01-05')).map((f) => f.name), ['Roti']);
  assert.equal((await getDailyTotals(b, '2026-01-05', '2026-01-05'))[0].kcal, 100, 'totals ignore the deleted entry');
  assert.deepEqual(await getWeights(b), []);
  assert.deepEqual(await getRecipes(b), []);
});

test('offline edits are kept and uploaded later; a failed sync loses nothing', async () => {
  const server = new FakeServer();
  const a = await device();
  await signIn(a, server);
  await addFoodEntry(a, food('2026-01-06', 'Poha'));
  server.failNext = true;
  await assert.rejects(() => syncAll(a, server.remote()), /offline/);
  assert.equal(await dirtyCount(a, 'food_log'), 1, 'still waiting to upload');
  const retry = await syncAll(a, server.remote());
  assert.equal(retry.pushed, 1);
  assert.equal(await dirtyCount(a, 'food_log'), 0);
  assert.equal(server.tables.food_log.size, 1);

  // A failure part-way through a push leaves the unpushed table dirty.
  await saveWeight(a, '2026-01-06', 61);
  await addFoodEntry(a, food('2026-01-06', 'Tea', 50));
  server.failNext = true;
  await assert.rejects(() => syncAll(a, server.remote()));
  await syncAll(a, server.remote());
  assert.equal(server.tables.weight_log.size, 1);
  assert.equal(server.tables.food_log.size, 2);
});

test('an edit made while a push is in flight stays dirty for the next sync', async () => {
  const server = new FakeServer();
  const a = await device();
  await signIn(a, server);
  await saveWeight(a, '2026-01-07', 60);
  server.onPush = async () => {
    server.onPush = undefined;
    await a.runAsync('UPDATE weight_log SET kg = 59, updated_at = updated_at + 10, dirty = 1 WHERE date = ?', '2026-01-07');
  };
  await syncAll(a, server.remote());
  assert.equal(await dirtyCount(a, 'weight_log'), 1, 'the newer edit is not marked as uploaded');
  await syncAll(a, server.remote());
  assert.equal(server.tables.weight_log.get('2026-01-07')?.kg, 59);
});

test('large histories sync completely in pages', async () => {
  const server = new FakeServer();
  const a = await device();
  await a.withTransactionAsync(async () => {
    for (let i = 0; i < 1250; i++) await addFoodEntry(a, food(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`, `Item ${i}`, i));
  });
  await signIn(a, server);
  assert.equal(server.tables.food_log.size, 1250);
  const b = await device();
  const stats = await signIn(b, server);
  assert.ok(stats.pulled >= 1250);
  const count = await b.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM food_log WHERE deleted = 0');
  assert.equal(count?.n, 1250, 'every row arrived across multiple pages');
  assert.equal(await dirtyCount(b, 'food_log'), 0);
});

test('a different account never silently mixes with data already on the phone', async () => {
  const server = new FakeServer();
  const a = await device();
  await addFoodEntry(a, food('2026-01-05', 'Dal'));
  await saveReminders(a, { meals: true, weighIn: false });
  await saveIntegrations(a, { strava: { enabled: true, lastSync: 1, lastError: null } });
  await signIn(a, server, 'alice');

  // Bob already has his own data on the server.
  const bobsPhone = await device();
  await addFoodEntry(bobsPhone, food('2026-01-09', 'Idli'));
  await signIn(bobsPhone, server, 'bob');
  // (shared fake server stands in for separate accounts here; what matters is the phone-side behaviour)

  assert.equal(await checkOwner(a, 'bob'), 'other-account', 'Alice’s phone is not handed to Bob automatically');
  assert.equal((await getFoodForDay(a, '2026-01-05')).length, 1, 'her data is untouched while the question is open');

  await takeOverPhone(a, 'bob');
  assert.equal((await getFoodForDay(a, '2026-01-05')).length, 0, 'her synced data is cleared');
  assert.equal(await checkOwner(a, 'bob'), 'ok');
  await syncAll(a, server.remote());
  assert.ok((await getFoodForDay(a, '2026-01-09')).some((f) => f.name === 'Idli'), 'the new account’s data arrives');
  const reminders = await a.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'reminders'");
  assert.ok(reminders, 'device-only settings such as reminders are kept');
  assert.ok(await a.getFirstAsync("SELECT 1 FROM kv WHERE key = 'integrations'"), 'connected-app state is kept');
});

test('the server can only write the settings this app syncs', async () => {
  const server = new FakeServer();
  const a = await device();
  await signIn(a, server);
  server.tables.settings.set('integrations', { key: 'integrations', value: { strava: { enabled: true } }, updated_at: Date.now() + 1000, server_ts: 'T9999999998' });
  server.tables.settings.set('auth.token', { key: 'auth.token', value: 'stolen', updated_at: Date.now() + 1000, server_ts: 'T9999999999' });
  server.tables.settings.set('favourites', { key: 'favourites', value: [{ id: 'dish:poha', meals: ['breakfast'] }], updated_at: Date.now() + 1000, server_ts: 'T9999999997' });
  await syncAll(a, server.remote());
  assert.equal(await a.getFirstAsync("SELECT 1 FROM kv WHERE key = 'integrations'"), null);
  assert.equal(await a.getFirstAsync("SELECT 1 FROM kv WHERE key = 'auth.token'"), null);
  assert.deepEqual(await getFavourites(a), [{ id: 'dish:poha', meals: ['breakfast'] }], 'known settings do sync');
});

test('device-only settings never leave the phone', async () => {
  const server = new FakeServer();
  const a = await device();
  await saveReminders(a, { meals: true, weighIn: true });
  await saveIntegrations(a, { strava: { enabled: true, lastSync: 1, lastError: null } });
  await saveProfile(a, profile);
  await signIn(a, server);
  assert.deepEqual([...server.tables.settings.keys()], ['profile']);
});

test('weights imported from a health app sync like any other, without being re-uploaded when unchanged', async () => {
  const { importWeight } = await import('../src/lib/db');
  const server = new FakeServer();
  const a = await device();
  await signIn(a, server);
  await importWeight(a, '2026-01-08', 61.2, 'health-connect');
  await syncAll(a, server.remote());
  assert.equal(server.tables.weight_log.get('2026-01-08')?.source, 'health-connect');
  await importWeight(a, '2026-01-08', 61.2, 'health-connect'); // the same reading arrives again on the next refresh
  assert.equal(await dirtyCount(a, 'weight_log'), 0, 'unchanged reading is not treated as an edit');
});

test('sync reports whether anything on the phone actually changed', async () => {
  const server = new FakeServer();
  const a = await device();
  const b = await device();
  await addFoodEntry(a, food('2026-01-05', 'Dal'));
  await signIn(a, server);
  const first = await signIn(b, server);
  assert.ok(first.changed >= 1, 'B received data from A');
  const again = await syncAll(b, server.remote());
  assert.equal(again.changed, 0, 're-reading the boundary row is not a change');
  await addFoodEntry(a, food('2026-01-05', 'Roti'));
  await syncAll(a, server.remote());
  assert.equal((await syncAll(b, server.remote())).changed, 1, 'one new row from A');
});
