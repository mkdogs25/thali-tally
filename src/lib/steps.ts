import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { startOfDay } from './dates';

/**
 * Where a step count came from, from most to least trustworthy:
 *  - 'ios-motion'      Apple's Core Motion store. Counts all day with the app closed.
 *  - 'health-connect'  Android Health Connect. Counts whatever step recorder the phone has
 *                      (Google Fit / Fitbit / Samsung Health / the phone's own recorder), de-duplicated.
 *  - 'live'            Steps counted only while this app is open (Expo Go / no Health Connect). Under-counts.
 *  - 'none'            No step sensor or permission denied.
 */
export type StepSource = 'ios-motion' | 'health-connect' | 'live' | 'none';

export interface StepReading {
  steps: number;
  source: StepSource;
  /** Plain-language explanation shown in the UI when the reading is not fully reliable. */
  note?: string;
}

type HealthConnectModule = typeof import('react-native-health-connect');

/** Loads the native Health Connect module, or null when it is not in this build (e.g. Expo Go). */
function loadHealthConnect(): HealthConnectModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnectModule;
  } catch {
    return null;
  }
}

async function readHealthConnect(): Promise<StepReading | null> {
  const hc = loadHealthConnect();
  if (!hc) return null;
  try {
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return { steps: 0, source: 'none', note: 'Install or update Health Connect from the Play Store to count steps.' };
    }
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await hc.initialize())) return null;

    const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    if (!granted.some((p) => p.recordType === 'Steps')) {
      return { steps: 0, source: 'none', note: 'Step permission was declined. Enable it in Health Connect settings.' };
    }
    const result = await hc.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: startOfDay().toISOString(), endTime: new Date().toISOString() },
    });
    return { steps: result.COUNT_TOTAL ?? 0, source: 'health-connect' };
  } catch {
    return null;
  }
}

async function readIosMotion(): Promise<StepReading> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return { steps: 0, source: 'none', note: 'This device has no step sensor.' };
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return { steps: 0, source: 'none', note: 'Allow Motion & Fitness for Thali Tally in Settings to count steps.' };
    const { steps } = await Pedometer.getStepCountAsync(startOfDay(), new Date());
    return { steps, source: 'ios-motion' };
  } catch {
    return { steps: 0, source: 'none', note: 'Could not read the step counter.' };
  }
}

/**
 * Today's steps so far. `liveFallback` is the count accumulated by `watchLiveSteps`
 * while the app was open, used only when no all-day source is available.
 */
export async function readTodaySteps(liveFallback: number): Promise<StepReading> {
  if (Platform.OS === 'ios') return readIosMotion();
  if (Platform.OS === 'android') {
    const hc = await readHealthConnect();
    if (hc && hc.source !== 'none') return hc;
    const fallbackNote =
      hc?.note ??
      'Steps are counted only while the app is open. For all-day counting, use the development build, which reads Android Health Connect.';
    return { steps: liveFallback, source: 'live', note: fallbackNote };
  }
  return { steps: 0, source: 'none', note: 'Step counting is available on Android and iOS.' };
}

/** Counts steps while the app is in the foreground. Calls `onDelta` with each new batch of steps. */
export async function watchLiveSteps(onDelta: (steps: number) => void): Promise<{ remove: () => void } | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return null;
    let last = 0;
    const sub = Pedometer.watchStepCount(({ steps }) => {
      // The sensor reports a running total since the subscription began.
      const delta = steps - last;
      last = steps;
      if (delta > 0) onDelta(delta);
    });
    return sub;
  } catch {
    return null;
  }
}
