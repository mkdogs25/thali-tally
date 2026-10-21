import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { saveRecipe } from '../../lib/db';
import { INGREDIENT_BY_ID, Part, partsNutrition, scale } from '../../lib/foods';
import { colors } from '../theme';
import { Button, Card, Field, H2, Muted, n0, n1, parseNum, Row } from '../ui';
import { IngredientPicker } from './IngredientPicker';
import type { LogFn } from './types';

interface RowState {
  ingredient: string;
  grams: string;
}

/** Build a home recipe from raw ingredient weights; nutrition is worked out per serving. */
export function RecipeBuilder({ onLog }: { onLog: LogFn }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [eaten, setEaten] = useState('1');
  const [rows, setRows] = useState<RowState[]>([]);
  const [picking, setPicking] = useState(false);

  const parts: Part[] = rows
    .map((r) => ({ ingredient: r.ingredient, grams: parseNum(r.grams) }))
    .filter((p) => p.grams > 0);
  const total = partsNutrition(parts);
  const nServ = parseNum(servings);
  const nEaten = parseNum(eaten);
  const perServing = nServ > 0 ? scale(total, 1 / nServ) : null;
  const valid = parts.length > 0 && nServ > 0;

  const updateGrams = (i: number, grams: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, grams } : r)));

  return (
    <View>
      <Muted style={{ marginBottom: 10 }}>
        Enter the raw weight of each ingredient for the whole pot, and how many servings it makes. Spices add negligible calories and are not
        counted. Oil and ghee are — include them.
      </Muted>
      <Field label="Recipe name" value={name} onChangeText={setName} placeholder="e.g. Mum's rajma" />
      <Field label="Makes how many servings?" value={servings} onChangeText={setServings} keyboardType="decimal-pad" />

      <H2>Ingredients</H2>
      {rows.map((r, i) => (
        <Row key={i} style={{ marginBottom: 8 }}>
          <Text style={{ flex: 1, color: colors.text }}>{INGREDIENT_BY_ID[r.ingredient]?.name ?? r.ingredient}</Text>
          <TextInput
            value={r.grams}
            onChangeText={(t) => updateGrams(i, t)}
            keyboardType="decimal-pad"
            placeholder="g"
            placeholderTextColor={colors.muted}
            style={{ width: 80, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 8, backgroundColor: '#fff', color: colors.text }}
          />
          <Text style={{ marginHorizontal: 6, color: colors.muted }}>g</Text>
          <Pressable onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel="Remove ingredient">
            <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
          </Pressable>
        </Row>
      ))}

      {picking ? (
        <IngredientPicker
          onPick={(id) => {
            setRows((rs) => [...rs, { ingredient: id, grams: '' }]);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <Button title="＋ Add ingredient" kind="secondary" onPress={() => setPicking(true)} />
      )}

      {perServing && valid ? (
        <Card>
          <H2>Per serving</H2>
          <Text style={{ color: colors.text, fontSize: 16 }}>
            <Text style={{ fontWeight: '800' }}>{n0(perServing.kcal)} kcal</Text> · {n1(perServing.protein)} g protein · {n1(perServing.carbs)} g carbs · {n1(perServing.fat)} g fat
          </Text>
          <Muted style={{ marginTop: 4 }}>Whole recipe: {n0(total.kcal)} kcal, {n1(total.protein)} g protein</Muted>

          <View style={{ height: 12 }} />
          <Field label="Servings you ate" value={eaten} onChangeText={setEaten} keyboardType="decimal-pad" />
          <Button
            title="Add to log"
            disabled={!(nEaten > 0)}
            onPress={() => {
              const n = scale(total, nEaten / nServ);
              void onLog({
                name: name.trim() || 'Home recipe',
                qty: `${n1(nEaten)} of ${n1(nServ)} servings`,
                kcal: n.kcal,
                protein: n.protein,
                carbs: n.carbs,
                fat: n.fat,
                source: 'recipe',
              });
            }}
          />
          <Button
            title="Save recipe for later"
            kind="secondary"
            onPress={async () => {
              if (!name.trim()) return Alert.alert('Name needed', 'Give the recipe a name to save it.');
              await saveRecipe(db, name.trim(), nServ, parts);
              Alert.alert('Saved', 'Find it under “My recipes” in Search.');
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}
