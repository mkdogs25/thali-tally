import { add, DISH_BY_ID, dishNutrition, MealType, Nutrition, scale, ZERO } from './foods';

interface Item {
  dish: string;
  servings: number;
}

const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

const COMBOS: Record<MealType, Item[][]> = {
  breakfast: [
    [{ dish: 'poha', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'upma', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'idli', servings: 1 }, { dish: 'sambar', servings: 1 }],
    [{ dish: 'besan_chilla', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'paneer_bhurji', servings: 1 }, { dish: 'roti', servings: 2 }],
    [{ dish: 'oats', servings: 1 }, { dish: 'banana', servings: 1 }],
    [{ dish: 'aloo_paratha', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'dosa', servings: 1 }, { dish: 'sambar', servings: 1 }],
  ],
  lunch: [
    [{ dish: 'roti', servings: 2 }, { dish: 'dal_tadka', servings: 1 }, { dish: 'bhindi', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'rice', servings: 1 }, { dish: 'rajma', servings: 1 }, { dish: 'raita', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'palak_paneer', servings: 1 }, { dish: 'moong_dal', servings: 1 }],
    [{ dish: 'rice', servings: 1 }, { dish: 'chole', servings: 1 }, { dish: 'raita', servings: 1 }],
    [{ dish: 'khichdi', servings: 1 }, { dish: 'curd', servings: 1 }, { dish: 'sprouts_salad', servings: 1 }],
    [{ dish: 'veg_pulao', servings: 1 }, { dish: 'raita', servings: 1 }, { dish: 'moong_dal', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'soya_curry', servings: 1 }, { dish: 'cabbage_sabzi', servings: 1 }],
    [{ dish: 'rice', servings: 1 }, { dish: 'sambar', servings: 1 }, { dish: 'lauki_sabzi', servings: 1 }, { dish: 'curd', servings: 1 }],
  ],
  snack: [
    [{ dish: 'roasted_chana', servings: 1 }],
    [{ dish: 'makhana', servings: 1 }],
    [{ dish: 'chai', servings: 1 }, { dish: 'peanuts', servings: 1 }],
    [{ dish: 'sprouts_salad', servings: 1 }],
    [{ dish: 'banana', servings: 1 }, { dish: 'almonds', servings: 1 }],
    [{ dish: 'chaas', servings: 1 }, { dish: 'roasted_chana', servings: 1 }],
    [{ dish: 'sattu_drink', servings: 1 }],
  ],
  dinner: [
    [{ dish: 'roti', servings: 2 }, { dish: 'matar_paneer', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'dal_tadka', servings: 1 }, { dish: 'mixed_veg', servings: 1 }],
    [{ dish: 'khichdi', servings: 1 }, { dish: 'baingan_bharta', servings: 1 }, { dish: 'curd', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'paneer_bhurji', servings: 1 }, { dish: 'lauki_sabzi', servings: 1 }],
    [{ dish: 'rice', servings: 1 }, { dish: 'rajma', servings: 1 }, { dish: 'cabbage_sabzi', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'chole', servings: 1 }, { dish: 'raita', servings: 1 }],
    [{ dish: 'roti', servings: 2 }, { dish: 'aloo_gobi', servings: 1 }, { dish: 'moong_dal', servings: 1 }],
    [{ dish: 'paneer_tikka', servings: 1 }, { dish: 'roti', servings: 2 }, { dish: 'sprouts_salad', servings: 1 }],
  ],
};

const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface SuggestedMeal {
  meal: MealType;
  items: { dishId: string; name: string; serving: string; servings: number }[];
  nutrition: Nutrition;
}

export interface SuggestedDay {
  meals: SuggestedMeal[];
  total: Nutrition;
}

function comboNutrition(items: Item[], factor: number): Nutrition {
  return items.reduce((sum, i) => add(sum, scale(dishNutrition(DISH_BY_ID[i.dish]), i.servings * factor)), ZERO);
}

/**
 * Builds one day of vegetarian Indian meals close to the calorie and protein targets.
 * `variant` rotates through the best-scoring options so successive days differ.
 */
export function suggestDay(targetKcal: number, targetProtein: number, variant = 0): SuggestedDay {
  const meals: SuggestedMeal[] = (Object.keys(MEAL_SHARE) as MealType[]).map((meal) => {
    const kcalGoal = targetKcal * MEAL_SHARE[meal];
    const proteinGoal = targetProtein * MEAL_SHARE[meal];
    const scored = COMBOS[meal].flatMap((items) =>
      SCALES.map((factor) => {
        const n = comboNutrition(items, factor);
        const kcalError = Math.abs(n.kcal - kcalGoal) / kcalGoal;
        const proteinShortfall = Math.max(0, proteinGoal - n.protein) / Math.max(proteinGoal, 1);
        return { items, factor, n, score: kcalError + 0.8 * proteinShortfall };
      }),
    );
    scored.sort((a, b) => a.score - b.score);
    // Different combos only, so "variant" changes the dishes rather than the portion of the same dish.
    const distinct = scored.filter((s, i) => scored.findIndex((o) => o.items === s.items) === i);
    const pick = distinct[variant % Math.min(3, distinct.length)];
    return {
      meal,
      items: pick.items.map((i) => ({
        dishId: i.dish,
        name: DISH_BY_ID[i.dish].name,
        serving: DISH_BY_ID[i.dish].serving,
        servings: i.servings * pick.factor,
      })),
      nutrition: pick.n,
    };
  });
  return { meals, total: meals.reduce((sum, m) => add(sum, m.nutrition), ZERO) };
}
