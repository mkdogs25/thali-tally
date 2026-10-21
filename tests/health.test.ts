import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appNameFromPackage, kindFromHealthConnect, kindFromHealthKit, kindFromStrava, toKcal, toMetres } from '../src/lib/health/kinds';
import { computeEnergy, dedupeWorkouts, overlapFraction } from '../src/lib/health/merge';
import type { Workout } from '../src/lib/health/types';
import { stepsToKcal } from '../src/lib/plan';

const profile = { heightCm: 175, sex: 'male' as const, weightKg: 80 };
const HOUR = 3_600_000;
const t0 = Date.UTC(2026, 0, 5, 7, 0);

const w = (over: Partial<Workout>): Workout => ({
  id: 'x', source: 'strava', app: 'Strava', kind: 'run', name: 'Run',
  startMs: t0, endMs: t0 + HOUR, kcal: 500, distanceM: 8000, ...over,
});

test('activity types map across Apple, Health Connect and Strava', () => {
  assert.equal(kindFromHealthKit(37), 'run');
  assert.equal(kindFromHealthKit(52), 'walk');
  assert.equal(kindFromHealthKit(9999), 'other');
  assert.equal(kindFromHealthConnect(79), 'walk');
  assert.equal(kindFromHealthConnect(74), 'swim');
  assert.equal(kindFromStrava('TrailRun'), 'run');
  assert.equal(kindFromStrava('GravelRide'), 'cycle');
  assert.equal(kindFromStrava('Kitesurf'), 'other');
});

test('Android packages become app names; unknown ones are still readable', () => {
  assert.equal(appNameFromPackage('com.garmin.android.apps.connectmobile'), 'Garmin Connect');
  assert.equal(appNameFromPackage('com.sec.android.app.shealth'), 'Samsung Health');
  assert.equal(appNameFromPackage('com.example.mywatch'), 'Mywatch');
  assert.equal(appNameFromPackage(undefined), 'Health Connect');
});

test('unit conversion handles whatever HealthKit returns', () => {
  assert.equal(toMetres(5, 'km'), 5000);
  assert.ok(Math.abs(toMetres(1, 'mi')! - 1609.344) < 1e-9);
  assert.equal(toMetres(1, 'parsec'), null);
  assert.equal(toKcal(300, 'kcal'), 300);
  assert.ok(Math.abs(toKcal(4184, 'kJ')! - 1000) < 1e-9);
  assert.equal(toKcal(1, 'furlong'), null);
});

test('overlap fraction is measured against the shorter workout', () => {
  assert.equal(overlapFraction(w({}), w({ startMs: t0 + 2 * HOUR, endMs: t0 + 3 * HOUR })), 0);
  assert.equal(overlapFraction(w({}), w({ startMs: t0 + 0.5 * HOUR, endMs: t0 + 1.5 * HOUR })), 0.5);
  assert.equal(overlapFraction(w({}), w({ startMs: t0 + 0.2 * HOUR, endMs: t0 + 0.4 * HOUR })), 1);
});

test('the same run from the watch and from Strava counts once, keeping the watch copy', () => {
  const watch = w({ id: 'hk:1', source: 'apple-health', app: 'Apple Watch', kcal: 620, distanceM: null });
  const strava = w({ id: 'strava:9', source: 'strava', kcal: 540, distanceM: 8100, startMs: t0 + 60_000 });
  const out = dedupeWorkouts([strava, watch]);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'apple-health');
  assert.equal(out[0].kcal, 620);
  assert.equal(out[0].distanceM, 8100, 'borrows distance the watch copy lacked');
});

test('a watch copy with no energy borrows it from the duplicate', () => {
  const out = dedupeWorkouts([w({ source: 'apple-health', kcal: null }), w({ kcal: 480 })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kcal, 480);
});

test('different workouts are both kept', () => {
  const morning = w({ id: 'a' });
  const evening = w({ id: 'b', startMs: t0 + 10 * HOUR, endMs: t0 + 11 * HOUR });
  assert.equal(dedupeWorkouts([evening, morning]).length, 2);
});

test('hub energy is used as-is when Strava only repeats a workout the hub already holds', () => {
  const hubRun = w({ id: 'hc:1', source: 'health-connect', app: 'Garmin Connect' });
  const e = computeEnergy({ profile, steps: 12000, hubActiveKcal: 900, workouts: [hubRun, w({ kcal: 540 })] });
  assert.equal(e.basis, 'device');
  assert.equal(e.activeKcal, 900);
});

test('a Strava-only workout is added on top of hub energy', () => {
  const ride = w({ id: 's:2', kind: 'cycle', kcal: 700, startMs: t0 + 5 * HOUR, endMs: t0 + 7 * HOUR, distanceM: 40000 });
  const hubWalk = w({ id: 'hc:1', source: 'health-connect', kind: 'walk', kcal: 100 });
  const e = computeEnergy({ profile, steps: 6000, hubActiveKcal: 400, workouts: [hubWalk, ride] });
  assert.equal(e.activeKcal, 1100);
});

test('without a hub: steps estimate plus workouts, not double-counting the run', () => {
  const run = w({ kcal: 600, distanceM: 8000, kind: 'run' });
  const e = computeEnergy({ profile, steps: 12000, hubActiveKcal: null, workouts: [run] });
  const walkingAlready = 8 * 80 * 0.5; // 320
  assert.equal(e.basis, 'estimate');
  assert.ok(Math.abs(e.activeKcal - (stepsToKcal(12000, profile) + 600 - walkingAlready)) < 1e-9);
});

test('non-walking workouts are added in full, and unknown energy is ignored', () => {
  const swim = w({ kind: 'swim', kcal: 400, distanceM: 1500 });
  const mystery = w({ id: 'm', kind: 'other', kcal: null, startMs: t0 + 4 * HOUR, endMs: t0 + 5 * HOUR });
  const e = computeEnergy({ profile, steps: 0, hubActiveKcal: null, workouts: [swim, mystery] });
  assert.equal(e.activeKcal, 400);
});

test('without a profile only workout energy is available', () => {
  const e = computeEnergy({ profile: null, steps: 9000, hubActiveKcal: null, workouts: [w({ kind: 'cycle', kcal: 300 })] });
  assert.equal(e.activeKcal, 300);
});

test('a workout can never reduce the total below the step estimate', () => {
  const slowWalk = w({ kind: 'walk', kcal: 50, distanceM: 8000 });
  const e = computeEnergy({ profile, steps: 10000, hubActiveKcal: null, workouts: [slowWalk] });
  assert.ok(e.activeKcal >= stepsToKcal(10000, profile));
});

// --- Strava ---------------------------------------------------------------------------

import { buildAuthorizeUrl, energyOf, exchangeCode, fetchActivities, needsRefresh, parseCallback, refreshTokens, StravaError, toWorkout } from '../src/lib/health/stravaApi';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Strava authorize URL carries client, redirect, scope and state', () => {
  const u = new URL(buildAuthorizeUrl('1234', 'abc'));
  assert.equal(u.origin + u.pathname, 'https://www.strava.com/oauth/authorize');
  assert.equal(u.searchParams.get('client_id'), '1234');
  assert.equal(u.searchParams.get('redirect_uri'), 'thalitally://localhost/strava');
  assert.equal(u.searchParams.get('scope'), 'activity:read_all');
  assert.equal(u.searchParams.get('state'), 'abc');
});

test('Strava callback: success, denial, wrong state and unticked scope', () => {
  const base = 'thalitally://localhost/strava';
  assert.deepEqual(parseCallback(`${base}?state=s&code=C1&scope=read,activity:read_all`, 's'), { ok: true, code: 'C1' });
  assert.equal(parseCallback(`${base}?state=s&error=access_denied`, 's').ok, false);
  assert.equal(parseCallback(`${base}?state=other&code=C1&scope=activity:read_all`, 's').ok, false);
  const noScope = parseCallback(`${base}?state=s&code=C1&scope=read`, 's');
  assert.equal(noScope.ok, false);
  assert.equal(parseCallback(`${base}?state=s&scope=activity:read`, 's').ok, false, 'no code');
});

test('Strava token expiry leaves a two-minute margin', () => {
  const t = { accessToken: 'a', refreshToken: 'r', expiresAt: 10_000 };
  assert.equal(needsRefresh(t, 9_000), false);
  assert.equal(needsRefresh(t, 9_900), true);
  assert.equal(needsRefresh(t, 11_000), true);
});

test('Strava activity becomes a workout; energy falls back to kilojoules', () => {
  const a = { id: 77, name: 'Morning Run', sport_type: 'Run', start_date: '2026-01-05T01:30:00Z', elapsed_time: 3600, distance: 10000 };
  const wk = toWorkout(a, 640);
  assert.equal(wk.id, 'strava:77');
  assert.equal(wk.kind, 'run');
  assert.equal(wk.endMs - wk.startMs, 3_600_000);
  assert.equal(wk.distanceM, 10000);
  assert.equal(energyOf({ calories: 0 }, { ...a, kilojoules: 850 }), 850);
  assert.equal(energyOf({ calories: 612 }, a), 612);
  assert.equal(energyOf(null, a), null);
});

test('Strava token exchange and refresh post the right form and parse the reply', async () => {
  const seen: { url: string; body: string }[] = [];
  const fake = async (url: string, init?: RequestInit) => {
    seen.push({ url, body: String(init?.body) });
    return json({ access_token: 'A2', refresh_token: 'R2', expires_at: 123456 });
  };
  const creds = { clientId: 'cid', clientSecret: 'sec' };
  const t1 = await exchangeCode(creds, 'CODE', fake);
  assert.deepEqual(t1, { accessToken: 'A2', refreshToken: 'R2', expiresAt: 123456 });
  assert.match(seen[0].body, /grant_type=authorization_code/);
  assert.match(seen[0].body, /code=CODE/);
  await refreshTokens(creds, t1, fake);
  assert.match(seen[1].body, /grant_type=refresh_token/);
  assert.match(seen[1].body, /refresh_token=R2/);
});

test('Strava errors are readable: rate limit and expired sign-in', async () => {
  const creds = { clientId: 'c', clientSecret: 's' };
  await assert.rejects(() => exchangeCode(creds, 'x', async () => json({}, 429)), (e: StravaError) => e.status === 429 && /rate limit/i.test(e.message));
  await assert.rejects(() => fetchActivities('tok', 0, 1, new Map(), async () => json({}, 401)), (e: StravaError) => e.status === 401);
});

test('Strava activities are grouped by local day; detail calls are made only for new activities', async () => {
  const calls: string[] = [];
  const list = [
    { id: 1, sport_type: 'Run', start_date: '2026-01-05T01:00:00Z', start_date_local: '2026-01-05T06:30:00Z', elapsed_time: 1800, distance: 5000 },
    { id: 2, sport_type: 'Ride', start_date: '2026-01-04T10:00:00Z', start_date_local: '2026-01-04T15:30:00Z', elapsed_time: 3600, distance: 20000 },
    { id: 3, sport_type: 'Walk', start_date: '2026-01-04T12:00:00Z', start_date_local: '2026-01-04T17:30:00Z', elapsed_time: 1200, distance: 1500 },
  ];
  const fake = async (url: string) => {
    calls.push(url);
    if (url.includes('/athlete/activities')) return json(list);
    const id = Number(url.split('/').pop());
    return json({ id, calories: id * 100 });
  };
  const known = new Map([['strava:3', toWorkout(list[2], 90)]]);
  const out = await fetchActivities('tok', 0, 9, known, fake);
  assert.deepEqual(Object.keys(out).sort(), ['2026-01-04', '2026-01-05']);
  assert.equal(out['2026-01-05'][0].kcal, 100);
  assert.equal(out['2026-01-04'].find((w) => w.id === 'strava:3')?.kcal, 90, 'cached energy reused');
  assert.equal(calls.filter((c) => c.includes('/activities/')).length, 2, 'details fetched for 1 and 2 only');
});

test('Strava: activities beyond the per-sync detail cap are left for next time, not stored without energy', async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, sport_type: 'Run', start_date: '2026-01-05T01:00:00Z', start_date_local: '2026-01-05T06:00:00Z', elapsed_time: 600 }));
  const fake = async (url: string) => (url.includes('/athlete/activities') ? json(many) : json({ calories: 50 }));
  const out = await fetchActivities('tok', 0, 9, new Map(), fake);
  assert.equal(out['2026-01-05'].length, 15);
});
