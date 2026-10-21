import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { startOfDay } from './dates';

/**
 * Where a step count came from, from most to least trustworthy:
 *  - 'apple-health'    Apple Health (connected in the app): iPhone and Apple Watch and other apps, de-duplicated.
 *  - 'health-connect'  Android Health Connect (connected in the app): whatever step recorder the phone has, de-duplicated.
 *  - 'ios-motion'      The iPhone's own Core Motion store. Counts all day with the app closed, phone only.
 *  - 'live'            Steps counted only while this app is open (Android without Health Connect). Under-counts.
 *  - 'none'            No step sensor or permission denied.
 */
export type StepSource = 'apple-health' | 'health-connect' | 'ios-motion' | 'live' | 'none';

export interface StepReading {
  steps: number;
  source: StepSource;
  /** Plain-language explanation shown in the UI when the reading is not fully reliable. */
  note?: string;
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
 * Today's steps from the phone's own sensor. `liveFallback` is the count accumulated by `watchLiveSteps`
 * while the app was open, used on Android where the sensor has no all-day history. Connecting Health Connect
 * (Connected apps) replaces this with an all-day figure.
 */
export async function readTodaySteps(liveFallback: number): Promise<StepReading> {
  if (Platform.OS === 'ios') return readIosMotion();
  if (Platform.OS === 'android') {
    return {
      steps: liveFallback,
      source: 'live',
      note: 'Counting only while the app is open. Connect Health Connect under Settings → Connected apps for all-day steps.',
    };
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
