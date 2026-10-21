import type { FoodUnit, ResolvedFavourite } from './favourites';
import { add, DISH_BY_ID, dishNutrition, MealType, Nutrition, scale, ZERO } from './foods';

interface Item {
  /** Dish id from the built-in list, or a resolved food (a favourite). */
  food: string | FoodUnit;
  servings: number;
}

const d = (food: string, servings = 1): Item => ({ food, servings });

const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

const COMBOS: Record<MealType, Item[][]> = {
  breakfast: [
    [d('poha'), d('curd')],
    [d('upma'), d('curd')],
    [d('idli'), d('sambar')],
    [d('besan_chilla'), d('curd')],
    [d('paneer_bhurji'), d('roti', 2)],
    [d('oats'), d('banana')],
    [d('aloo_paratha'), d('curd')],
    [d('dosa'), d('sambar')],
  ],
  lunch: [
    [d('roti', 2), d('dal_tadka'), d('bhindi'), d('curd')],
    [d('rice'), d('rajma'), d('raita')],
    [d('roti', 2), d('palak_paneer'), d('moong_dal')],
    [d('rice'), d('chole'), d('raita')],
    [d('khichdi'), d('curd'), d('sprouts_salad')],
    [d('veg_pulao'), d('raita'), d('moong_dal')],
    [d('roti', 2), d('soya_curry'), d('cabbage_sabzi')],
    [d('rice'), d('sambar'), d('lauki_sabzi'), d('curd')],
  ],
  snack: [
    [d('roasted_chana')],
    [d('makhana')],
    [d('chai'), d('peanuts')],
    [d('sprouts_salad')],
    [d('banana'), d('almonds')],
    [d('chaas'), d('roasted_chana')],
    [d('sattu_drink')],
  ],
  dinner: [
    [d('roti', 2), d('matar_paneer'), d('curd')],
    [d('roti', 2), d('dal_tadka'), d('mixed_veg')],
    [d('khichdi'), d('baingan_bharta'), d('curd')],
    [d('roti', 2), d('paneer_bhurji'), d('lauki_sabzi')],
    [d('rice'), d('rajma'), d('cabbage_sabzi')],
    [d('roti', 2), d('chole'), d('raita')],
    [d('roti', 2), d('aloo_gobi'), d('moong_dal')],
    [d('paneer_tikka'), d('roti', 2), d('sprouts_salad')],
  ],
};

/** What to put beside one of the person's regular foods so the plate is complete. */
const SIDES: Record<MealType, Item[][]> = {
  breakfast: [[], [d('curd')], [d('banana')], [d('milk_glass')], [d('curd'), d('banana')]],
  lunch: [[], [d('roti', 2), d('curd')], [d('rice'), d('curd')], [d('roti', 2), d('dal_tadka')], [d('roti', 2), d('moong_dal'), d('sprouts_salad')]],
  dinner: [[], [d('roti', 2), d('curd')], [d('rice'), d('curd')], [d('roti', 2), d('dal_tadka')], [d('roti', 2), d('moong_dal'), d('sprouts_salad')]],
  snack: [[], [d('chai')], [d('banana')], [d('roasted_chana')]],
};

const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface SuggestedItem {
  id: string;
  name: string;
  serving: string;
  servings: number;
  /** True when this is one of the person's regular foods. */
  regular: boolean;
}

export interface SuggestedMeal {
  meal: MealType;
  items: SuggestedItem[];
  nutrition: Nutrition;
  /** True when the meal was built from the person's regular foods. */
  fromRegulars: boolean;
}

export interface SuggestedDay {
  meals: SuggestedMeal[];
  total: Nutrition;
}

const unitOf = (food: string | FoodUnit): FoodUnit => {
  if (typeof food !== 'string') return food;
  const dish = DISH_BY_ID[food];
  return { id: dish.id, name: dish.name, serving: dish.serving, nutrition: dishNutrition(dish) };
};

const comboNutrition = (items: Item[], factor: number): Nutrition =>
  items.reduce((sum, i) => add(sum, scale(unitOf(i.food).nutrition, i.servings * factor)), ZERO);

const idOf = (i: Item) => unitOf(i.food).id;

/** Combos built around the person's regular foods for one meal: each on its own with sides, and pairs of them. */
function favouriteCombos(meal: MealType, regulars: ResolvedFavourite[]): Item[][] {
  const mine = regulars.filter((r) => r.meals.includes(meal));
  const combos: Item[][] = [];
  for (const r of mine) {
    for (const side of SIDES[meal]) {
      const sides = side.filter((s) => idOf(s) !== r.unit.id);
      combos.push([{ food: r.unit, servings: 1 }, ...sides]);
    }
  }
  if (meal !== 'snack') {
    for (let a = 0; a < mine.length; a++) {
      for (let b = a + 1; b < mine.length; b++) {
        combos.push([{ food: mine[a].unit, servings: 1 }, { food: mine[b].unit, servings: 1 }]);
        combos.push([{ food: mine[a].unit, servings: 1 }, { food: mine[b].unit, servings: 1 }, d('curd')]);
      }
    }
  }
  return combos;
}

/**
 * Builds one day of vegetarian Indian meals close to the calorie and protein targets.
 * A meal that has regular foods assigned is built from them; the others use the general menu.
 * `variant` rotates through the best-scoring options so successive days differ.
 */
export function suggestDay(targetKcal: number, targetProtein: number, variant = 0, regulars: ResolvedFavourite[] = []): SuggestedDay {
  const regularIds = new Set(regulars.map((r) => r.unit.id));
  const meals: SuggestedMeal[] = (Object.keys(MEAL_SHARE) as MealType[]).map((meal) => {
    const kcalGoal = targetKcal * MEAL_SHARE[meal];
    const proteinGoal = targetProtein * MEAL_SHARE[meal];
    const mine = favouriteCombos(meal, regulars);
    const pool = mine.length > 0 ? mine : COMBOS[meal];
    const scored = pool.flatMap((items) =>
      SCALES.map((factor) => {
        const n = comboNutrition(items, factor);
        const kcalError = Math.abs(n.kcal - kcalGoal) / kcalGoal;
        const proteinShortfall = Math.max(0, proteinGoal - n.protein) / Math.max(proteinGoal, 1);
        return { items, factor, n, score: kcalError + 0.8 * proteinShortfall };
      }),
    );
    scored.sort((a, b) => a.score - b.score);
    // Different combos only, so "variant" changes the food rather than the portion of the same food.
    const distinct = scored.filter((s, i) => scored.findIndex((o) => o.items === s.items) === i);
    const pick = distinct[variant % Math.min(3, distinct.length)];
    return {
      meal,
      fromRegulars: mine.length > 0,
      items: pick.items.map((i) => {
        const u = unitOf(i.food);
        return { id: u.id, name: u.name, serving: u.serving, servings: i.servings * pick.factor, regular: regularIds.has(u.id) };
      }),
      nutrition: pick.n,
    };
  });
  return { meals, total: meals.reduce((sum, m) => add(sum, m.nutrition), ZERO) };
}
