import type { SavedRecipe } from './db';
import { DISH_BY_ID, dishNutrition, MealType, Nutrition, partsNutrition, scale } from './foods';

/**
 * A food the person eats or makes regularly. `id` is `dish:<dish id>` for something from the built-in list or
 * `recipe:<uid>` for one of their own saved recipes; `meals` says which meals it normally belongs to.
 */
export interface Favourite {
  id: string;
  meals: MealType[];
}

/** Something that can go on a plate: one serving's worth of nutrition and how to describe it. */
export interface FoodUnit {
  id: string;
  name: string;
  serving: string;
  /** Nutrition of ONE serving. */
  nutrition: Nutrition;
}

export interface ResolvedFavourite {
  unit: FoodUnit;
  meals: MealType[];
}

export const dishFavourite = (dishId: string) => `dish:${dishId}`;
export const recipeFavourite = (uid: string) => `recipe:${uid}`;

const BREAKFAST = new Set(['poha', 'upma', 'idli', 'dosa', 'masala_dosa', 'besan_chilla', 'oats', 'paratha', 'aloo_paratha']);
const SNACK = new Set(['roasted_chana', 'makhana', 'peanuts', 'almonds', 'banana', 'chai', 'sattu_drink', 'sprouts_salad', 'chaas']);

/** A sensible first guess at which meals a food belongs to; the person can change it. */
export function defaultMeals(favouriteId: string): MealType[] {
  if (favouriteId.startsWith('dish:')) {
    const dish = favouriteId.slice(5);
    if (BREAKFAST.has(dish)) return ['breakfast'];
    if (SNACK.has(dish)) return ['snack'];
  }
  return ['lunch', 'dinner'];
}

/** Turns a stored favourite into a usable food, or null if it no longer exists (e.g. the recipe was deleted). */
export function resolveFavourite(fav: Favourite, recipes: SavedRecipe[]): ResolvedFavourite | null {
  if (fav.meals.length === 0) return null;
  if (fav.id.startsWith('dish:')) {
    const dish = DISH_BY_ID[fav.id.slice(5)];
    if (!dish) return null;
    return { unit: { id: fav.id, name: dish.name, serving: dish.serving, nutrition: dishNutrition(dish) }, meals: fav.meals };
  }
  if (fav.id.startsWith('recipe:')) {
    const recipe = recipes.find((r) => r.uid === fav.id.slice(7));
    if (!recipe || !(recipe.servings > 0)) return null;
    return {
      unit: { id: fav.id, name: recipe.name, serving: '1 serving', nutrition: scale(partsNutrition(recipe.parts), 1 / recipe.servings) },
      meals: fav.meals,
    };
  }
  return null;
}

export function resolveAll(favs: Favourite[], recipes: SavedRecipe[]): ResolvedFavourite[] {
  return favs.map((f) => resolveFavourite(f, recipes)).filter((r): r is ResolvedFavourite => r !== null);
}

/** Adds, updates or removes a favourite, returning a new list. */
export function toggleMeal(favs: Favourite[], id: string, meal: MealType): Favourite[] {
  return favs.map((f) => {
    if (f.id !== id) return f;
    const meals = f.meals.includes(meal) ? f.meals.filter((m) => m !== meal) : [...f.meals, meal];
    return { ...f, meals };
  });
}

export function addFavourite(favs: Favourite[], id: string): Favourite[] {
  if (favs.some((f) => f.id === id)) return favs;
  return [...favs, { id, meals: defaultMeals(id) }];
}

export const removeFavourite = (favs: Favourite[], id: string): Favourite[] => favs.filter((f) => f.id !== id);
