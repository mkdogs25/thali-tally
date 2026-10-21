import type { NewFoodEntry } from '../../lib/db';

export type LogFn = (entry: Omit<NewFoodEntry, 'date' | 'meal'>) => Promise<void>;
