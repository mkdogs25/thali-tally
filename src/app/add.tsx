import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { BarcodeLog } from '../components/add/BarcodeLog';
import { PhotoLog } from '../components/add/PhotoLog';
import { QuickAdd } from '../components/add/QuickAdd';
import { RecipeBuilder } from '../components/add/RecipeBuilder';
import { SearchFood } from '../components/add/SearchFood';
import { MEAL_ICON } from '../components/theme';
import { Chip, Wrap } from '../components/ui';
import { dateKey } from '../lib/dates';
import { addFoodEntry, NewFoodEntry } from '../lib/db';
import { MEAL_LABEL, MEAL_TYPES, MealType } from '../lib/foods';

type Mode = 'search' | 'recipe' | 'photo' | 'scan' | 'quick';
const MODES: [Mode, string][] = [
  ['search', 'Search'],
  ['recipe', 'Recipe'],
  ['photo', 'Photo'],
  ['scan', 'Barcode'],
  ['quick', 'Quick add'],
];

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

export default function AddFoodScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<MealType>(defaultMeal);

  const log = useCallback(
    async (entry: Omit<NewFoodEntry, 'date' | 'meal'>) => {
      await addFoodEntry(db, { ...entry, date: dateKey(), meal });
      router.back();
    },
    [db, meal, router],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Wrap>
          {MEAL_TYPES.map((m) => (
            <Chip key={m} label={`${MEAL_ICON[m]} ${MEAL_LABEL[m]}`} selected={meal === m} onPress={() => setMeal(m)} />
          ))}
        </Wrap>
        <Wrap>
          {MODES.map(([m, label]) => (
            <Chip key={m} label={label} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </Wrap>
        <View>
          {mode === 'search' && <SearchFood source="dish" onLog={log} />}
          {mode === 'recipe' && <RecipeBuilder onLog={log} />}
          {mode === 'photo' && <PhotoLog onLog={log} />}
          {mode === 'scan' && <BarcodeLog onLog={log} />}
          {mode === 'quick' && <QuickAdd onLog={log} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
