import { Platform } from 'react-native';
import { dateKey, parseKey } from '../dates';
import { kindFromHealthKit, KIND_LABEL, toKcal, toMetres } from './kinds';
import type { Availability, HealthSource, SourceDay, WeightSample, Workout } from './types';

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

/** The native module exists only in iOS development builds (not Expo Go, not Android). */
function load(): HealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    return null;
  }
}

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const WEIGHT = 'HKQuantityTypeIdentifierBodyMass' as const;
const WORKOUT = 'HKWorkoutTypeIdentifier' as const;

const dayBounds = (day: string) => {
  const start = parseKey(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end: end.getTime() > Date.now() ? new Date() : end };
};

export const appleHealth: HealthSource = {
  id: 'apple-health',
  label: 'Apple Health',
  hub: true,

  async available(): Promise<Availability> {
    if (Platform.OS !== 'ios') return { ok: false, reason: 'Apple Health is only on iPhone.' };
    const hk = load();
    if (!hk) return { ok: false, reason: 'Needs the development build. Apple Health is not available in Expo Go.' };
    try {
      return (await hk.isHealthDataAvailableAsync()) ? { ok: true } : { ok: false, reason: 'Health data is not available on this device.' };
    } catch {
      return { ok: false, reason: 'Could not reach Apple Health.' };
    }
  },

  async connect() {
    const hk = load();
    if (!hk) return 'Apple Health is not available in this build.';
    try {
      // HealthKit never says whether read access was granted, only that the sheet was completed.
      await hk.requestAuthorization({ toRead: [STEPS, ACTIVE, WEIGHT, WORKOUT] });
      return null;
    } catch {
      return 'Apple Health permission was not completed.';
    }
  },

  async disconnect() {
    // iOS lets only the person revoke access (Settings → Health → Data Access & Devices).
  },

  async readDays(days): Promise<Record<string, SourceDay>> {
    const hk = load();
    const out: Record<string, SourceDay> = {};
    if (!hk) return out;
    for (const day of days) {
      const { start, end } = dayBounds(day);
      const filter = { date: { startDate: start, endDate: end } };
      // cumulativeSum de-duplicates iPhone, Apple Watch and other sources for us.
      const [steps, active, workouts] = await Promise.all([
        hk.queryStatisticsForQuantity(STEPS, ['cumulativeSum'], { filter, unit: 'count' }),
        hk.queryStatisticsForQuantity(ACTIVE, ['cumulativeSum'], { filter, unit: 'kcal' }),
        hk.queryWorkoutSamples({ filter: { date: { startDate: start, endDate: end } }, limit: 0, ascending: true }),
      ]);
      const list: Workout[] = workouts.map((w) => {
        const kind = kindFromHealthKit(w.workoutActivityType as number);
        const energy = w.totalEnergyBurned ? toKcal(w.totalEnergyBurned.quantity, w.totalEnergyBurned.unit) : null;
        const distance = w.totalDistance ? toMetres(w.totalDistance.quantity, w.totalDistance.unit) : null;
        return {
          id: `apple-health:${w.uuid}`,
          source: 'apple-health',
          app: w.sourceRevision?.source?.name ?? 'Apple Health',
          kind,
          name: KIND_LABEL[kind],
          startMs: w.startDate.getTime(),
          endMs: w.endDate.getTime(),
          kcal: energy,
          distanceM: distance,
        };
      });
      out[day] = {
        steps: steps.sumQuantity ? Math.round(steps.sumQuantity.quantity) : null,
        activeKcal: active.sumQuantity ? active.sumQuantity.quantity : null,
        workouts: list,
      };
    }
    return out;
  },

  async readWeights(fromDay, toDay): Promise<WeightSample[]> {
    const hk = load();
    if (!hk) return [];
    const samples = await hk.queryQuantitySamples(WEIGHT, {
      filter: { date: { startDate: parseKey(fromDay), endDate: new Date(parseKey(toDay).getTime() + 86_400_000) } },
      limit: 0,
      ascending: true,
      unit: 'kg',
    });
    // One reading per day: the last one.
    const byDay = new Map<string, number>();
    for (const s of samples) byDay.set(dateKey(s.startDate), s.quantity);
    return [...byDay].map(([date, kg]) => ({ date, kg }));
  },
};
