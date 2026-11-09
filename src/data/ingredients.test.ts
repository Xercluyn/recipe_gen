import { describe, expect, it } from 'vitest';
import type { IngredientCategory } from '../types';
import {
  INGREDIENTS,
  INGREDIENT_IDS,
  INGREDIENT_MAP,
  PANTRY_IDS,
  getIngredientName,
} from './ingredients';

const CATEGORIES: IngredientCategory[] = [
  'vegetable', 'mushroom', 'meat', 'seafood', 'egg_dairy', 'tofu_soy', 'grain_noodle', 'seasoning', 'other',
];

describe('INGREDIENTS', () => {
  it('has a reasonable size', () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(200);
    expect(INGREDIENTS.length).toBeLessThanOrEqual(260);
  });

  it('has unique snake_case ascii ids', () => {
    expect(new Set(INGREDIENT_IDS).size).toBe(INGREDIENTS.length);
    for (const id of INGREDIENT_IDS) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('covers every category', () => {
    const cats = new Set(INGREDIENTS.map((i) => i.category));
    for (const c of CATEGORIES) expect(cats.has(c)).toBe(true);
  });

  it('has positive prices and pack amounts, valid units and names', () => {
    for (const i of INGREDIENTS) {
      expect(i.priceYen, i.id).toBeGreaterThan(0);
      expect(i.packAmount, i.id).toBeGreaterThan(0);
      expect(['g', 'ml', 'piece']).toContain(i.unit);
      expect(i.ja.length, i.id).toBeGreaterThan(0);
      expect(i.en.length, i.id).toBeGreaterThan(0);
    }
  });

  it('includes budget heroes and pantry staples', () => {
    for (const id of ['moyashi', 'tofu_momen', 'natto', 'egg', 'chicken_breast', 'pork_koma', 'cabbage',
      'onion', 'carrot', 'potato', 'atsuage', 'chikuwa', 'tuna_can', 'frozen_udon', 'rice']) {
      expect(INGREDIENT_MAP[id], id).toBeDefined();
    }
    for (const id of ['soy_sauce', 'salt', 'sugar', 'mirin', 'sake', 'miso', 'vinegar', 'salad_oil',
      'sesame_oil', 'dashi_granules', 'chicken_stock', 'pepper', 'mayonnaise', 'ketchup']) {
      expect(PANTRY_IDS, id).toContain(id);
    }
    for (const id of PANTRY_IDS) expect(INGREDIENT_MAP[id].pantry).toBe(true);
  });

  it('getIngredientName returns localized names and falls back to id', () => {
    expect(getIngredientName('moyashi', 'ja')).toBe('もやし');
    expect(getIngredientName('moyashi', 'en')).toBe('Bean sprouts');
    expect(getIngredientName('nope', 'en')).toBe('nope');
  });
});
