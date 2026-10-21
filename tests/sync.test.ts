import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addFoodEntry, getFoodForDay, getIntegrations, getStepDays, getWeights, getWorkouts, importWeight, migrate, saveIntegrations, saveWeight } from '../src/lib/db';
import type { HealthSource, SourceDay, SourceId, Workout } from '../src/lib/health/types';
import { syncHealth } from '../src/lib/health/sync';
import type { Profile } from '../src/lib/plan';
import { testDb } from './sqlite-adapter';

const profile: Profile = { sex: 'male', age: 30, heightCm: 175, weightKg: 80, activity: 'light' };
const TODAY = '2026-01-05';
const YESTERDAY = '2026-01-04';
const t0 = Date.parse('2026-01-05T07:00:00Z');
const HOUR = 3_600_000;

const run = (over: Partial<Workout>): Workout => ({
  id: 'x', source: 'strava', app: 'Strava', kind: 'run', name: 'Run', startMs: t0, endMs: t0 + HOUR, kcal: 500, distanceM: 8000, ...over,
});

function fake(id: SourceId, hub: boolean, days: Record<string, SourceDay>, extra: Partial<HealthSource> = {}): HealthSource & { reads: number } {
  const s = {
    id, label: id, hub, reads: 0,
    available: async () => ({ ok: true as const }),
    connect: async () => null,
    disconnect: async () => {},
    readDays: async () => { s.reads++; return days; },
    readWeights: async () => [],
    ...extra,
  };
  return s;
}

async function setup(enabled: SourceId[]) {
  const db = testDb();
  await migrate(db);
  await saveIntegrations(db, Object.fromEntries(enabled.map((id) => [id, { enabled: true, lastSync: null, lastError: null }])));
  return db;
}

const opts = { days: [YESTERDAY, TODAY], today: TODAY, profile, baseSteps: 4000 };

test('a v1 database upgrades to v2 without losing data', async () => {
  const db = testDb();
  await migrate(db, 1);
  await addFoodEntry(db, { date: TODAY, meal: 'lunch', name: 'Dal', kcal: 200, protein: 12, carbs: 30, fat: 4, source: 'dish' });
  await saveWeight(db, YESTERDAY, 80);
  await db.runAsync('INSERT INTO step_days (date, steps) VALUES (?, ?)', TODAY, 5000);

  await migrate(db);

  assert.equal((await getFoodForDay(db, TODAY)).length, 1);
  assert.equal((await getWeights(db))[0].source, 'manual', 'existing weights count as manual');
  const steps = await getStepDays(db, TODAY, TODAY);
  assert.equal(steps[0].steps, 5000);
  assert.equal(steps[0].active_kcal, null);
  assert.deepEqual(await getWorkouts(db, TODAY, TODAY), []);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
  await migrate(db); // running again changes nothing
});

test('nothing connected: nothing is read or stored', async () => {
  const db = await setup([]);
  const apple = fake('apple-health', true, {});
  const r = await syncHealth(db, [apple], opts);
  assert.equal(apple.reads, 0);
  assert.equal(r.today, null);
});

test('a hub supplies steps, device energy and workouts for today', async () => {
  const db = await setup(['apple-health']);
  const watchRun = run({ id: 'apple-health:1', source: 'apple-health', app: 'Apple Watch' });
  const apple = fake('apple-health', true, { [TODAY]: { steps: 11000, activeKcal: 850, workouts: [watchRun] } });
  const r = await syncHealth(db, [apple], opts);
  assert.equal(r.today?.steps, 11000);
  assert.equal(r.today?.activeKcal, 850);
  assert.equal(r.today?.basis, 'device');
  assert.equal(r.today?.stepsFrom, 'apple-health');
  assert.equal(r.today?.workouts[0].app, 'Apple Watch');
  assert.equal((await getStepDays(db, TODAY, TODAY))[0].active_kcal, 850);
});

test('the same run from the watch and Strava is stored twice but counted once', async () => {
  const db = await setup(['apple-health', 'strava']);
  const apple = fake('apple-health', true, { [TODAY]: { steps: 9000, activeKcal: 700, workouts: [run({ id: 'apple-health:1', source: 'apple-health', app: 'Apple Watch', kcal: 600 })] } });
  const strava = fake('strava', false, { [TODAY]: { steps: null, activeKcal: null, workouts: [run({ id: 'strava:1', kcal: 540 })] } });
  const r = await syncHealth(db, [apple, strava], opts);
  assert.equal((await getWorkouts(db, TODAY, TODAY)).length, 2);
  assert.equal(r.today?.workouts.length, 1);
  assert.equal(r.today?.activeKcal, 700, 'hub total, with no Strava energy on top');
});

test('Strava alone: steps come from the phone and workout energy is added as an estimate', async () => {
  const db = await setup(['strava']);
  const strava = fake('strava', false, { [TODAY]: { steps: null, activeKcal: null, workouts: [run({ id: 'strava:1', kind: 'cycle', kcal: 700, distanceM: 30000 })] } });
  const r = await syncHealth(db, [strava], opts);
  assert.equal(r.today?.steps, 4000);
  assert.equal(r.today?.basis, 'estimate');
  assert.ok((r.today?.activeKcal ?? 0) > 700);
  assert.equal(r.today?.stepsFrom, null);
});

test('Strava is throttled but a forced sync overrides it, and skipped sources keep their stored workouts', async () => {
  const db = await setup(['strava']);
  const strava = fake('strava', false, { [TODAY]: { steps: null, activeKcal: null, workouts: [run({ id: 'strava:1', kind: 'swim', kcal: 400 })] } });
  const now = Date.parse('2026-01-05T12:00:00Z');
  await syncHealth(db, [strava], { ...opts, now });
  assert.equal(strava.reads, 1);

  const again = await syncHealth(db, [strava], { ...opts, now: now + 5 * 60_000 });
  assert.equal(strava.reads, 1, 'asked again after 5 minutes: skipped');
  assert.ok((again.today?.activeKcal ?? 0) >= 400, 'stored swim still counted');

  await syncHealth(db, [strava], { ...opts, now: now + 11 * 60_000 });
  assert.equal(strava.reads, 2, 'after 10 minutes it is asked again');
  await syncHealth(db, [strava], { ...opts, now: now + 12 * 60_000, force: true });
  assert.equal(strava.reads, 3, 'force ignores the throttle');
});

test('one failing source does not stop the others, and its error is remembered', async () => {
  const db = await setup(['apple-health', 'strava']);
  const apple = fake('apple-health', true, { [TODAY]: { steps: 8000, activeKcal: 500, workouts: [] } });
  const strava = fake('strava', false, {}, { readDays: async () => { throw new Error('Strava’s rate limit was reached.'); } });
  const r = await syncHealth(db, [apple, strava], opts);
  assert.equal(r.today?.steps, 8000);
  assert.match(r.errors.strava ?? '', /rate limit/);
  const state = await getIntegrations(db);
  assert.match(state.strava?.lastError ?? '', /rate limit/);
  assert.equal(state['apple-health']?.lastError, null);
});

test('workouts that disappear from a source are removed on the next sync', async () => {
  const db = await setup(['apple-health']);
  const w = run({ id: 'apple-health:1', source: 'apple-health', kind: 'swim' });
  const days: Record<string, SourceDay> = { [TODAY]: { steps: 1000, activeKcal: 300, workouts: [w] } };
  const apple = fake('apple-health', true, days);
  await syncHealth(db, [apple], opts);
  assert.equal((await getWorkouts(db, TODAY, TODAY)).length, 1);
  days[TODAY] = { steps: 1000, activeKcal: 300, workouts: [] };
  await syncHealth(db, [apple], opts);
  assert.equal((await getWorkouts(db, TODAY, TODAY)).length, 0);
});

test('weights from a hub are imported but never overwrite one typed in by hand', async () => {
  const db = await setup(['health-connect']);
  await saveWeight(db, YESTERDAY, 80.0);
  const hc = fake('health-connect', true, { [TODAY]: { steps: 1, activeKcal: 1, workouts: [] } }, {
    readWeights: async () => [{ date: YESTERDAY, kg: 79.2 }, { date: TODAY, kg: 79.0 }],
  });
  await syncHealth(db, [hc], opts);
  const weights = Object.fromEntries((await getWeights(db)).map((w) => [w.date, w]));
  assert.equal(weights[YESTERDAY].kg, 80.0, 'manual entry kept');
  assert.equal(weights[YESTERDAY].source, 'manual');
  assert.equal(weights[TODAY].kg, 79.0);
  assert.equal(weights[TODAY].source, 'health-connect');
  await importWeight(db, TODAY, 78.5, 'health-connect');
  assert.equal((await getWeights(db)).find((w) => w.date === TODAY)?.kg, 78.5, 'a later imported reading updates an imported one');
});

test('past days only change when a source has something to say about them', async () => {
  const db = await setup(['strava']);
  const strava = fake('strava', false, { [TODAY]: { steps: null, activeKcal: null, workouts: [] }, [YESTERDAY]: { steps: null, activeKcal: null, workouts: [] } });
  await syncHealth(db, [strava], opts);
  const rows = await getStepDays(db, YESTERDAY, TODAY);
  assert.deepEqual(rows.map((r) => r.date), [TODAY]);
});
