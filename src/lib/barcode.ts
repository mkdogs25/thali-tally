import type { Nutrition } from './foods';

export interface PackagedProduct {
  barcode: string;
  name: string;
  /** Nutrition per 100 g (or 100 ml). */
  per100: Nutrition;
  /** Declared serving size in grams, if the label has one. */
  servingGrams: number | null;
  /** 'veg' | 'non-veg' | 'unknown', from Open Food Facts' ingredient analysis. */
  diet: 'veg' | 'non-veg' | 'unknown';
}

export type LookupResult =
  | { ok: true; product: PackagedProduct }
  | { ok: false; reason: 'not-found' | 'no-nutrition' | 'network' };

interface OffResponse {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    serving_quantity?: number | string;
    ingredients_analysis_tags?: string[];
    nutriments?: Record<string, number | string | undefined>;
  };
}

const num = (v: number | string | undefined): number | null => {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Looks a barcode up on Open Food Facts (needs internet; the community database is strong on packaged Indian products). */
export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  let json: OffResponse;
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,serving_quantity,ingredients_analysis_tags`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ThaliTally/1.0 (personal nutrition tracker)' } });
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (!res.ok) return { ok: false, reason: 'network' };
    json = (await res.json()) as OffResponse;
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (json.status !== 1 || !json.product) return { ok: false, reason: 'not-found' };

  const n = json.product.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  if (kcal === null || protein === null) return { ok: false, reason: 'no-nutrition' };

  const tags = json.product.ingredients_analysis_tags ?? [];
  const diet = tags.includes('en:non-vegetarian') ? 'non-veg' : tags.includes('en:vegetarian') ? 'veg' : 'unknown';
  const name = [json.product.brands, json.product.product_name].filter(Boolean).join(' – ') || `Product ${barcode}`;
  return {
    ok: true,
    product: {
      barcode,
      name,
      per100: { kcal, protein, carbs: num(n['carbohydrates_100g']) ?? 0, fat: num(n['fat_100g']) ?? 0 },
      servingGrams: num(json.product.serving_quantity),
      diet,
    },
  };
}
