import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Muted, parseNum } from '../ui';
import type { LogFn } from './types';

/** Manual entry for anything not in the database (restaurant meals, label values). */
export function QuickAdd({ onLog }: { onLog: LogFn }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const k = parseNum(kcal);
  const p = parseNum(protein);
  const valid = k >= 0 && p >= 0;

  return (
    <View>
      <Muted style={{ marginBottom: 10 }}>Type the values from a label or restaurant menu.</Muted>
      <Field label="What did you eat? (optional)" value={name} onChangeText={setName} />
      <Field label="Calories" suffix="kcal" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
      <Field label="Protein" suffix="g" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
      <Field label="Carbs (optional)" suffix="g" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
      <Field label="Fat (optional)" suffix="g" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
      <Button
        title="Add to log"
        disabled={!valid}
        onPress={() =>
          void onLog({
            name: name.trim() || 'Quick add',
            kcal: k,
            protein: p,
            carbs: parseNum(carbs) || 0,
            fat: parseNum(fat) || 0,
            source: 'manual',
          })
        }
      />
    </View>
  );
}
