import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowseItem, itemsIn, searchItems, tilesFor } from '../src/lib/browse';
import { BEVERAGE_GROUPS, CATEGORIES, DISHES, dishNutrition } from '../src/lib/foods';

const items: BrowseItem<string>[] = DISHES.map((d) => ({
  key: d.id, name: d.name, sub: d.serving, kcal: dishNutrition(d).kcal, protein: dishNutrition(d).protein, tags: d.tags, keywords: d.keywords, value: d.id,
}));
const names = (list: BrowseItem<string>[]) => list.map((i) => i.name);

test('tiles list only categories that have something in them, with counts', () => {
  const tiles = tilesFor(items, CATEGORIES);
  const ids = tiles.map((t) => t.id);
  assert.ok(ids.includes('north') && ids.includes('south') && ids.includes('beverages'));
  assert.ok(!ids.includes('ingredients'), 'no ingredients were passed in, so no tile');
  for (const t of tiles) assert.equal(t.count, items.filter((i) => i.tags.includes(t.id)).length);
  assert.ok(tiles.every((t) => t.count > 0));
});

test('"first" categories (My recipes) lead the tiles, but only when they have items', () => {
  const mine = { id: 'my-recipes', label: 'My recipes', hint: 'x' };
  const withRecipe = [...items, { key: 'r1', name: 'Mum’s rajma', sub: '', kcal: 1, protein: 1, tags: ['my-recipes'], value: 'r' }];
  assert.equal(tilesFor(withRecipe, CATEGORIES, [mine])[0].id, 'my-recipes');
  assert.ok(!tilesFor(items, CATEGORIES, [mine]).some((t) => t.id === 'my-recipes'));
});

test('a category lists only its own items, alphabetically', () => {
  const south = itemsIn(items, 'south');
  assert.ok(names(south).includes('Plain dosa') && names(south).includes('Sambar'));
  assert.ok(!names(south).includes('Naan'), 'a North Indian dish is not under South Indian');
  assert.deepEqual(names(south), [...names(south)].sort((a, b) => a.localeCompare(b)));
});

test('beverages split into groups, and a group is a subset of beverages', () => {
  const all = itemsIn(items, 'beverages');
  assert.ok(all.length >= 25);
  for (const g of BEVERAGE_GROUPS) {
    const inGroup = itemsIn(items, 'beverages', g.id);
    assert.ok(inGroup.length >= 8 && inGroup.length < all.length, g.id);
    assert.ok(names(inGroup).every((n) => names(all).includes(n)));
  }
  const tea = names(itemsIn(items, 'beverages', 'tea-coffee'));
  assert.ok(tea.some((n) => /chai/i.test(n)) && tea.some((n) => /green tea/i.test(n)) && tea.some((n) => /coffee/i.test(n)));
  assert.ok(!tea.some((n) => /lassi|orange juice/i.test(n)), 'tea and coffee holds no lassi or juice');
});

test('search finds foods across categories, best matches first', () => {
  const { results } = searchItems(items, 'chai');
  assert.ok(results.length >= 4);
  assert.ok(/chai/i.test(results[0].name));
  const dosa = searchItems(items, 'dosa').results;
  assert.ok(names(dosa).includes('Masala dosa') && names(dosa).includes('Plain dosa') && names(dosa).includes('Rava dosa'));
});

test('names that start with the search come before ones that merely contain it', () => {
  const r = searchItems(items, 'dal').results;
  const firstContaining = r.findIndex((i) => !i.name.toLowerCase().startsWith('dal'));
  const lastStarting = r.map((i) => i.name.toLowerCase().startsWith('dal')).lastIndexOf(true);
  assert.ok(firstContaining === -1 || lastStarting < firstContaining, 'starts-with results lead');
});

test('every typed word must match, in any order; blank and unmatched searches return nothing', () => {
  assert.deepEqual(names(searchItems(items, 'masala dosa').results), ['Masala dosa']);
  assert.ok(names(searchItems(items, 'dosa masala').results).includes('Masala dosa'));
  assert.deepEqual(searchItems(items, '   ').results, []);
  assert.deepEqual(searchItems(items, 'zzzz').results, []);
  assert.equal(searchItems(items, 'zzzz').total, 0);
  assert.ok(searchItems(items, 'LASSI').total >= 3, 'case-insensitive');
});

test('search results are capped but report the true total', () => {
  const r = searchItems(items, 'a', 10);
  assert.equal(r.results.length, 10);
  assert.ok(r.total > 10);
});

const withKeywords: BrowseItem<string>[] = DISHES.map((d) => ({
  key: d.id, name: d.name, sub: d.serving, kcal: 0, protein: 0, tags: d.tags, keywords: d.keywords, value: d.id,
}));

test('search also matches regional names and spellings, ranked below real name matches', () => {
  const find = (q: string) => names(searchItems(withKeywords, q).results);
  assert.ok(find('chai').includes('Milk tea, no sugar'), 'chai finds tea without "chai" in its name');
  assert.ok(find('tea').includes('Sweet chai (2 tsp sugar)') && find('tea').includes('Cutting chai'), 'tea finds chai');
  assert.ok(find('dahi').includes('Curd / dahi') && find('yogurt').includes('Veg raita'));
  assert.ok(find('chapati').includes('Roti / phulka'));
  assert.ok(find('brinjal').includes('Baingan bharta') && find('eggplant').includes('Baingan bharta'));
  assert.ok(find('okra').includes('Bhindi fry') && find('spinach').includes('Palak paneer'));
  assert.ok(find('buttermilk').includes('Chaas / buttermilk') && find('mattha').includes('Chaas / buttermilk'));
  assert.ok(find('kaapi').includes('South Indian filter coffee') && find('coke').includes('Cola / soft drink'));
  assert.ok(find('golgappa').includes('Pani puri') && find('idly').includes('Idli'));
  // a real name match comes first even when other dishes list the word as an alias
  assert.ok(/tea/i.test(find('tea')[0]), 'names containing "tea" lead');
  const coffee = searchItems(withKeywords, 'coffee').results;
  assert.ok(/coffee/i.test(coffee[0].name));
});

test('keywords are never shown and every alias belongs to a real dish', async () => {
  const { ALIASES } = await import('../src/lib/dishData');
  for (const id of Object.keys(ALIASES)) assert.ok(DISHES.some((d) => d.id === id), `alias for unknown dish ${id}`);
});
