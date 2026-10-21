import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEVERAGE_GROUPS, CATEGORIES, CATEGORY_BY_ID, DISH_BY_ID, DISHES, dishesIn, dishNutrition, INGREDIENT_BY_ID } from '../src/lib/foods';
import { defaultMeals } from '../src/lib/favourites';

const TOP = CATEGORIES.filter((c) => c.id !== 'ingredients').map((c) => c.id);
const GROUPS = BEVERAGE_GROUPS.map((g) => g.id);
const kcal = (id: string) => dishNutrition(DISH_BY_ID[id]).kcal;
const protein = (id: string) => dishNutrition(DISH_BY_ID[id]).protein;

test('dish ids are unique and every ingredient they use exists', () => {
  assert.equal(new Set(DISHES.map((d) => d.id)).size, DISHES.length);
  for (const d of DISHES) for (const p of d.parts) {
    assert.ok(INGREDIENT_BY_ID[p.ingredient], `${d.id} uses unknown ingredient ${p.ingredient}`);
    assert.ok(p.grams > 0, `${d.id}: ${p.ingredient} must have a positive weight`);
  }
});

test('every dish sits in at least one browsable category and uses only known tags', () => {
  for (const d of DISHES) {
    assert.ok(d.tags.length > 0, `${d.id} has no category`);
    for (const t of d.tags) assert.ok(TOP.includes(t) || GROUPS.includes(t), `${d.id}: unknown tag "${t}"`);
    assert.ok(d.tags.some((t) => TOP.includes(t)), `${d.id} is not in any top-level category`);
  }
});

test('beverages are always in one of the beverage groups, and only beverages are', () => {
  for (const d of DISHES) {
    const inGroup = d.tags.some((t) => GROUPS.includes(t));
    assert.equal(d.tags.includes('beverages'), inGroup, `${d.id}: beverages tag and group must go together`);
  }
  for (const g of GROUPS) assert.ok(dishesIn(g).length >= 8, `${g} has too few drinks`);
});

test('no category is a long scroll, and none is nearly empty', () => {
  for (const c of TOP) {
    const n = dishesIn(c).length;
    assert.ok(n >= 8, `${c} has only ${n}`);
    assert.ok(n <= 60, `${c} has ${n}: split it`);
  }
  assert.ok(DISHES.length >= 150, `only ${DISHES.length} dishes`);
  for (const c of CATEGORIES) assert.ok(c.label && c.hint, c.id);
  assert.ok(CATEGORY_BY_ID['tea-coffee'] && CATEGORY_BY_ID['north']);
});

test('the foods and drinks asked for are all there', () => {
  const have = new Set(DISHES.map((d) => d.name.toLowerCase()));
  const wanted = ['masala chai', 'green tea', 'black coffee', 'south indian filter coffee', 'cold coffee', 'sweet lassi', 'tender coconut water', 'dal makhani', 'masala dosa', 'samosa', 'pav bhaji', 'gulab jamun'];
  for (const w of wanted) assert.ok([...have].some((n) => n.includes(w)), `missing ${w}`);
});

// Reasonable ranges per serving, from commonly quoted figures. These catch a mistyped quantity, not small differences.
const RANGES: [id: string, minKcal: number, maxKcal: number][] = [
  ['roti', 80, 130], ['naan', 200, 320], ['idli', 100, 180], ['dosa', 120, 220], ['masala_dosa', 250, 400], ['medu_vada', 150, 300],
  ['samosa', 200, 330], ['vada_pav', 250, 400], ['pav_bhaji', 450, 700], ['dhokla', 170, 300], ['poha', 220, 380],
  ['dal_tadka', 120, 250], ['dal_makhani', 180, 330], ['rajma', 150, 280], ['chole', 170, 300], ['palak_paneer', 200, 350],
  ['butter_paneer', 280, 450], ['veg_biryani', 350, 550], ['chole_bhature', 650, 950], ['gulab_jamun', 250, 420],
  ['kheer', 150, 300], ['jalebi', 220, 400], ['chai', 60, 120], ['black_coffee', 0, 12], ['tea_black', 0, 12],
  ['green_tea', 0, 8], ['filter_coffee', 80, 150], ['cold_coffee', 130, 260], ['lassi_sweet', 120, 250], ['chaas', 15, 60],
  ['coconut_water', 30, 70], ['orange_juice', 70, 120], ['cola', 100, 170], ['banana', 90, 130], ['apple', 60, 110],
];

test('common foods land in realistic calorie ranges per serving', () => {
  for (const [id, lo, hi] of RANGES) {
    if (!DISH_BY_ID[id]) { assert.fail(`range table names a dish that does not exist: ${id}`); continue; }
    const k = kcal(id);
    assert.ok(k >= lo && k <= hi, `${DISH_BY_ID[id].name}: ${k.toFixed(0)} kcal, expected ${lo}-${hi}`);
  }
});

test('every dish is a plausible single serving', () => {
  for (const d of DISHES) {
    const k = dishNutrition(d).kcal;
    const isDrink = d.tags.includes('beverages');
    assert.ok(k >= 0 && k <= 950, `${d.name}: ${k.toFixed(0)} kcal`);
    if (!isDrink) assert.ok(k >= 25, `${d.name} is only ${k.toFixed(0)} kcal`);
    // Only genuinely calorie-free drinks may have no ingredients at all.
    if (d.parts.length === 0) assert.ok(isDrink, `${d.id} has no ingredients`);
  }
});

test('drinks behave like drinks: milk ones carry protein, black ones do not', () => {
  assert.ok(protein('chai') > 2 && protein('coffee_milk') > 3 && protein('lassi_sweet') > 3);
  assert.ok(protein('black_coffee') < 1 && protein('green_tea') < 0.1 && protein('cola') === 0);
  assert.ok(kcal('chai_strong') > kcal('chai') && kcal('chai') > kcal('chai_no_sugar'), 'more sugar, more calories');
  assert.ok(kcal('tea_black_sugar') > kcal('tea_black'));
  assert.ok(kcal('milk_glass') > kcal('toned_milk_glass'), 'full cream has more than toned');
});

test('regular-food defaults come from a dish’s categories', () => {
  assert.deepEqual(defaultMeals('dish:poha'), ['breakfast']);
  assert.deepEqual(defaultMeals('dish:chai'), ['breakfast', 'snack']);
  assert.deepEqual(defaultMeals('dish:samosa'), ['snack']);
  assert.deepEqual(defaultMeals('dish:banana'), ['snack']);
  assert.deepEqual(defaultMeals('dish:gulab_jamun'), ['snack']);
  assert.deepEqual(defaultMeals('dish:dal_makhani'), ['lunch', 'dinner']);
  assert.deepEqual(defaultMeals('recipe:abc'), ['lunch', 'dinner']);
});
