import { describe, expect, it } from 'vitest';
import { costPerServing, estimateCost, packFraction } from './cost';
import { INGREDIENT_MAP } from '../data/ingredients';

const moyashi = INGREDIENT_MAP.moyashi; // 40 yen / 200 g
const egg = INGREDIENT_MAP.egg; // piece, 60 g each

describe('estimateCost', () => {
  it('computes proportional cost for same units', () => {
    expect(estimateCost({ ingredients: [{ id: 'moyashi', amount: 200, unit: 'g' }] })).toBe(moyashi.priceYen);
    expect(estimateCost({ ingredients: [{ id: 'moyashi', amount: 100, unit: 'g' }] })).toBe(
      Math.round(moyashi.priceYen / 2),
    );
    expect(estimateCost({ ingredients: [{ id: 'egg', amount: 2, unit: 'piece' }] })).toBe(
      Math.round((egg.priceYen * 2) / egg.packAmount),
    );
  });

  it('sums lines, excludes pantry items, ignores unknown ids', () => {
    const soy = INGREDIENT_MAP.soy_sauce;
    const r = {
      ingredients: [
        { id: 'moyashi', amount: 200, unit: 'g' as const },
        { id: 'soy_sauce', amount: 15, unit: 'ml' as const },
        { id: 'unicorn_meat', amount: 500, unit: 'g' as const },
      ],
    };
    expect(soy.pantry).toBe(true);
    expect(estimateCost(r)).toBe(Math.round(moyashi.priceYen));
  });

  it('returns 0 for empty ingredients', () => {
    expect(estimateCost({ ingredients: [] })).toBe(0);
  });

  it('treats g and ml as 1:1', () => {
    expect(packFraction({ id: 'soy_sauce', amount: 100, unit: 'g' })).toBeCloseTo(100 / 1000);
  });

  it('converts g to pieces using per-piece weight', () => {
    // 120 g of egg = 2 eggs
    expect(packFraction({ id: 'egg', amount: 120, unit: 'g' })).toBeCloseTo(2 / egg.packAmount);
  });

  it('converts pieces to g using per-piece weight, or 0.25 pack fallback', () => {
    // shrimp: 8 g per piece
    const shrimp = INGREDIENT_MAP.shrimp_frozen;
    expect(packFraction({ id: 'shrimp_frozen', amount: 5, unit: 'piece' })).toBeCloseTo(40 / shrimp.packAmount);
    // moyashi has no per-piece weight -> 0.25 pack per piece
    expect(packFraction({ id: 'moyashi', amount: 1, unit: 'piece' })).toBeCloseTo(0.25);
  });

  it('ignores non-positive amounts', () => {
    expect(packFraction({ id: 'moyashi', amount: -10, unit: 'g' })).toBe(0);
  });
});

describe('costPerServing', () => {
  it('divides by servings', () => {
    const r = { servings: 2, ingredients: [{ id: 'moyashi', amount: 400, unit: 'g' as const }] };
    expect(costPerServing(r)).toBe(moyashi.priceYen);
  });

  it('treats invalid servings as 1', () => {
    const r = { servings: 0, ingredients: [{ id: 'moyashi', amount: 200, unit: 'g' as const }] };
    expect(costPerServing(r)).toBe(moyashi.priceYen);
  });
});
