import { describe, expect, it } from 'vitest';
import type { GeneratedRecipe } from '../types';
import { sanitizeRecipe, validateRecipe } from './validate';

const good = (): GeneratedRecipe => ({
  title: '  もやしと卵の炒め物 ',
  servings: 2,
  totalMinutes: 10,
  ingredients: [
    { id: 'moyashi', amount: 200, unit: 'g' },
    { id: 'egg', amount: 2, unit: 'piece' },
    { id: 'soy_sauce', amount: 10, unit: 'ml' },
  ],
  steps: ['卵を溶く。', ' もやしを炒める。 ', '合わせて醤油で味付けする。'],
  tip: '強火で手早く。',
});

describe('validateRecipe', () => {
  it('accepts a good recipe and trims strings', () => {
    const res = validateRecipe(good(), { maxMinutes: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recipe.title).toBe('もやしと卵の炒め物');
      expect(res.recipe.steps[1]).toBe('もやしを炒める。');
      expect(res.recipe.tip).toBe('強火で手早く。');
    }
  });

  it('strips unknown fields', () => {
    const res = validateRecipe({
      ...good(),
      extra: 'x',
      ingredients: [{ id: 'moyashi', amount: 100, unit: 'g', note: 'foo' }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect('extra' in res.recipe).toBe(false);
      expect(res.recipe.ingredients[0]).toEqual({ id: 'moyashi', amount: 100, unit: 'g' });
    }
  });

  it('rejects unknown ingredient ids', () => {
    const r = good();
    r.ingredients.push({ id: 'quinoa', amount: 50, unit: 'g' });
    const res = validateRecipe(r);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toContain('quinoa');
  });

  it('rejects over-time recipes but allows +5 min tolerance', () => {
    expect(validateRecipe({ ...good(), totalMinutes: 15 }, { maxMinutes: 10 }).ok).toBe(true);
    expect(validateRecipe({ ...good(), totalMinutes: 16 }, { maxMinutes: 10 }).ok).toBe(false);
    expect(validateRecipe({ ...good(), totalMinutes: 90 }).ok).toBe(true);
  });

  it('rejects bad shapes', () => {
    expect(validateRecipe(null).ok).toBe(false);
    expect(validateRecipe('recipe').ok).toBe(false);
    expect(validateRecipe([]).ok).toBe(false);
    expect(validateRecipe({ ...good(), title: '  ' }).ok).toBe(false);
    expect(validateRecipe({ ...good(), servings: 0 }).ok).toBe(false);
    expect(validateRecipe({ ...good(), servings: 9 }).ok).toBe(false);
    expect(validateRecipe({ ...good(), servings: '2' }).ok).toBe(false);
    expect(validateRecipe({ ...good(), totalMinutes: 0 }).ok).toBe(false);
    expect(validateRecipe({ ...good(), steps: [] }).ok).toBe(false);
    expect(validateRecipe({ ...good(), steps: Array(16).fill('step') }).ok).toBe(false);
    expect(validateRecipe({ ...good(), steps: ['ok', ''] }).ok).toBe(false);
    expect(validateRecipe({ ...good(), ingredients: [] }).ok).toBe(false);
    expect(validateRecipe({ ...good(), ingredients: [{ id: 'egg', amount: 0, unit: 'piece' }] }).ok).toBe(false);
    expect(validateRecipe({ ...good(), ingredients: [{ id: 'egg', amount: 1, unit: 'cup' }] }).ok).toBe(false);
    expect(validateRecipe({ ...good(), tip: 3 }).ok).toBe(false);
  });

  it('collects multiple errors', () => {
    const res = validateRecipe({ title: '', servings: 20, totalMinutes: -1, ingredients: [], steps: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('sanitizeRecipe', () => {
  it('drops unknown ids and trims strings', () => {
    const r = good();
    r.ingredients.push({ id: 'tarragon', amount: 5, unit: 'g' });
    r.steps.push('   ');
    const s = sanitizeRecipe(r);
    expect(s.title).toBe('もやしと卵の炒め物');
    expect(s.ingredients.map((i) => i.id)).toEqual(['moyashi', 'egg', 'soy_sauce']);
    expect(s.steps).toHaveLength(3);
    expect(s.steps[1]).toBe('もやしを炒める。');
  });

  it('clamps servings', () => {
    expect(sanitizeRecipe({ ...good(), servings: 12 }).servings).toBe(8);
  });
});
