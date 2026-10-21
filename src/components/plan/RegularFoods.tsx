import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { addFavourite, Favourite, removeFavourite, resolveFavourite, toggleMeal, dishFavourite, recipeFavourite } from '../../lib/favourites';
import type { SavedRecipe } from '../../lib/db';
import { DISHES, dishNutrition, MEAL_LABEL, MEAL_TYPES, partsNutrition, scale } from '../../lib/foods';
import { Text, TextInput } from '../Text';
import { colors } from '../theme';
import { Card, Chip, H2, Muted, n0, n1, Row, Wrap } from '../ui';

/**
 * The foods the person eats or makes regularly. Each is tied to the meals it normally belongs to, and the day of
 * meals on the plan is built from them for those meals.
 */
export function RegularFoods({ favourites, recipes, onChange }: { favourites: Favourite[]; recipes: SavedRecipe[]; onChange: (next: Favourite[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const have = new Set(favourites.map((f) => f.id));
    const mine = recipes
      .filter((r) => !have.has(recipeFavourite(r.uid)) && (!q || r.name.toLowerCase().includes(q)))
      .map((r) => ({ id: recipeFavourite(r.uid), name: r.name, sub: 'My recipe', kcal: scale(partsNutrition(r.parts), 1 / r.servings).kcal }));
    const dishes = DISHES.filter((d) => !have.has(dishFavourite(d.id)) && (!q || d.name.toLowerCase().includes(q)))
      .map((d) => ({ id: dishFavourite(d.id), name: d.name, sub: d.serving, kcal: dishNutrition(d).kcal }));
    return [...mine, ...dishes].slice(0, 10);
  }, [query, favourites, recipes]);

  return (
    <Card>
      <H2>My regular foods</H2>
      <Muted style={{ marginBottom: 10 }}>
        Add what you actually eat or cook. Pick the meals each one is for, and the day of meals below is built from them. Meals with nothing assigned use
        a general menu.
      </Muted>

      {favourites.length === 0 ? <Muted style={{ marginBottom: 10 }}>Nothing added yet.</Muted> : null}
      {favourites.map((f) => {
        const r = resolveFavourite({ ...f, meals: f.meals.length ? f.meals : ['lunch'] }, recipes);
        return (
          <View key={f.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: r ? colors.text : colors.muted, fontWeight: '700' }}>{r ? r.unit.name : 'No longer available'}</Text>
                {r ? (
                  <Muted>
                    {r.unit.serving} · {n0(r.unit.nutrition.kcal)} kcal · {n1(r.unit.nutrition.protein)} g protein
                  </Muted>
                ) : (
                  <Muted>This recipe was deleted. Remove it from the list.</Muted>
                )}
              </View>
              <Pressable onPress={() => onChange(removeFavourite(favourites, f.id))} hitSlop={10} accessibilityLabel={`Remove ${r?.unit.name ?? 'food'}`}>
                <Text style={{ color: colors.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </Row>
            {r ? (
              <View style={{ marginTop: 8 }}>
                <Wrap>
                  {MEAL_TYPES.map((m) => (
                    <Chip key={m} label={MEAL_LABEL[m]} selected={f.meals.includes(m)} onPress={() => onChange(toggleMeal(favourites, f.id, m))} />
                  ))}
                </Wrap>
                {f.meals.length === 0 ? <Muted style={{ marginTop: -6 }}>Pick at least one meal or this food is ignored.</Muted> : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {adding ? (
        <View style={{ marginTop: 12 }}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search dal, poha, paneer… or your recipes"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 10, backgroundColor: colors.inputBg, padding: 10, fontSize: 16, color: colors.text }}
          />
          {matches.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                onChange(addFavourite(favourites, m.id));
                setQuery('');
              }}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{m.name}</Text>
                  <Muted>{m.sub}</Muted>
                </View>
                <Text style={{ color: colors.muted }}>{n0(m.kcal)} kcal</Text>
              </Row>
            </Pressable>
          ))}
          {matches.length === 0 ? (
            <Muted style={{ marginTop: 8 }}>
              No match. For anything not in the list, build it once under Today › Add food › Recipe and tap “Save recipe for later”; it will show up here.
            </Muted>
          ) : null}
          <View style={{ marginTop: 10 }}>
            <Chip label="Done" onPress={() => { setAdding(false); setQuery(''); }} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Chip label="+ Add a food" onPress={() => setAdding(true)} />
        </View>
      )}
    </Card>
  );
}
