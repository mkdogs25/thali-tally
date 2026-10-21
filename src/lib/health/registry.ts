import { Platform } from 'react-native';
import { appleHealth } from './appleHealth';
import { healthConnect } from './healthConnect';
import { strava } from './strava';
import type { HealthSource } from './types';

/** The sources that make sense on this platform. Strava is in the phone apps only (its token exchange cannot run in a browser). */
export function sourcesForPlatform(): HealthSource[] {
  if (Platform.OS === 'ios') return [appleHealth, strava];
  if (Platform.OS === 'android') return [healthConnect, strava];
  return [];
}

export const INFO: Record<HealthSource['id'], { title: string; blurb: string; reads: string }> = {
  'apple-health': {
    title: 'Apple Health',
    blurb: 'Your iPhone’s health hub. Apple Watch, Garmin Connect, Fitbit, Oura, WHOOP, Withings, Polar and Strava can all write into it, so connecting this brings them in together.',
    reads: 'Steps, active energy, workouts and weight. Read-only.',
  },
  'health-connect': {
    title: 'Health Connect',
    blurb: 'Android’s health hub (it replaces Google Fit). Samsung Health, Garmin Connect, Fitbit, Mi Fitness, Oura, Withings, Polar, Zepp and Wear OS watches write into it, so connecting this brings them in together.',
    reads: 'Steps, active calories, exercise sessions, distance and weight. Read-only.',
  },
  strava: {
    title: 'Strava',
    blurb: 'Pulls your runs, rides, swims, walks and workouts straight from Strava, with the calories Strava worked out.',
    reads: 'Your activities. Read-only.',
  },
};
