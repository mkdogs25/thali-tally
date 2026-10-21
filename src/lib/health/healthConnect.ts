import { Platform } from 'react-native';
import { dateKey, parseKey } from '../dates';
import { appNameFromPackage, kindFromHealthConnect, KIND_LABEL } from './kinds';
import type { Availability, HealthSource, SourceDay, WeightSample, Workout } from './types';

type HealthConnectModule = typeof import('react-native-health-connect');

/** The native module exists only in Android development builds (not Expo Go, not iOS). */
function load(): HealthConnectModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnectModule;
  } catch {
    return null;
  }
}

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

const range = (day: string) => {
  const start = parseKey(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: (end.getTime() > Date.now() ? new Date() : end).toISOString(),
  };
};

/**
 * Health Connect is Android's health hub. Samsung Health, Garmin Connect, Fitbit, Mi Fitness, Oura, Withings,
 * Polar, Zepp and others write into it, so reading it picks up most smartwatches and fitness apps at once.
 */
export const healthConnect: HealthSource = {
  id: 'health-connect',
  label: 'Health Connect',
  hub: true,

  async available(): Promise<Availability> {
    if (Platform.OS !== 'android') return { ok: false, reason: 'Health Connect is only on Android.' };
    const hc = load();
    if (!hc) return { ok: false, reason: 'Needs the development build. Health Connect is not available in Expo Go.' };
    try {
      const status = await hc.getSdkStatus();
      if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: true };
      if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return { ok: false, reason: 'Install or update Health Connect from the Play Store.' };
      }
      return { ok: false, reason: 'Health Connect is not available on this phone.' };
    } catch {
      return { ok: false, reason: 'Could not reach Health Connect.' };
    }
  },

  async connect() {
    const hc = load();
    if (!hc) return 'Health Connect is not available in this build.';
    try {
      if (!(await hc.initialize())) return 'Health Connect could not start.';
      const granted = await hc.requestPermission([...PERMISSIONS]);
      const has = (type: string) => granted.some((p) => p.recordType === type);
      if (!has('Steps') && !has('ExerciseSession')) return 'No permissions were granted. Allow steps and exercise in Health Connect.';
      return null;
    } catch {
      return 'Health Connect permission was not completed.';
    }
  },

  async disconnect() {
    const hc = load();
    try {
      await hc?.revokeAllPermissions();
    } catch {
      // Nothing to revoke, or the person already did it in Health Connect.
    }
  },

  async readDays(days): Promise<Record<string, SourceDay>> {
    const hc = load();
    const out: Record<string, SourceDay> = {};
    if (!hc || !(await hc.initialize())) return out;
    const granted = await hc.getGrantedPermissions();
    const can = (type: string) => granted.some((p) => p.recordType === type && p.accessType === 'read');

    for (const day of days) {
      const timeRangeFilter = range(day);
      const steps = can('Steps') ? await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter }) : null;
      const active = can('ActiveCaloriesBurned') ? await hc.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }) : null;
      const workouts: Workout[] = [];

      if (can('ExerciseSession')) {
        const sessions = await hc.readRecords('ExerciseSession', { timeRangeFilter });
        for (const s of sessions.records) {
          const origin = s.metadata?.dataOrigin;
          const sessionRange = { operator: 'between' as const, startTime: s.startTime, endTime: s.endTime };
          // Energy and distance for the session come from the same app that recorded it.
          const dataOriginFilter = origin ? [origin] : undefined;
          const energy = can('ActiveCaloriesBurned')
            ? await hc.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: sessionRange, dataOriginFilter })
            : null;
          const distance = can('Distance')
            ? await hc.aggregateRecord({ recordType: 'Distance', timeRangeFilter: sessionRange, dataOriginFilter })
            : null;
          const kind = kindFromHealthConnect(s.exerciseType);
          const kcal = energy?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? null;
          const metres = distance?.DISTANCE?.inMeters ?? null;
          workouts.push({
            id: `health-connect:${s.metadata?.id ?? `${origin}:${s.startTime}`}`,
            source: 'health-connect',
            app: appNameFromPackage(origin),
            kind,
            name: s.title || KIND_LABEL[kind],
            startMs: Date.parse(s.startTime),
            endMs: Date.parse(s.endTime),
            kcal: kcal && kcal > 0 ? kcal : null,
            distanceM: metres && metres > 0 ? metres : null,
          });
        }
      }

      out[day] = {
        steps: steps ? steps.COUNT_TOTAL ?? 0 : null,
        activeKcal: active ? active.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? null : null,
        workouts,
      };
    }
    return out;
  },

  async readWeights(fromDay, toDay): Promise<WeightSample[]> {
    const hc = load();
    if (!hc || !(await hc.initialize())) return [];
    const granted = await hc.getGrantedPermissions();
    if (!granted.some((p) => p.recordType === 'Weight')) return [];
    const res = await hc.readRecords('Weight', {
      timeRangeFilter: { operator: 'between', startTime: parseKey(fromDay).toISOString(), endTime: new Date(parseKey(toDay).getTime() + 86_400_000).toISOString() },
      ascendingOrder: true,
    });
    const byDay = new Map<string, number>();
    for (const r of res.records) byDay.set(dateKey(new Date(r.time)), r.weight.inKilograms);
    return [...byDay].map(([date, kg]) => ({ date, kg }));
  },
};
