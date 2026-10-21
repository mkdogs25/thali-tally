/**
 * Bundled nutrition database for vegetarian Indian cooking.
 *
 * Ingredient values are per 100 g of the raw, edible portion, as published in the
 * ICMR-NIN Indian Food Composition Tables (IFCT 2017) and the older NIN
 * "Nutritive Value of Indian Foods" tables. Dishes are NOT typed in as finished
 * numbers: each one is a recipe of raw ingredient weights per serving, and its
 * nutrition is computed from the ingredient table, so every figure is traceable.
 *
 * Values should be spot-checked against IFCT 2017 before relying on them for
 * medical purposes (see README).
 */

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Ingredient extends Nutrition {
  id: string;
  name: string;
}

// id, name, kcal, protein g, carbs g, fat g  — all per 100 g raw
const INGREDIENT_ROWS: [string, string, number, number, number, number][] = [
  // Pulses & legumes
  ['toor_dal', 'Toor dal (arhar)', 343, 22.3, 57.6, 1.7],
  ['moong_dal', 'Moong dal (split, yellow)', 348, 24.0, 59.9, 1.2],
  ['masoor_dal', 'Masoor dal (red lentil)', 343, 25.1, 59.0, 0.7],
  ['chana_dal', 'Chana dal', 372, 20.8, 59.8, 5.3],
  ['urad_dal', 'Urad dal (split, white)', 347, 24.0, 59.0, 1.4],
  ['rajma', 'Rajma (kidney beans)', 346, 22.9, 60.0, 1.3],
  ['kabuli_chana', 'Kabuli chana (chickpeas)', 364, 19.0, 61.0, 6.0],
  ['kala_chana', 'Kala chana (black chickpeas)', 360, 17.5, 61.0, 5.3],
  ['sprouts', 'Moong sprouts', 62, 6.0, 8.5, 0.4],
  ['soya_chunks', 'Soya chunks (nutrela)', 345, 52.0, 33.0, 0.5],
  ['roasted_chana', 'Roasted chana', 369, 22.5, 58.1, 5.2],
  ['sattu', 'Sattu (roasted gram flour)', 390, 22.7, 64.0, 5.2],
  // Dairy & alternatives
  ['paneer', 'Paneer', 285, 18.0, 3.0, 22.0],
  ['tofu', 'Tofu', 76, 8.0, 1.9, 4.8],
  ['curd', 'Curd / dahi (whole milk)', 60, 3.1, 3.0, 4.0],
  ['buttermilk', 'Buttermilk / chaas', 15, 0.9, 1.5, 0.5],
  ['milk', 'Milk, cow (whole)', 67, 3.2, 4.4, 4.1],
  ['toned_milk', 'Milk, toned', 58, 3.0, 4.7, 3.0],
  // Fats & sweeteners
  ['ghee', 'Ghee', 900, 0, 0, 100],
  ['oil', 'Cooking oil', 900, 0, 0, 100],
  ['butter', 'Butter', 729, 0.5, 0.1, 81],
  ['sugar', 'Sugar', 400, 0, 100, 0],
  ['jaggery', 'Jaggery (gur)', 383, 0.4, 95.0, 0.1],
  // Grains & flours
  ['atta', 'Wheat flour (atta)', 341, 12.1, 69.4, 1.7],
  ['rice', 'Rice, raw milled', 345, 6.8, 78.2, 0.5],
  ['poha', 'Poha (flattened rice)', 346, 6.6, 77.3, 1.2],
  ['besan', 'Besan (gram flour)', 387, 22.4, 57.8, 6.7],
  ['sooji', 'Sooji / rava', 348, 10.4, 74.8, 0.8],
  ['maida', 'Maida (refined flour)', 348, 11.0, 73.9, 0.9],
  ['oats', 'Rolled oats', 389, 16.9, 66.3, 6.9],
  ['ragi', 'Ragi (finger millet) flour', 336, 7.3, 72.0, 1.3],
  ['bajra', 'Bajra (pearl millet) flour', 361, 11.6, 67.5, 5.0],
  ['jowar', 'Jowar (sorghum) flour', 349, 10.4, 72.6, 1.9],
  ['makhana', 'Makhana (fox nuts)', 347, 9.7, 76.9, 0.1],
  // Vegetables
  ['potato', 'Potato', 97, 1.6, 22.6, 0.1],
  ['onion', 'Onion', 50, 1.2, 11.1, 0.1],
  ['tomato', 'Tomato', 20, 0.9, 3.6, 0.2],
  ['spinach', 'Spinach (palak)', 26, 2.0, 2.9, 0.7],
  ['cauliflower', 'Cauliflower (gobi)', 30, 2.6, 4.0, 0.4],
  ['cabbage', 'Cabbage', 27, 1.8, 4.6, 0.1],
  ['brinjal', 'Brinjal (baingan)', 24, 1.4, 4.0, 0.3],
  ['okra', 'Okra (bhindi)', 35, 1.9, 6.4, 0.2],
  ['carrot', 'Carrot', 48, 0.9, 10.6, 0.2],
  ['peas', 'Green peas (matar)', 93, 7.2, 15.9, 0.1],
  ['capsicum', 'Capsicum', 24, 1.3, 4.3, 0.3],
  ['lauki', 'Bottle gourd (lauki)', 12, 0.2, 2.5, 0.1],
  ['cucumber', 'Cucumber', 15, 0.7, 2.5, 0.1],
  // Nuts, seeds, fruit
  ['peanuts', 'Peanuts', 567, 25.3, 26.1, 40.1],
  ['peanut_butter', 'Peanut butter', 588, 25.0, 20.0, 50.0],
  ['almonds', 'Almonds', 579, 21.2, 21.6, 49.9],
  ['cashew', 'Cashew nuts', 596, 21.0, 22.0, 46.9],
  ['coconut', 'Coconut, fresh', 444, 4.5, 13.0, 41.6],
  ['banana', 'Banana', 116, 1.2, 27.2, 0.3],
  ['apple', 'Apple', 59, 0.2, 13.4, 0.5],
  ['mango', 'Mango, ripe', 74, 0.6, 16.9, 0.4],
];

export const INGREDIENTS: Ingredient[] = INGREDIENT_ROWS.map(([id, name, kcal, protein, carbs, fat]) => ({
  id,
  name,
  kcal,
  protein,
  carbs,
  fat,
}));

export const INGREDIENT_BY_ID: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

export interface Part {
  ingredient: string;
  grams: number;
}

export interface Dish {
  id: string;
  name: string;
  /** What one serving is, in everyday terms. */
  serving: string;
  parts: Part[];
}

const d = (id: string, name: string, serving: string, parts: [string, number][]): Dish => ({
  id,
  name,
  serving,
  parts: parts.map(([ingredient, grams]) => ({ ingredient, grams })),
});

// Raw ingredient grams per serving.
export const DISHES: Dish[] = [
  // Breads & grains
  d('roti', 'Roti / phulka', '1 medium', [['atta', 30]]),
  d('paratha', 'Plain paratha', '1 medium', [['atta', 40], ['ghee', 5]]),
  d('aloo_paratha', 'Aloo paratha', '1 medium', [['atta', 45], ['potato', 50], ['oil', 6]]),
  d('rice', 'Steamed rice', '1 katori (~150 g cooked)', [['rice', 50]]),
  d('jeera_rice', 'Jeera rice', '1 katori', [['rice', 50], ['ghee', 4]]),
  d('veg_pulao', 'Veg pulao', '1 plate', [['rice', 70], ['peas', 20], ['carrot', 20], ['onion', 15], ['oil', 8]]),
  d('khichdi', 'Moong dal khichdi', '1 bowl', [['rice', 40], ['moong_dal', 30], ['ghee', 5]]),
  d('curd_rice', 'Curd rice', '1 bowl', [['rice', 50], ['curd', 100]]),
  // Breakfast
  d('poha', 'Poha', '1 plate', [['poha', 50], ['potato', 20], ['onion', 20], ['peanuts', 10], ['oil', 6]]),
  d('upma', 'Upma', '1 plate', [['sooji', 50], ['onion', 20], ['peas', 15], ['oil', 6]]),
  d('idli', 'Idli', '2 pieces', [['rice', 30], ['urad_dal', 10]]),
  d('dosa', 'Plain dosa', '1 medium', [['rice', 30], ['urad_dal', 10], ['oil', 4]]),
  d('masala_dosa', 'Masala dosa', '1 medium', [['rice', 40], ['urad_dal', 13], ['potato', 60], ['onion', 20], ['oil', 8]]),
  d('besan_chilla', 'Besan chilla', '2 pieces', [['besan', 50], ['onion', 20], ['tomato', 15], ['oil', 6]]),
  d('oats', 'Oats porridge with milk', '1 bowl', [['oats', 40], ['milk', 150]]),
  // Dals & legumes
  d('dal_tadka', 'Dal tadka (toor)', '1 katori', [['toor_dal', 35], ['onion', 15], ['tomato', 20], ['oil', 5]]),
  d('moong_dal', 'Moong dal', '1 katori', [['moong_dal', 35], ['ghee', 4], ['tomato', 15]]),
  d('sambar', 'Sambar', '1 katori', [['toor_dal', 25], ['lauki', 50], ['tomato', 20], ['onion', 15], ['oil', 3]]),
  d('rajma', 'Rajma masala', '1 katori', [['rajma', 40], ['onion', 30], ['tomato', 40], ['oil', 6]]),
  d('chole', 'Chole masala', '1 katori', [['kabuli_chana', 45], ['onion', 30], ['tomato', 40], ['oil', 7]]),
  d('soya_curry', 'Soya chunk curry', '1 katori', [['soya_chunks', 30], ['onion', 30], ['tomato', 40], ['oil', 6]]),
  d('sprouts_salad', 'Sprouts salad', '1 bowl', [['sprouts', 80], ['onion', 15], ['tomato', 20], ['cucumber', 30]]),
  // Paneer
  d('palak_paneer', 'Palak paneer', '1 katori', [['paneer', 60], ['spinach', 100], ['onion', 20], ['oil', 6]]),
  d('matar_paneer', 'Matar paneer', '1 katori', [['paneer', 60], ['peas', 50], ['onion', 30], ['tomato', 40], ['oil', 7]]),
  d('paneer_bhurji', 'Paneer bhurji', '1 katori', [['paneer', 80], ['onion', 30], ['tomato', 30], ['oil', 6]]),
  d('paneer_tikka', 'Paneer tikka', '5–6 pieces', [['paneer', 100], ['curd', 30], ['capsicum', 30], ['oil', 5]]),
  // Sabzis
  d('aloo_gobi', 'Aloo gobi', '1 katori', [['potato', 80], ['cauliflower', 80], ['onion', 20], ['oil', 7]]),
  d('bhindi', 'Bhindi fry', '1 katori', [['okra', 120], ['onion', 20], ['oil', 7]]),
  d('baingan_bharta', 'Baingan bharta', '1 katori', [['brinjal', 150], ['onion', 30], ['tomato', 30], ['oil', 7]]),
  d('lauki_sabzi', 'Lauki sabzi', '1 katori', [['lauki', 150], ['tomato', 20], ['oil', 5]]),
  d('cabbage_sabzi', 'Cabbage matar sabzi', '1 katori', [['cabbage', 120], ['peas', 20], ['oil', 5]]),
  d('mixed_veg', 'Mixed vegetable sabzi', '1 katori', [['carrot', 30], ['peas', 30], ['cauliflower', 50], ['potato', 30], ['onion', 20], ['oil', 6]]),
  // Dairy & sides
  d('curd', 'Curd / dahi', '1 katori (100 g)', [['curd', 100]]),
  d('raita', 'Veg raita', '1 katori', [['curd', 100], ['cucumber', 30], ['tomato', 15]]),
  d('chaas', 'Chaas / buttermilk', '1 glass (200 ml)', [['buttermilk', 200]]),
  d('milk_glass', 'Milk', '1 glass (200 ml)', [['milk', 200]]),
  // Snacks & drinks
  d('chai', 'Masala chai', '1 cup', [['milk', 100], ['sugar', 5]]),
  d('roasted_chana', 'Roasted chana', '30 g', [['roasted_chana', 30]]),
  d('makhana', 'Roasted makhana', '30 g', [['makhana', 30], ['ghee', 3]]),
  d('peanuts', 'Peanuts', 'a handful (25 g)', [['peanuts', 25]]),
  d('almonds', 'Almonds', '10 pieces (12 g)', [['almonds', 12]]),
  d('banana', 'Banana', '1 medium', [['banana', 100]]),
  d('sattu_drink', 'Sattu drink', '1 glass', [['sattu', 30]]),
];

export const DISH_BY_ID: Record<string, Dish> = Object.fromEntries(DISHES.map((x) => [x.id, x]));

export const ZERO: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function add(a: Nutrition, b: Nutrition): Nutrition {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
}

export function scale(n: Nutrition, factor: number): Nutrition {
  return { kcal: n.kcal * factor, protein: n.protein * factor, carbs: n.carbs * factor, fat: n.fat * factor };
}

/** Nutrition of `grams` of an ingredient. Unknown ingredients count as zero rather than throwing. */
export function ingredientNutrition(ingredientId: string, grams: number): Nutrition {
  const ing = INGREDIENT_BY_ID[ingredientId];
  if (!ing) return ZERO;
  return scale(ing, grams / 100);
}

export function partsNutrition(parts: Part[]): Nutrition {
  return parts.reduce((sum, p) => add(sum, ingredientNutrition(p.ingredient, p.grams)), ZERO);
}

export function dishNutrition(dish: Dish): Nutrition {
  return partsNutrition(dish.parts);
}

export function searchFoods(query: string): { dishes: Dish[]; ingredients: Ingredient[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { dishes: DISHES, ingredients: INGREDIENTS };
  return {
    dishes: DISHES.filter((x) => x.name.toLowerCase().includes(q)),
    ingredients: INGREDIENTS.filter((x) => x.name.toLowerCase().includes(q)),
  };
}
