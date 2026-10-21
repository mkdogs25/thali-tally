import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Runs `load` every time the screen gains focus and returns its latest result plus a manual reload.
 * Pass a `trigger` (for example a sync counter) to also reload while the screen stays open.
 */
export function useFocusLoad<T>(load: () => Promise<T>, initial: T, trigger?: unknown): [T, () => Promise<void>] {
  const [value, setValue] = useState<T>(initial);
  const run = useCallback(async () => {
    setValue(await load());
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void run();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, trigger]),
  );
  return [value, run];
}
