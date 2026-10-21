import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, daysBetween, lastNDays } from '../src/lib/dates';
import { DISHES, dishNutrition, INGREDIENT_BY_ID, INGREDIENTS, partsNutrition } from '../src/lib/foods';
import { bmr, buildPlan, expectedWeight, Profile, stepsToKcal, stepsToKm, tdee } from '../src/lib/plan';
import { suggestDay } from '../src/lib/suggest';

const man: Profile = { sex: 'male', age: 30, heightCm: 175, weightKg: 80, activity: 'light' };
const woman: Profile = { sex: 'female', age: 28, heightCm: 160, weightKg: 62, activity: 'sedentary' };

test('every ingredient: stated kcal is consistent with its macros (Atwater, 15 % tolerance for fibre)', () => {
  for (const i of INGREDIENTS) {
    const atwater = 4 * i.protein + 4 * i.carbs + 9 * i.fat;
    const error = Math.abs(atwater - i.kcal) / Math.max(i.kcal, 1);
    assert.ok(error <= 0.15, `${i.name}: stated ${i.kcal} kcal vs ${atwater.toFixed(0)} from macros`);
  }
});

test('ingredient ids are unique and every dish references real ingredients', () => {
  assert.equal(new Set(INGREDIENTS.map((i) => i.id)).size, INGREDIENTS.length);
  assert.equal(new Set(DISHES.map((x) => x.id)).size, DISHES.length);
  for (const dish of DISHES) for (const p of dish.parts) assert.ok(INGREDIENT_BY_ID[p.ingredient], `${dish.id} → ${p.ingredient}`);
});

test('dish nutrition is computed from ingredients', () => {
  const roti = dishNutrition(DISHES.find((x) => x.id === 'roti')!);
  assert.ok(Math.abs(roti.kcal - 102.3) < 0.1);
  assert.ok(Math.abs(roti.protein - 3.63) < 0.01);
  const n = partsNutrition([{ ingredient: 'paneer', grams: 100 }]);
  assert.equal(n.protein, 18);
});

test('dishes land in plausible calorie ranges per serving', () => {
  for (const dish of DISHES) {
    const { kcal } = dishNutrition(dish);
    assert.ok(kcal >= 30 && kcal <= 600, `${dish.name} = ${kcal.toFixed(0)} kcal`);
  }
});

test('BMR (Mifflin-St Jeor) matches hand calculation', () => {
  assert.equal(bmr(man), 10 * 80 + 6.25 * 175 - 5 * 30 + 5);
  assert.equal(bmr(woman), 10 * 62 + 6.25 * 160 - 5 * 28 - 161);
  assert.ok(Math.abs(tdee(man) - bmr(man) * 1.375) < 1e-9);
});

test('a reasonable weight-loss goal is delivered as asked', () => {
  const r = buildPlan({ profile: man, goal: 'lose', targetWeightKg: 74, weeks: 12, startDate: '2026-01-01' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.plan.adjusted, false);
  assert.ok(Math.abs(r.plan.weeklyChangeKg - -0.5) < 1e-9);
  assert.equal(r.plan.effectiveWeeks, 12);
  assert.equal(r.plan.dailyKcal, Math.round(tdee(man) - 0.5 * 1100));
});

test('an over-aggressive goal is stretched and warned about', () => {
  const r = buildPlan({ profile: man, goal: 'lose', targetWeightKg: 60, weeks: 4, startDate: '2026-01-01' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.plan.adjusted, true);
  assert.ok(r.plan.weeklyChangeKg >= -0.8 - 1e-9, 'capped at 1 % of body weight per week');
  assert.ok(r.plan.effectiveWeeks > 4);
  assert.ok(r.plan.warnings.length > 0);
});

test('calorie floor is enforced', () => {
  const r = buildPlan({ profile: woman, goal: 'lose', targetWeightKg: 50, weeks: 8, startDate: '2026-01-01' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.plan.dailyKcal >= 1200);
});

test('impossible or contradictory goals are rejected', () => {
  assert.equal(buildPlan({ profile: man, goal: 'lose', targetWeightKg: 85, weeks: 8, startDate: 'x' }).ok, false);
  assert.equal(buildPlan({ profile: man, goal: 'gain', targetWeightKg: 70, weeks: 8, startDate: 'x' }).ok, false);
  assert.equal(buildPlan({ profile: man, goal: 'lose', targetWeightKg: 70, weeks: 0, startDate: 'x' }).ok, false);
});

test('maintain goal sets calories to TDEE', () => {
  const r = buildPlan({ profile: man, goal: 'maintain', targetWeightKg: 80, weeks: 4, startDate: 'x' });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.plan.dailyKcal, Math.round(tdee(man)));
});

test('weight glide path reaches target and stops', () => {
  const r = buildPlan({ profile: man, goal: 'lose', targetWeightKg: 74, weeks: 12, startDate: 'x' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(expectedWeight(r.plan, 0), 80);
  assert.ok(Math.abs(expectedWeight(r.plan, 6) - 77) < 1e-9);
  assert.equal(expectedWeight(r.plan, 40), 74);
});

test('steps → km → kcal', () => {
  // 175 cm man: stride 0.72625 m → 10 000 steps = 7.2625 km
  assert.ok(Math.abs(stepsToKm(10_000, man) - 7.2625) < 1e-9);
  assert.ok(Math.abs(stepsToKcal(10_000, man) - 7.2625 * 80 * 0.5) < 1e-9);
  assert.equal(stepsToKcal(0, man), 0);
});

test('meal suggestions get close to calorie and protein targets', () => {
  for (const [kcal, protein] of [[1500, 70], [1800, 80], [2200, 100]]) {
    const day = suggestDay(kcal, protein);
    assert.equal(day.meals.length, 4);
    assert.ok(Math.abs(day.total.kcal - kcal) / kcal < 0.2, `kcal ${day.total.kcal.toFixed(0)} vs ${kcal}`);
  }
  const a = suggestDay(1800, 80, 0).meals.map((m) => m.items.map((i) => i.dishId).join());
  const b = suggestDay(1800, 80, 1).meals.map((m) => m.items.map((i) => i.dishId).join());
  assert.notDeepEqual(a, b);
});

test('date helpers', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.deepEqual(lastNDays(3, '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
});
