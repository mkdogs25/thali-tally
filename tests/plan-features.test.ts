import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SavedRecipe } from '../src/lib/db';
import { addFavourite, defaultMeals, Favourite, removeFavourite, resolveAll, resolveFavourite, toggleMeal } from '../src/lib/favourites';
import { DISH_BY_ID, dishNutrition } from '../src/lib/foods';
import { suggestDay } from '../src/lib/suggest';
import { ACTIVITY_LABEL, ActivityPref, buildWorkoutPlan, clampPrefs, DAY_NAMES, interleave, MET, sessionFor, sessionKcal, WorkoutPrefs, weekdayIndex } from '../src/lib/workout';

const recipe: SavedRecipe = {
  id: 1, uid: 'abc123', name: 'Mum’s rajma', servings: 4,
  parts: [{ ingredient: 'rajma', grams: 160 }, { ingredient: 'onion', grams: 120 }, { ingredient: 'oil', grams: 20 }],
};

// --- regular foods --------------------------------------------------------------------

test('favourites resolve from built-in dishes and saved recipes, and drop ones that no longer exist', () => {
  const dish = resolveFavourite({ id: 'dish:poha', meals: ['breakfast'] }, [])!;
  assert.equal(dish.unit.name, 'Poha');
  assert.ok(Math.abs(dish.unit.nutrition.kcal - dishNutrition(DISH_BY_ID.poha).kcal) < 1e-9);

  const mine = resolveFavourite({ id: 'recipe:abc123', meals: ['dinner'] }, [recipe])!;
  assert.equal(mine.unit.name, 'Mum’s rajma');
  // 160 g rajma + 120 g onion + 20 g oil over 4 servings
  const total = (160 * 346 + 120 * 50 + 20 * 900) / 100;
  assert.ok(Math.abs(mine.unit.nutrition.kcal - total / 4) < 1e-6);

  assert.equal(resolveFavourite({ id: 'recipe:gone', meals: ['dinner'] }, [recipe]), null, 'deleted recipe');
  assert.equal(resolveFavourite({ id: 'dish:nope', meals: ['lunch'] }, []), null, 'unknown dish');
  assert.equal(resolveFavourite({ id: 'dish:poha', meals: [] }, []), null, 'no meals chosen');
  assert.equal(resolveAll([{ id: 'dish:poha', meals: ['breakfast'] }, { id: 'recipe:gone', meals: ['lunch'] }], []).length, 1);
});

test('adding, toggling and removing favourites', () => {
  let favs: Favourite[] = [];
  favs = addFavourite(favs, 'dish:poha');
  favs = addFavourite(favs, 'dish:poha');
  assert.equal(favs.length, 1, 'no duplicates');
  assert.deepEqual(favs[0].meals, ['breakfast'], 'breakfast food defaults to breakfast');
  assert.deepEqual(defaultMeals('dish:roasted_chana'), ['snack']);
  assert.deepEqual(defaultMeals('dish:rajma'), ['lunch', 'dinner']);
  assert.deepEqual(defaultMeals('recipe:abc'), ['lunch', 'dinner']);
  favs = toggleMeal(favs, 'dish:poha', 'snack');
  assert.deepEqual(favs[0].meals, ['breakfast', 'snack']);
  favs = toggleMeal(favs, 'dish:poha', 'breakfast');
  assert.deepEqual(favs[0].meals, ['snack']);
  assert.deepEqual(removeFavourite(favs, 'dish:poha'), []);
});

test('meals with regular foods are built from them; meals without keep the general menu', () => {
  const regulars = resolveAll([{ id: 'dish:upma', meals: ['breakfast'] }, { id: 'recipe:abc123', meals: ['dinner'] }], [recipe]);
  const day = suggestDay(1800, 80, 0, regulars);
  const by = Object.fromEntries(day.meals.map((m) => [m.meal, m]));

  assert.ok(by.breakfast.fromRegulars);
  assert.ok(by.breakfast.items.some((i) => i.id === 'dish:upma' && i.regular), 'breakfast includes the regular food');
  assert.ok(by.dinner.fromRegulars);
  assert.ok(by.dinner.items.some((i) => i.id === 'recipe:abc123' && i.regular), 'dinner includes the saved recipe');
  assert.equal(by.lunch.fromRegulars, false, 'no regulars for lunch: general menu');
  assert.ok(by.lunch.items.every((i) => !i.regular));
  assert.ok(Math.abs(day.total.kcal - 1800) / 1800 < 0.3, `total ${day.total.kcal.toFixed(0)}`);
});

test('a regular food is never listed twice in one meal, and shuffling changes the sides', () => {
  const regulars = resolveAll([{ id: 'dish:curd', meals: ['lunch'] }], []);
  for (let v = 0; v < 3; v++) {
    const lunch = suggestDay(1800, 80, v, regulars).meals.find((m) => m.meal === 'lunch')!;
    const ids = lunch.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `variant ${v}: ${ids.join()}`);
  }
  const seen = new Set([0, 1, 2].map((v) => suggestDay(1800, 80, v, regulars).meals.find((m) => m.meal === 'lunch')!.items.map((i) => i.id).join()));
  assert.ok(seen.size > 1, 'shuffle gives different lunches');
});

test('with no regular foods the suggestions are unchanged from the general menu', () => {
  const day = suggestDay(1800, 80, 0, []);
  assert.ok(day.meals.every((m) => !m.fromRegulars && m.items.every((i) => !i.regular)));
});

// --- workout plans ---------------------------------------------------------------------

const base: WorkoutPrefs = { days: 3, minutes: 45, equipment: 'none', experience: 'beginner', activities: ['strength', 'walk'], lowImpact: false };
const plan = (over: Partial<WorkoutPrefs> = {}, goal: 'lose' | 'maintain' | 'gain' = 'lose', weightKg = 70) =>
  buildWorkoutPlan({ prefs: { ...base, ...over }, goal, weightKg, now: 1 });

test('a plan is always seven days, with exactly the requested number of training days', () => {
  for (let days = 2; days <= 6; days++) {
    for (const activities of [['strength'], ['walk'], ['strength', 'walk', 'yoga'], ['run', 'cycle', 'swim', 'hiit', 'yoga']] as ActivityPref[][]) {
      const p = plan({ days, activities });
      assert.equal(p.sessions.length, 7);
      assert.deepEqual(p.sessions.map((s) => s.day), [0, 1, 2, 3, 4, 5, 6]);
      assert.equal(p.sessions.filter((s) => s.kind !== 'rest').length, days, `${days} days, ${activities.join('+')}`);
    }
  }
});

test('only the activities the person picked appear', () => {
  const kinds = (p: ReturnType<typeof plan>) => new Set(p.sessions.filter((s) => s.kind !== 'rest').map((s) => s.kind));
  assert.deepEqual(kinds(plan({ days: 4, activities: ['yoga', 'walk'] })), new Set(['yoga', 'walk']));
  assert.deepEqual(kinds(plan({ days: 3, activities: ['strength'] })), new Set(['strength']));
  assert.deepEqual(kinds(plan({ days: 5, activities: ['strength', 'cycle', 'swim'] })), new Set(['strength', 'cycle', 'swim']));
  // nothing chosen falls back to strength + walking rather than an empty plan
  assert.deepEqual(clampPrefs({ ...base, activities: [] }).activities, ['strength', 'walk']);
});

test('strength days are not stacked back to back when other sessions are available', () => {
  const p = plan({ days: 4, activities: ['strength', 'walk'] });
  const kinds = p.sessions.map((s) => s.kind);
  for (let i = 0; i < 6; i++) assert.ok(!(kinds[i] === 'strength' && kinds[i + 1] === 'strength' && p.sessions.filter((s) => s.kind === 'strength').length === 2), 'two strength days adjacent');
  assert.deepEqual(interleave(3, 1), ['S', 'O', 'S', 'S']);
  assert.deepEqual(interleave(2, 2), ['S', 'O', 'S', 'O']);
  assert.deepEqual(interleave(0, 3), ['O', 'O', 'O']);
});

test('exercises match the equipment, experience and time available', () => {
  const names = (p: ReturnType<typeof plan>) => p.sessions.flatMap((s) => s.exercises.map((e) => e.name));
  assert.ok(names(plan({ equipment: 'none' })).includes('Bodyweight squat'));
  assert.ok(!names(plan({ equipment: 'none' })).some((n) => /barbell|dumbbell|machine|press$/i.test(n) && !/Pike|push-up/i.test(n)), 'no kit needed');
  assert.ok(names(plan({ equipment: 'light' })).includes('Goblet squat'));
  assert.ok(names(plan({ equipment: 'gym', experience: 'intermediate' })).includes('Barbell back squat'));
  assert.ok(names(plan({ equipment: 'gym', experience: 'beginner' })).includes('Leg press'));

  const strength = (p: ReturnType<typeof plan>) => p.sessions.find((s) => s.kind === 'strength')!;
  assert.equal(strength(plan({ minutes: 20 })).exercises.length, 3);
  assert.equal(strength(plan({ minutes: 60 })).exercises.length, 6);
  assert.equal(strength(plan({ experience: 'beginner', minutes: 45 })).exercises[0].sets, 3);
  assert.equal(strength(plan({ experience: 'intermediate', minutes: 45 })).exercises[0].sets, 4);
  assert.equal(strength(plan({ experience: 'beginner' })).exercises[0].reps, '10-12');
});

test('low-impact plans never include running or jumping', () => {
  const p = plan({ days: 5, activities: ['run', 'hiit', 'walk'], lowImpact: true });
  assert.ok(!p.sessions.some((s) => s.kind === 'run'), 'running swapped for walking');
  const text = JSON.stringify(p.sessions).toLowerCase();
  for (const bad of ['jumping jack', 'burpee', 'high knees', 'skater', 'squat jump', 'jog']) assert.ok(!text.includes(bad), bad);
  assert.ok(p.tips.some((t) => /impact is kept low/i.test(t)));
  // and without the flag, running is allowed
  assert.ok(plan({ days: 3, activities: ['run'] }).sessions.some((s) => s.kind === 'run'));
});

test('calorie estimates are (MET - 1) x kg x hours and scale with body weight and time', () => {
  assert.equal(sessionKcal('walk', 60, 70), Math.round((MET.walk - 1) * 70));
  assert.equal(sessionKcal('rest', 60, 70), 0);
  assert.ok(sessionKcal('run', 30, 80) > sessionKcal('run', 30, 60));
  assert.ok(sessionKcal('walk', 60, 70) > sessionKcal('walk', 30, 70));
  const p = plan({ days: 3 }, 'lose', 70);
  assert.equal(p.weeklyKcal, p.sessions.reduce((s, x) => s + x.kcal, 0));
  assert.equal(p.weeklyMinutes, p.sessions.reduce((s, x) => s + x.minutes, 0));
  assert.ok(p.sessions.filter((s) => s.kind === 'rest').every((s) => s.kcal === 0 && s.minutes === 0));
});

test('walking sessions carry a step target, and goals shape the advice', () => {
  const walk = plan({ activities: ['walk'], minutes: 30 }).sessions.find((s) => s.kind === 'walk')!;
  assert.equal(walk.steps, 30 * 110);
  assert.ok(plan({}, 'lose').tips.some((t) => /keep muscle/i.test(t)));
  assert.ok(plan({}, 'gain').tips.some((t) => /enough food/i.test(t)));
  assert.ok(plan({}, 'maintain').tips.some((t) => /consistency/i.test(t)));
  assert.ok(plan().tips.some((t) => /not medical advice/i.test(t)), 'always carries the safety note');
  // gaining with strength preferred trains strength more often than losing
  const count = (g: 'lose' | 'gain') => plan({ days: 4, activities: ['strength', 'walk'] }, g).sessions.filter((s) => s.kind === 'strength').length;
  assert.ok(count('gain') >= count('lose'));
});

test('today’s session is picked by weekday (Monday first)', () => {
  const p = plan({ days: 3 });
  assert.equal(weekdayIndex(new Date(2026, 9, 19)), 0, 'Monday 19 Oct 2026');
  assert.equal(weekdayIndex(new Date(2026, 9, 25)), 6, 'Sunday');
  assert.equal(sessionFor(p, new Date(2026, 9, 19)), p.sessions[0]);
  assert.equal(sessionFor(p, new Date(2026, 9, 21)), p.sessions[2]);
  assert.equal(DAY_NAMES.length, 7);
  for (const k of Object.keys(ACTIVITY_LABEL)) assert.ok(k in MET);
});
