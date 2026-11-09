import { describe, expect, it } from 'vitest';
import type { GeneratedRecipe } from '../types';
import { checkRecipe } from './consistency';
import { findMentions, renderSteps, renderStepsText, scaleRecipe, stepRefs } from './recipeText';

const good: GeneratedRecipe = {
  title: '鶏むね肉ともやしの卵炒め',
  description: 'ふわふわ卵の節約炒め。',
  servings: 2,
  totalMinutes: 12,
  ingredients: [
    { id: 'chicken_breast', amount: 250, unit: 'g' },
    { id: 'moyashi', amount: 200, unit: 'g' },
    { id: 'egg', amount: 2, unit: 'piece' },
    { id: 'soy_sauce', amount: 15, unit: 'ml' },
    { id: 'salad_oil', amount: 10, unit: 'ml' },
  ],
  steps: [
    '{chicken_breast}を一口大のそぎ切りにする。',
    '{egg}をボウルに溶きほぐす。',
    'フライパンに{salad_oil}を中火で熱し、{chicken_breast}を3分焼く。',
    '{moyashi}を加え、強火で1分炒める。',
    '{egg}と{soy_sauce}を回し入れ、卵が半熟になったら火を止める。',
  ],
  tip: 'もやしは安い日にまとめ買い。',
};
const ja = { servings: 2, lang: 'ja' as const };

describe('recipeText', () => {
  it('extracts {id} tokens', () => {
    expect(stepRefs('{egg}と{soy_sauce}を入れる')).toEqual(['egg', 'soy_sauce']);
  });

  it('finds plain-name mentions, longest name first', () => {
    expect(findMentions('塩こしょうをふる', 'ja')).toEqual(['salt_pepper']);
    expect(findMentions('{egg}に塩をふる', 'ja')).toEqual(['salt']);
    expect(findMentions('ポン酢をかける', 'ja')).toEqual(['ponzu']);
    expect(findMentions('Season with salt.', 'en')).toEqual(['salt']);
    // short hiragana names must not match inside ordinary words
    expect(findMentions('半熟になったら、たっぷりの湯で味をととのえる', 'ja')).toEqual([]);
  });

  it('renders names and shows the amount on first mention only', () => {
    const parts = renderSteps(good, 'ja');
    expect(parts[0][0]).toMatchObject({ id: 'chicken_breast', name: '鶏むね肉', amount: { amount: 250 } });
    const again = parts[2].find((p) => 'id' in p && p.id === 'chicken_breast');
    expect(again).toMatchObject({ name: '鶏むね肉' });
    expect(again && 'amount' in again ? again.amount : undefined).toBeUndefined();
    const text = renderStepsText(good, 'ja', (ri) => `${ri.amount}${ri.unit}`);
    expect(text[0]).toBe('鶏むね肉（250g）を一口大のそぎ切りにする。');
    expect(renderStepsText(good, 'en', () => 'x')[1]).toBe('Egg (x)をボウルに溶きほぐす。');
  });

  it('scales amounts with sensible rounding; pinch unchanged', () => {
    const r = scaleRecipe(
      { servings: 2, ingredients: [...good.ingredients, { id: 'salt', amount: 1, unit: 'pinch' as const }] },
      3,
    );
    expect(r.servings).toBe(3);
    expect(r.ingredients.find((i) => i.id === 'chicken_breast')!.amount).toBe(375);
    expect(r.ingredients.find((i) => i.id === 'egg')!.amount).toBe(3);
    expect(r.ingredients.find((i) => i.id === 'soy_sauce')!.amount).toBe(23); // 22.5 -> 23
    expect(r.ingredients.find((i) => i.id === 'salt')!.amount).toBe(1);
    expect(scaleRecipe({ servings: 2, ingredients: [{ id: 'egg', amount: 1, unit: 'piece' as const }] }, 1).ingredients[0].amount).toBe(0.5);
  });
});

describe('checkRecipe', () => {
  it('accepts a consistent recipe unchanged', () => {
    const c = checkRecipe(good, ja);
    expect(c.errors).toEqual([]);
    expect(c.recipe.ingredients).toEqual(good.ingredients);
  });

  it('forces the requested servings by rescaling', () => {
    const c = checkRecipe({ ...good, servings: 4 }, ja);
    expect(c.recipe.servings).toBe(2);
    expect(c.recipe.ingredients.find((i) => i.id === 'chicken_breast')!.amount).toBe(125);
  });

  it('adds salt/pepper used in steps as a pinch', () => {
    const steps = [...good.steps];
    steps[0] = '{chicken_breast}を一口大に切り、塩こしょうをふる。';
    const c = checkRecipe({ ...good, steps }, ja);
    expect(c.errors).toEqual([]);
    expect(c.recipe.ingredients).toContainEqual({ id: 'salt_pepper', amount: 1, unit: 'pinch' });
  });

  it('rejects ingredients used in steps but not listed', () => {
    const steps = [...good.steps, '仕上げに{green_onion}を散らす。'];
    const c = checkRecipe({ ...good, steps }, ja);
    expect(c.errors.join()).toMatch(/green_onion.*not in ingredients/);
  });

  it('rejects listed ingredients never used', () => {
    const c = checkRecipe({ ...good, ingredients: [...good.ingredients, { id: 'cabbage', amount: 100, unit: 'g' }] }, ja);
    expect(c.errors.join()).toMatch(/cabbage.*never used/);
  });

  it('rejects vague words like 調味料', () => {
    const steps = [...good.steps];
    steps[4] = '{egg}と{soy_sauce}、調味料を入れて混ぜる。';
    expect(checkRecipe({ ...good, steps }, ja).errors.join()).toMatch(/調味料/);
  });

  it('converts units to the catalogue unit (moyashi piece -> g)', () => {
    const ingredients = good.ingredients.map((i) => (i.id === 'egg' ? { ...i, unit: 'g' as const, amount: 120 } : i));
    const c = checkRecipe({ ...good, ingredients }, ja);
    expect(c.recipe.ingredients.find((i) => i.id === 'egg')).toEqual({ id: 'egg', amount: 2, unit: 'piece' });
  });

  it('rejects unrealistic amounts per serving', () => {
    const ingredients = good.ingredients.map((i) => (i.id === 'soy_sauce' ? { ...i, amount: 300 } : i));
    expect(checkRecipe({ ...good, ingredients }, ja).errors.join()).toMatch(/soy_sauce.*unrealistic/);
  });

  it('requires {id} tokens and a sensible number of short steps', () => {
    const c = checkRecipe({ ...good, steps: ['全部焼く'] }, ja);
    expect(c.errors.join()).toMatch(/\{ingredient_id\}/);
    expect(c.errors.join()).toMatch(/steps \(got 1\)/);
    const long = checkRecipe({ ...good, steps: [...good.steps.slice(0, 4), '{egg}' + 'あ'.repeat(100) + '{soy_sauce}'] }, ja);
    expect(long.errors.join()).toMatch(/too long/);
  });
});
