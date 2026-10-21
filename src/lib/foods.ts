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

import { ALIASES, DISH_ROWS } from './dishData';

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
  ['maize_flour', 'Maize flour (makki atta)', 355, 11.1, 66.2, 3.6],
  ['sabudana', 'Sabudana (tapioca pearls)', 351, 0.2, 86.6, 0.2],
  ['daliya', 'Daliya (broken wheat)', 342, 11.3, 69.0, 1.2],
  ['cornflakes', 'Corn flakes', 358, 6.8, 84.0, 0.4],
  ['bread', 'Bread, white', 245, 8.7, 50.0, 1.0],
  ['puffed_rice', 'Puffed rice (murmura)', 325, 7.1, 77.0, 0.5],
  ['khoya', 'Khoya (mawa)', 421, 14.6, 20.5, 31.2],
  ['honey', 'Honey', 304, 0.3, 82.4, 0],
  ['coffee_powder', 'Instant coffee powder', 241, 12.2, 41.1, 0.5],
  ['tea_brewed', 'Tea, brewed (no milk or sugar)', 1, 0, 0.25, 0],
  ['coconut_water', 'Coconut water', 19, 0.7, 3.7, 0.2],
  ['orange_juice', 'Orange juice', 45, 0.7, 10.4, 0.2],
  ['cola', 'Cola (soft drink)', 42, 0, 10.6, 0],
  ['mushroom', 'Mushroom', 26, 3.1, 3.3, 0.4],
  ['beetroot', 'Beetroot', 43, 1.7, 9.6, 0.1],
  ['methi', 'Fenugreek leaves (methi)', 49, 4.4, 6.0, 0.9],
  ['sweet_potato', 'Sweet potato', 120, 1.2, 28.2, 0.3],
  ['french_beans', 'French beans', 26, 1.7, 4.5, 0.1],
  ['pumpkin', 'Pumpkin', 25, 1.0, 4.6, 0.1],
  ['radish', 'Radish (mooli)', 17, 0.6, 3.4, 0.1],
  ['orange', 'Orange', 48, 0.9, 10.9, 0.3],
  ['papaya', 'Papaya', 32, 0.6, 7.2, 0.1],
  ['guava', 'Guava', 51, 0.9, 11.2, 0.3],
  ['watermelon', 'Watermelon', 16, 0.6, 3.4, 0.2],
  ['grapes', 'Grapes', 71, 0.5, 16.5, 0.2],
  ['pomegranate', 'Pomegranate', 65, 1.6, 14.5, 0.1],
  ['pineapple', 'Pineapple', 46, 0.4, 10.8, 0.1],
  ['chikoo', 'Chikoo (sapota)', 98, 0.7, 21.4, 1.1],
  ['dates', 'Dates, dried', 283, 2.5, 65.5, 0.4],
  ['raisins', 'Raisins', 308, 2.1, 75.0, 0.3],
  ['walnuts', 'Walnuts', 654, 15.2, 13.7, 65.2],
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
  /** Category ids this dish is listed under (see CATEGORIES); a dish can belong to several. */
  tags: string[];
  /** Other names and spellings people search by (never shown). */
  keywords: string;
  parts: Part[];
}

export const DISHES: Dish[] = DISH_ROWS.map(([id, name, serving, tags, parts]) => ({
  id,
  name,
  serving,
  tags,
  keywords: ALIASES[id] ?? '',
  parts: parts.map(([ingredient, grams]) => ({ ingredient, grams })),
}));

export interface Category {
  id: string;
  label: string;
  /** A few examples, shown under the name so the grouping is obvious. */
  hint: string;
}

/** Top-level groups people browse by, so the list is never one long scroll. */
export const CATEGORIES: Category[] = [
  { id: 'north', label: 'North Indian', hint: 'Dal makhani, paneer, naan, chole' },
  { id: 'south', label: 'South Indian', hint: 'Idli, dosa, sambar, rasam' },
  { id: 'west', label: 'Gujarati & Maharashtrian', hint: 'Dhokla, thepla, pav bhaji' },
  { id: 'east', label: 'Bengali & East Indian', hint: 'Khichuri, luchi, rasgulla' },
  { id: 'street', label: 'Street food & snacks', hint: 'Samosa, bhel, pakora' },
  { id: 'breakfast', label: 'Breakfast', hint: 'Poha, upma, paratha, oats' },
  { id: 'staples', label: 'Rotis, rice & curd', hint: 'Roti, rice, biryani, raita' },
  { id: 'dals', label: 'Dals & legumes', hint: 'Dal, rajma, chole, sambar' },
  { id: 'sabzi', label: 'Sabzis & vegetables', hint: 'Bhindi, aloo gobi, avial' },
  { id: 'paneer', label: 'Paneer, tofu & soy', hint: 'Palak paneer, tofu bhurji' },
  { id: 'sweets', label: 'Sweets & desserts', hint: 'Gulab jamun, kheer, halwa' },
  { id: 'fruit', label: 'Fruit & nuts', hint: 'Banana, mango, almonds' },
  { id: 'beverages', label: 'Beverages', hint: 'Tea, coffee, lassi, juices' },
  { id: 'ingredients', label: 'Raw ingredients', hint: 'Per 100 g, for your own recipes' },
];

/** Groups inside Beverages. */
export const BEVERAGE_GROUPS: Category[] = [
  { id: 'tea-coffee', label: 'Tea & coffee', hint: 'Chai, green tea, filter coffee' },
  { id: 'milk-lassi', label: 'Milk, lassi & shakes', hint: 'Lassi, chaas, haldi doodh' },
  { id: 'juices-soft', label: 'Juices & cold drinks', hint: 'Nimbu pani, coconut water' },
];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries([...CATEGORIES, ...BEVERAGE_GROUPS].map((c) => [c.id, c]));

/** Dishes listed under a category (or beverage group), in the order they were defined. */
export const dishesIn = (categoryId: string): Dish[] => DISHES.filter((x) => x.tags.includes(categoryId));

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
