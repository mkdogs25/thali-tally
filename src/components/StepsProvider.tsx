import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { dateKey } from '../lib/dates';
import { getStepsForDay, saveSteps } from '../lib/db';
import { readTodaySteps, StepReading, watchLiveSteps } from '../lib/steps';

const StepsContext = createContext<{ reading: StepReading; refresh: () => Promise<void> }>({
  reading: { steps: 0, source: 'none' },
  refresh: async () => {},
});

export const useSteps = () => useContext(StepsContext);

const REFRESH_MS = 60_000;

/** Keeps today's step count fresh, remembers it per day, and counts live steps as a fallback. */
export function StepsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [reading, setReading] = useState<StepReading>({ steps: 0, source: 'none' });
  const live = useRef({ day: dateKey(), steps: 0, loaded: false });

  const refresh = useCallback(async () => {
    const today = dateKey();
    if (live.current.day !== today) live.current = { day: today, steps: 0, loaded: true };
    if (!live.current.loaded) {
      live.current.steps = await getStepsForDay(db, today);
      live.current.loaded = true;
    }
    const r = await readTodaySteps(live.current.steps);
    setReading(r);
    if (r.source !== 'none') await saveSteps(db, today, r.steps);
  }, [db]);

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

  return <StepsContext.Provider value={{ reading, refresh }}>{children}</StepsContext.Provider>;
}
