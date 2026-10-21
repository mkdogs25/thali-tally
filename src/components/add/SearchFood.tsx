import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { deleteRecipe, FoodSource, getRecipes, SavedRecipe } from '../../lib/db';
import {
  Dish,
  dishNutrition,
  Ingredient,
  ingredientNutrition,
  Nutrition,
  partsNutrition,
  scale,
  searchFoods,
} from '../../lib/foods';
import { useFocusLoad } from '../../lib/useFocusLoad';
import { colors } from '../theme';
import { Button, Card, Chip, Field, H2, Muted, n0, n1, parseNum, Row, Wrap } from '../ui';
import type { LogFn } from './types';

type Selection =
  | { kind: 'dish'; dish: Dish }
  | { kind: 'ingredient'; ingredient: Ingredient }
  | { kind: 'recipe'; recipe: SavedRecipe };

/** Search the bundled Indian food list and saved recipes, pick an amount, and log it. */
export function SearchFood({ source, onLog }: { source: FoodSource; onLog: LogFn }) {
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [amount, setAmount] = useState('1');

  const loadRecipes = useCallback(() => getRecipes(db), [db]);
  const [recipes, reloadRecipes] = useFocusLoad<SavedRecipe[]>(loadRecipes, []);

  const { dishes, ingredients } = searchFoods(query);
  const q = query.trim().toLowerCase();
  const myRecipes = recipes.filter((r) => !q || r.name.toLowerCase().includes(q));

  const choose = (s: Selection) => {
    setSelected(s);
    setAmount(s.kind === 'ingredient' ? '100' : '1');
  };

  const qty = parseNum(amount);
  let nutrition: Nutrition | null = null;
  let name = '';
  let qtyLabel = '';
  let unit = 'servings';
  if (selected && qty > 0) {
    if (selected.kind === 'dish') {
      nutrition = scale(dishNutrition(selected.dish), qty);
      name = selected.dish.name;
      qtyLabel = `${n1(qty)} × ${selected.dish.serving}`;
    } else if (selected.kind === 'ingredient') {
      nutrition = ingredientNutrition(selected.ingredient.id, qty);
      name = selected.ingredient.name;
      qtyLabel = `${n0(qty)} g raw`;
      unit = 'grams';
    } else {
      nutrition = scale(partsNutrition(selected.recipe.parts), qty / selected.recipe.servings);
      name = selected.recipe.name;
      qtyLabel = `${n1(qty)} serving${qty === 1 ? '' : 's'}`;
    }
  }
  if (selected?.kind === 'ingredient') unit = 'grams';

  const submit = () => {
    if (!nutrition || !selected) return;
    void onLog({
      name,
      qty: qtyLabel,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      source: selected.kind === 'recipe' ? 'recipe' : source === 'photo' ? 'photo' : selected.kind,
    });
  };

  const row = (key: string, title: string, sub: string, kcal: number, protein: number, s: Selection, onLongPress?: () => void) => (
    <Pressable
      key={key}
      onPress={() => choose(s)}
      onLongPress={onLongPress}
      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{title}</Text>
          <Muted>{sub}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{n0(kcal)} kcal</Text>
          <Muted>{n1(protein)} g protein</Muted>
        </View>
      </Row>
    </Pressable>
  );

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search dal, paneer, roti, poha…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#fff', padding: 12, fontSize: 16, color: colors.text }}
        />
      </View>

      {selected && nutrition ? (
        <Card style={{ borderColor: colors.saffron }}>
          <H2>{name}</H2>
          <Field label={unit === 'grams' ? 'Amount (grams, raw weight)' : 'Number of servings'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          {unit !== 'grams' ? (
            <Wrap>
              {[0.5, 1, 1.5, 2, 3].map((v) => (
                <Chip key={v} label={`${v}×`} selected={qty === v} onPress={() => setAmount(String(v))} />
              ))}
            </Wrap>
          ) : null}
          <Text style={{ color: colors.text, fontSize: 16, marginBottom: 12 }}>
            <Text style={{ fontWeight: '800' }}>{n0(nutrition.kcal)} kcal</Text> · {n1(nutrition.protein)} g protein · {n1(nutrition.carbs)} g carbs · {n1(nutrition.fat)} g fat
          </Text>
          <Button title="Add to log" onPress={submit} />
          <Button title="Cancel" kind="secondary" onPress={() => setSelected(null)} />
        </Card>
      ) : null}

      {myRecipes.length > 0 ? (
        <>
          <H2>My recipes</H2>
          {myRecipes.map((r) => {
            const n = scale(partsNutrition(r.parts), 1 / r.servings);
            return row(`r${r.id}`, r.name, 'per serving · hold to delete', n.kcal, n.protein, { kind: 'recipe', recipe: r }, () =>
              Alert.alert('Delete recipe?', r.name, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteRecipe(db, r.id);
                    await reloadRecipes();
                  },
                },
              ]),
            );
          })}
        </>
      ) : null}

      {dishes.length > 0 ? <H2>Dishes</H2> : null}
      {dishes.map((x) => {
        const n = dishNutrition(x);
        return row(x.id, x.name, x.serving, n.kcal, n.protein, { kind: 'dish', dish: x });
      })}

      {ingredients.length > 0 ? <H2>Ingredients (per 100 g, raw)</H2> : null}
      {ingredients.map((x) => row(x.id, x.name, 'per 100 g', x.kcal, x.protein, { kind: 'ingredient', ingredient: x }))}

      {dishes.length + ingredients.length + myRecipes.length === 0 ? (
        <Muted>No match. Try the Recipe tab to build it from ingredients, or Quick add to type the numbers.</Muted>
      ) : null}
    </View>
  );
}
