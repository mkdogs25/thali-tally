import type { ActivityKind } from './types';

export const KIND_LABEL: Record<ActivityKind, string> = {
  walk: 'Walk',
  run: 'Run',
  hike: 'Hike',
  cycle: 'Ride',
  swim: 'Swim',
  strength: 'Strength',
  yoga: 'Yoga / Pilates',
  cardio: 'Cardio',
  other: 'Workout',
};

/** Activities whose steps are already counted in the step total (so their energy must not be added twice). */
export const STEP_BASED: ReadonlySet<ActivityKind> = new Set(['walk', 'run', 'hike']);

const HK: Record<number, ActivityKind> = {
  52: 'walk', 37: 'run', 24: 'hike', 13: 'cycle', 46: 'swim',
  50: 'strength', 20: 'strength', 59: 'strength', 57: 'yoga', 66: 'yoga',
  16: 'cardio', 35: 'cardio', 44: 'cardio', 63: 'cardio', 64: 'cardio', 69: 'cardio', 73: 'cardio', 11: 'cardio', 14: 'cardio',
};

/** Apple HKWorkoutActivityType raw value → kind. */
export const kindFromHealthKit = (type: number): ActivityKind => HK[type] ?? 'other';

const HC: Record<number, ActivityKind> = {
  79: 'walk', 56: 'run', 57: 'run', 37: 'hike', 8: 'cycle', 9: 'cycle', 73: 'swim', 74: 'swim',
  70: 'strength', 81: 'strength', 13: 'strength', 83: 'yoga', 48: 'yoga',
  25: 'cardio', 53: 'cardio', 54: 'cardio', 68: 'cardio', 69: 'cardio', 36: 'cardio', 16: 'cardio', 26: 'cardio',
};

/** Health Connect ExerciseSession type → kind. */
export const kindFromHealthConnect = (type: number): ActivityKind => HC[type] ?? 'other';

const STRAVA: Record<string, ActivityKind> = {
  Walk: 'walk', Run: 'run', TrailRun: 'run', VirtualRun: 'run', Hike: 'hike',
  Ride: 'cycle', MountainBikeRide: 'cycle', GravelRide: 'cycle', EBikeRide: 'cycle', VirtualRide: 'cycle', Handcycle: 'cycle',
  Swim: 'swim', WeightTraining: 'strength', Crossfit: 'strength',
  Yoga: 'yoga', Pilates: 'yoga',
  Elliptical: 'cardio', Rowing: 'cardio', StairStepper: 'cardio', HighIntensityIntervalTraining: 'cardio', Workout: 'cardio',
};

/** Strava `sport_type` (or legacy `type`) → kind. */
export const kindFromStrava = (sport: string): ActivityKind => STRAVA[sport] ?? 'other';

/** Well-known Android package names → what the person recognises. Unknown packages are shown as-is. */
const PACKAGE_NAMES: Record<string, string> = {
  'com.strava': 'Strava',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.mi.health': 'Mi Fitness',
  'com.huawei.health': 'Huawei Health',
  'com.ouraring.oura': 'Oura',
  'com.withings.wiscale2': 'Withings',
  'fi.polar.polarflow': 'Polar Flow',
  'com.zepp.life': 'Zepp',
  'com.zepp.zeppos': 'Zepp',
  'com.whoop.android': 'WHOOP',
  'com.google.android.apps.wear.companion': 'Wear OS',
  'com.coros.coros': 'COROS',
  'com.suunto.suuntoapp': 'Suunto',
  'com.noisefit': 'NoiseFit',
  'com.gizwits.gizfit': 'boAt Crest',
};

export function appNameFromPackage(pkg: string | undefined): string {
  if (!pkg) return 'Health Connect';
  return PACKAGE_NAMES[pkg] ?? pkg.split('.').slice(-1)[0].replace(/^./, (c) => c.toUpperCase());
}

// --- unit conversion (HealthKit returns whatever unit the person's phone prefers) ---

const METRES: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 };
const KCAL: Record<string, number> = { kcal: 1, Cal: 1, cal: 0.001, kJ: 1 / 4.184, J: 1 / 4184 };

export function toMetres(value: number, unit: string): number | null {
  const f = METRES[unit];
  return f === undefined ? null : value * f;
}

export function toKcal(value: number, unit: string): number | null {
  const f = KCAL[unit];
  return f === undefined ? null : value * f;
}
