import type { Category } from './foods';

/** One row in the food browser: a dish, an ingredient or a saved recipe, tagged with the categories it appears under. */
export interface BrowseItem<T = unknown> {
  key: string;
  name: string;
  sub: string;
  kcal: number;
  protein: number;
  tags: string[];
  /** Other names to match when searching, never shown. */
  keywords?: string;
  value: T;
}

export interface Tile {
  id: string;
  label: string;
  hint: string;
  count: number;
}

/** Category tiles that actually have something in them, with their counts. `first` categories lead the list. */
export function tilesFor<T>(items: BrowseItem<T>[], categories: Category[], first: Category[] = []): Tile[] {
  return [...first, ...categories]
    .map((c) => ({ id: c.id, label: c.label, hint: c.hint, count: items.filter((i) => i.tags.includes(c.id)).length }))
    .filter((t) => t.count > 0);
}

const byName = <T,>(a: BrowseItem<T>, b: BrowseItem<T>) => a.name.localeCompare(b.name);

/** Items in a category (optionally narrowed to a group inside it), alphabetically so a long group is easy to scan. */
export function itemsIn<T>(items: BrowseItem<T>[], categoryId: string, groupId?: string | null): BrowseItem<T>[] {
  return items.filter((i) => i.tags.includes(categoryId) && (!groupId || i.tags.includes(groupId))).sort(byName);
}

/**
 * Search across everything. Every word typed must appear in the name or its other names; names that start with the
 * first word come first, then names where a word starts with it, then other name matches.
 */
export function searchItems<T>(items: BrowseItem<T>[], query: string, limit = 60): { results: BrowseItem<T>[]; total: number } {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { results: [], total: 0 };
  const scored = items
    .map((item) => {
      const name = item.name.toLowerCase();
      const haystack = `${name} ${(item.keywords ?? '').toLowerCase()}`;
      if (!words.every((w) => haystack.includes(w))) return null;
      // Name matches rank above matches found only in the other names.
      const rank = name.startsWith(words[0]) ? 0 : name.split(/[^a-z0-9]+/).some((t) => t.startsWith(words[0])) ? 1 : words.every((w) => name.includes(w)) ? 2 : 3;
      return { item, rank };
    })
    .filter((x): x is { item: BrowseItem<T>; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank || byName(a.item, b.item));
  return { results: scored.slice(0, limit).map((x) => x.item), total: scored.length };
}
