import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { BrowseItem } from '../../lib/browse';
import { confirmAction } from '../../lib/dialogs';
import { deleteRecipe, FoodSource, getRecipes, SavedRecipe } from '../../lib/db';
import {
  Dish,
  DISHES,
  dishNutrition,
  Ingredient,
  INGREDIENTS,
  ingredientNutrition,
  Nutrition,
  partsNutrition,
  scale,
} from '../../lib/foods';
import { useFocusLoad } from '../../lib/useFocusLoad';
import { FoodBrowser, MY_RECIPES } from '../FoodBrowser';
import { Text } from '../Text';
import { colors } from '../theme';
import { Button, Card, Chip, Field, H2, n0, n1, parseNum, Wrap } from '../ui';
import type { LogFn } from './types';

type Selection =
  | { kind: 'dish'; dish: Dish }
  | { kind: 'ingredient'; ingredient: Ingredient }
  | { kind: 'recipe'; recipe: SavedRecipe };

/** Browse the bundled food list by category (or search it) plus saved recipes, pick an amount, and log it. */
export function SearchFood({ source, onLog }: { source: FoodSource; onLog: LogFn }) {
  const db = useSQLiteContext();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [amount, setAmount] = useState('1');

  const loadRecipes = useCallback(() => getRecipes(db), [db]);
  const [recipes, reloadRecipes] = useFocusLoad<SavedRecipe[]>(loadRecipes, []);

  const items = useMemo<BrowseItem<Selection>[]>(
    () => [
      ...recipes.map((r) => {
        const n = scale(partsNutrition(r.parts), 1 / r.servings);
        return { key: `r${r.id}`, name: r.name, sub: 'per serving · hold to delete', kcal: n.kcal, protein: n.protein, tags: [MY_RECIPES.id], value: { kind: 'recipe', recipe: r } as Selection };
      }),
      ...DISHES.map((x) => {
        const n = dishNutrition(x);
        return { key: x.id, name: x.name, sub: x.serving, kcal: n.kcal, protein: n.protein, tags: x.tags, keywords: x.keywords, value: { kind: 'dish', dish: x } as Selection };
      }),
      ...INGREDIENTS.map((x) => ({ key: `i-${x.id}`, name: x.name, sub: 'per 100 g, raw', kcal: x.kcal, protein: x.protein, tags: ['ingredients'], value: { kind: 'ingredient', ingredient: x } as Selection })),
    ],
    [recipes],
  );

  const choose = (item: BrowseItem<Selection>) => {
    setSelected(item.value);
    setAmount(item.value.kind === 'ingredient' ? '100' : '1');
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

  const amountCard =
    selected && nutrition ? (
      <Card style={{ borderColor: colors.accent }}>
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
    ) : null;

  return (
    <FoodBrowser
      items={items}
      onSelect={choose}
      leading={amountCard}
      onLongPress={(item) => {
        if (item.value.kind !== 'recipe') return;
        const recipe = item.value.recipe;
        confirmAction({
          title: 'Delete recipe?',
          message: recipe.name,
          confirmLabel: 'Delete',
          destructive: true,
          onConfirm: async () => {
            await deleteRecipe(db, recipe.id);
            await reloadRecipes();
          },
        });
      }}
    />
  );
}
