import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DayActivity,
  getIntegrations,
  getStepsForDay,
  getWorkouts,
  importWeight,
  Integrations,
  replaceWorkouts,
  saveDayActivity,
  saveIntegrations,
} from '../db';
import { addDays } from '../dates';
import type { Profile } from '../plan';
import { computeEnergy } from './merge';
import type { HealthSource, SourceDay, SourceId, Workout } from './types';

/** Local-only reads are free; Strava is rate-limited, so it is asked at most this often unless forced. */
const MIN_INTERVAL_MS: Partial<Record<SourceId, number>> = { strava: 10 * 60_000 };
const WEIGHT_WINDOW_DAYS = 30;

export interface SyncOptions {
  /** Local day keys to refresh, oldest first. */
  days: string[];
  today: string;
  profile: Profile | null;
  /** Steps from the phone's own sensor, used for today when no health hub reports any. */
  baseSteps: number;
  force?: boolean;
  now?: number;
}

type HubId = Extract<SourceId, 'apple-health' | 'health-connect'>;

export interface TodaySummary extends DayActivity {
  workouts: Workout[];
  /** Which hub the step count came from, or null if it came from the phone sensor. */
  stepsFrom: HubId | null;
}

export interface SyncResult {
  today: TodaySummary | null;
  errors: Partial<Record<SourceId, string>>;
  synced: SourceId[];
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/**
 * Pulls from every connected source, stores what it found, then works out each day's steps and active
 * energy from the stored workouts. One failing source never blocks the others.
 */
export async function syncHealth(db: SQLiteDatabase, sources: HealthSource[], opts: SyncOptions): Promise<SyncResult> {
  const now = opts.now ?? Date.now();
  const integrations = await getIntegrations(db);
  const enabled = sources.filter((s) => integrations[s.id]?.enabled);
  const result: SyncResult = { today: null, errors: {}, synced: [] };
  if (enabled.length === 0) return result;

  const first = opts.days[0];
  const last = opts.days[opts.days.length - 1];
  const known = new Map((await getWorkouts(db, first, last)).map((w) => [w.id, w]));

  const readings: { source: HealthSource; days: Record<string, SourceDay> }[] = [];
  const next: Integrations = { ...integrations };

  for (const source of enabled) {
    const state = next[source.id]!;
    const wait = MIN_INTERVAL_MS[source.id] ?? 0;
    if (!opts.force && wait > 0 && state.lastSync !== null && now - state.lastSync < wait) continue;
    try {
      if ('setKnown' in source) (source as HealthSource & { setKnown(k: Map<string, Workout>): void }).setKnown(known);
      readings.push({ source, days: await source.readDays(opts.days) });
      next[source.id] = { ...state, lastSync: now, lastError: null };
      result.synced.push(source.id);
    } catch (e) {
      result.errors[source.id] = message(e);
      next[source.id] = { ...state, lastError: message(e) };
    }
  }

  // Store the fresh workouts; a source that was skipped or failed keeps what it had.
  const byDay: Record<string, Workout[]> = {};
  for (const { days } of readings) for (const [day, d] of Object.entries(days)) (byDay[day] ??= []).push(...d.workouts);
  await replaceWorkouts(db, opts.days, readings.map((r) => r.source.id), byDay);

  // Weight readings from the health hubs, never overwriting one the person typed in.
  for (const { source } of readings) {
    if (!source.hub) continue;
    try {
      const from = addDays(last, -WEIGHT_WINDOW_DAYS);
      for (const w of await source.readWeights(from, last)) await importWeight(db, w.date, w.kg, source.id);
    } catch (e) {
      result.errors[source.id] = message(e);
    }
  }

  const stored = await getWorkouts(db, first, last);
  const enabledIds = new Set(enabled.map((s) => s.id));
  const hubs = readings.filter((r) => r.source.hub);

  for (const day of opts.days) {
    const hubSteps = hubs.find((h) => h.days[day]?.steps != null);
    const hubActive = hubs.find((h) => h.days[day]?.activeKcal != null);
    const workouts = stored.filter((w) => w.date === day && enabledIds.has(w.source));
    const isToday = day === opts.today;
    // Past days with nothing new to say are left alone.
    if (!isToday && !hubSteps && !hubActive && workouts.length === 0) continue;

    const steps = hubSteps?.days[day].steps ?? (isToday ? opts.baseSteps : await getStepsForDay(db, day));
    const energy = computeEnergy({
      profile: opts.profile,
      steps,
      hubActiveKcal: hubActive?.days[day].activeKcal ?? null,
      workouts,
    });
    const activity: DayActivity = { date: day, steps, activeKcal: energy.activeKcal, basis: energy.basis };
    await saveDayActivity(db, activity);
    if (isToday) result.today = { ...activity, workouts: energy.workouts, stepsFrom: (hubSteps?.source.id as HubId | undefined) ?? null };
  }

  await saveIntegrations(db, next);
  return result;
}
