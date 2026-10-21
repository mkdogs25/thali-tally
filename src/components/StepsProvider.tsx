import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { dateKey, lastNDays } from '../lib/dates';
import { getProfile, getStepsForDay, saveSteps } from '../lib/db';
import { sourcesForPlatform } from '../lib/health/registry';
import { syncHealth } from '../lib/health/sync';
import type { SourceId, Workout } from '../lib/health/types';
import { readTodaySteps, StepReading, watchLiveSteps } from '../lib/steps';

export interface TodayEnergy {
  activeKcal: number;
  basis: 'device' | 'estimate';
}

interface ActivityContext {
  reading: StepReading;
  /** Active energy for today when a health app or workouts supply it; null means "estimate from steps". */
  energy: TodayEnergy | null;
  workouts: Workout[];
  syncing: boolean;
  /** Errors from the last sync, per connected app. */
  errors: Partial<Record<SourceId, string>>;
  /** Re-reads today. */
  refresh: () => Promise<void>;
  /** Re-reads the last week from every connected app, ignoring the Strava throttle. */
  syncNow: () => Promise<void>;
}

const empty: ActivityContext = {
  reading: { steps: 0, source: 'none' },
  energy: null,
  workouts: [],
  syncing: false,
  errors: {},
  refresh: async () => {},
  syncNow: async () => {},
};

const StepsContext = createContext<ActivityContext>(empty);

export const useSteps = () => useContext(StepsContext);

const REFRESH_MS = 60_000;

/** Keeps today's steps, energy and workouts fresh from the phone sensor and every connected health app. */
export function StepsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [reading, setReading] = useState<StepReading>(empty.reading);
  const [energy, setEnergy] = useState<TodayEnergy | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [errors, setErrors] = useState<ActivityContext['errors']>({});
  const [syncing, setSyncing] = useState(false);
  const live = useRef({ day: dateKey(), steps: 0, loaded: false });
  const busy = useRef(false);

  const run = useCallback(
    async (days: string[], force: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setSyncing(true);
      try {
        const today = dateKey();
        if (live.current.day !== today) live.current = { day: today, steps: 0, loaded: true };
        if (!live.current.loaded) {
          live.current.steps = await getStepsForDay(db, today);
          live.current.loaded = true;
        }
        const sensor = await readTodaySteps(live.current.steps);
        const result = await syncHealth(db, sourcesForPlatform(), {
          days: days.includes(today) ? days : [...days, today],
          today,
          profile: await getProfile(db),
          baseSteps: sensor.steps,
          force,
        });
        setErrors(result.errors);

        if (result.today) {
          const hub = result.today.stepsFrom;
          setReading({ steps: result.today.steps, source: hub ?? sensor.source, note: hub ? undefined : sensor.note });
          setEnergy({ activeKcal: result.today.activeKcal ?? 0, basis: result.today.basis ?? 'estimate' });
          setWorkouts(result.today.workouts);
        } else {
          setReading(sensor);
          setEnergy(null);
          setWorkouts([]);
          if (sensor.source !== 'none') await saveSteps(db, today, sensor.steps);
        }
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    },
    [db],
  );

  const refresh = useCallback(() => run([dateKey()], false), [run]);
  const syncNow = useCallback(() => run(lastNDays(7), true), [run]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    let stepSub: { remove: () => void } | null = null;
    let cancelled = false;
    void watchLiveSteps((delta) => {
      const today = dateKey();
      if (live.current.day !== today) live.current = { day: today, steps: 0, loaded: true };
      live.current.steps += delta;
    }).then((s) => {
      if (cancelled) s?.remove();
      else stepSub = s;
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      appSub.remove();
      stepSub?.remove();
    };
  }, [refresh]);

  return <StepsContext.Provider value={{ reading, energy, workouts, syncing, errors, refresh, syncNow }}>{children}</StepsContext.Provider>;
}
