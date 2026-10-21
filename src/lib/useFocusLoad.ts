import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Runs `load` every time the screen gains focus and returns its latest result plus a manual reload. */
export function useFocusLoad<T>(load: () => Promise<T>, initial: T): [T, () => Promise<void>] {
  const [value, setValue] = useState<T>(initial);
  const run = useCallback(async () => {
    setValue(await load());
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );
  return [value, run];
}
