import { Profile, stepsToKcal, WALKING_KCAL_PER_KG_KM } from '../plan';
import { STEP_BASED } from './kinds';
import type { SourceId, Workout } from './types';

/** Preferred source when two copies of the same workout exist: watch data beats a phone app's estimate. */
export const PRIORITY: SourceId[] = ['apple-health', 'health-connect', 'strava'];

const HUBS: ReadonlySet<SourceId> = new Set(['apple-health', 'health-connect']);

/** Fraction of the shorter workout's duration that overlaps with the other. */
export function overlapFraction(a: Workout, b: Workout): number {
  const overlap = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  if (overlap <= 0 || shorter <= 0) return 0;
  return overlap / shorter;
}

/**
 * The same run often arrives twice: once from the watch via Apple Health / Health Connect and again from
 * Strava. Two workouts that overlap by at least half are treated as one; the higher-priority copy wins and
 * borrows any energy or distance it lacks from the duplicate.
 */
export function dedupeWorkouts(all: Workout[], priority: SourceId[] = PRIORITY): Workout[] {
  const rank = (w: Workout) => priority.indexOf(w.source);
  const sorted = [...all].sort((a, b) => rank(a) - rank(b) || b.endMs - b.startMs - (a.endMs - a.startMs));
  const kept: Workout[] = [];
  for (const w of sorted) {
    const twin = kept.find((k) => overlapFraction(k, w) >= 0.5);
    if (!twin) {
      kept.push({ ...w });
      continue;
    }
    twin.kcal ??= w.kcal;
    twin.distanceM ??= w.distanceM;
  }
  return kept.sort((a, b) => a.startMs - b.startMs);
}

export interface EnergyInput {
  profile: Pick<Profile, 'heightCm' | 'sex' | 'weightKg'> | null;
  steps: number;
  /** Active energy for the day from a health hub, if one is connected and reports it. */
  hubActiveKcal: number | null;
  /** Every workout from every connected source, before de-duplication. */
  workouts: Workout[];
}

export interface Energy {
  activeKcal: number;
  /** 'device' = measured by a watch/phone via a health hub; 'estimate' = worked out from steps and workouts. */
  basis: 'device' | 'estimate';
  workouts: Workout[];
}

/**
 * Active calories burned today, without counting anything twice.
 *
 *  - With a health hub: its active-energy total already contains walking and every workout the hub knows about
 *    (that is what Apple Health and Health Connect de-duplicate for us). We only add workouts from outside the
 *    hub (e.g. a Strava ride whose watch never wrote to the hub), and only if they do not overlap a hub workout.
 *  - Without one: steps × stride × weight, plus each workout's energy. For walks, runs and hikes the steps
 *    are already in that step estimate, so the walking cost of the workout's distance is taken back off.
 */
export function computeEnergy({ profile, steps, hubActiveKcal, workouts }: EnergyInput): Energy {
  const merged = dedupeWorkouts(workouts);

  if (hubActiveKcal !== null && hubActiveKcal > 0) {
    const hubWorkouts = workouts.filter((w) => HUBS.has(w.source));
    const outside = merged.filter(
      (w) => !HUBS.has(w.source) && !hubWorkouts.some((h) => overlapFraction(h, w) >= 0.5) && w.kcal !== null,
    );
    const extra = outside.reduce((sum, w) => sum + (w.kcal ?? 0), 0);
    return { activeKcal: hubActiveKcal + extra, basis: 'device', workouts: merged };
  }

  let active = profile ? stepsToKcal(steps, profile) : 0;
  for (const w of merged) {
    if (w.kcal === null) continue;
    let add = w.kcal;
    if (profile && STEP_BASED.has(w.kind) && w.distanceM) {
      const alreadyCounted = (w.distanceM / 1000) * profile.weightKg * WALKING_KCAL_PER_KG_KM;
      add = Math.max(0, w.kcal - alreadyCounted);
    }
    active += add;
  }
  return { activeKcal: active, basis: 'estimate', workouts: merged };
}
