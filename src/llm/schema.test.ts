import { describe, expect, it, vi } from 'vitest';
import type { GenerateRequest, Ingredient } from '../types';

// Fixture data so these tests don't depend on the real ingredient catalogue.
vi.mock('../data/ingredients', () => {
  const INGREDIENTS: Ingredient[] = [
    { id: 'moyashi', ja: 'もやし', en: 'Bean sprouts', category: 'vegetable', priceYen: 30, packAmount: 200, unit: 'g' },
    { id: 'cabbage', ja: 'キャベツ', en: 'Cabbage', category: 'vegetable', priceYen: 150, packAmount: 1000, unit: 'g' },
    { id: 'onion', ja: '玉ねぎ', en: 'Onion', category: 'vegetable', priceYen: 50, packAmount: 1, unit: 'piece' },
    { id: 'chicken_breast', ja: '鶏むね肉', en: 'Chicken breast', category: 'meat', priceYen: 250, packAmount: 300, unit: 'g' },
    { id: 'pork_belly', ja: '豚バラ肉', en: 'Pork belly', category: 'meat', priceYen: 400, packAmount: 200, unit: 'g' },
    { id: 'egg', ja: '卵', en: 'Egg', category: 'egg_dairy', priceYen: 25, packAmount: 1, unit: 'piece' },
    { id: 'tofu', ja: '豆腐', en: 'Tofu', category: 'tofu_soy', priceYen: 60, packAmount: 300, unit: 'g' },
    { id: 'soy_sauce', ja: '醤油', en: 'Soy sauce', category: 'seasoning', priceYen: 200, packAmount: 1000, unit: 'ml', pantry: true },
    { id: 'salt', ja: '塩', en: 'Salt', category: 'seasoning', priceYen: 100, packAmount: 1000, unit: 'g', pantry: true },
  ];
  return {
    INGREDIENTS,
    INGREDIENT_MAP: Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])),
    INGREDIENT_IDS: INGREDIENTS.map((i) => i.id),
    PANTRY_IDS: INGREDIENTS.filter((i) => i.pantry).map((i) => i.id),
    getIngredientName: (id: string) => id,
  };
});

const { buildSchema, selectAllowedIds } = await import('./schema');
const { buildSystemPrompt, buildUserPrompt, formatIngredientList } = await import('./prompts');

const req = (over: Partial<GenerateRequest> = {}): GenerateRequest => ({
  prompt: '',
  lang: 'ja',
  fridge: [],
  maxMinutes: 15,
  servings: 2,
  ...over,
});

describe('buildSchema', () => {
  it('constrains ingredient ids and units', () => {
    const s = buildSchema(['egg', 'tofu', 'egg']);
    const item = s.properties.ingredients.items.properties;
    expect(item.id.enum).toEqual(['egg', 'tofu']);
    expect(item.unit.enum).toEqual(['g', 'ml', 'piece', 'pinch']);
    expect(s.required).toEqual(['title', 'description', 'servings', 'totalMinutes', 'ingredients', 'steps', 'tip']);
    expect(s.properties.servings).toEqual({ type: 'integer' });
    expect(buildSchema(['egg'], 3).properties.servings).toEqual({ type: 'integer', enum: [3] });
    expect(() => JSON.parse(JSON.stringify(s))).not.toThrow();
  });
});

describe('selectAllowedIds', () => {
  it('puts fridge first, then pantry, ignores unknown ids', () => {
    const ids = selectAllowedIds(req({ fridge: ['tofu', 'unknown_x'] }));
    expect(ids[0]).toBe('tofu');
    expect(ids).not.toContain('unknown_x');
    expect(ids).toEqual(expect.arrayContaining(['soy_sauce', 'salt']));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes ingredients mentioned in the prompt', () => {
    const ids = selectAllowedIds(req({ prompt: '豚バラ肉を使いたい' }), undefined, undefined, 3);
    expect(ids).toContain('pork_belly');
  });

  it('respects the cap but never drops fridge or pantry', () => {
    const ids = selectAllowedIds(req({ fridge: ['cabbage', 'egg'] }), undefined, undefined, 5);
    expect(ids).toHaveLength(5);
    expect(ids.slice(0, 2)).toEqual(['cabbage', 'egg']);
    expect(ids).toEqual(expect.arrayContaining(['soy_sauce', 'salt']));
    // Filler is the cheapest remaining item across categories.
    expect(ids[4]).toBe('moyashi');
  });

  it('fills round-robin across categories, cheapest first', () => {
    const ids = selectAllowedIds(req(), undefined, undefined, 6);
    expect(ids.slice(2)).toEqual(['moyashi', 'chicken_breast', 'egg', 'tofu']);
  });
});

describe('prompts', () => {
  it('system prompts exist for both languages', () => {
    expect(buildSystemPrompt('ja')).toContain('JSON');
    expect(buildSystemPrompt('en')).toContain('JSON');
  });

  it('formats ingredient list in sections with id: name lines', () => {
    const text = formatIngredientList(['egg', 'moyashi', 'salt'], ['egg'], 'ja');
    expect(text).toContain('卵');
    expect(text).toMatch(/egg: 卵/);
    expect(text).toMatch(/moyashi: もやし/);
    expect(text.indexOf('egg:')).toBeLessThan(text.indexOf('moyashi:'));
    expect(text.indexOf('moyashi:')).toBeLessThan(text.indexOf('salt:'));
    expect(formatIngredientList(['egg'], [], 'en')).toContain('egg: Egg / 卵 [piece]');
    expect(text).toMatch(/moyashi: もやし \[g\]/);
  });

  it('user prompt includes constraints, budget, errors and /no_think by default', () => {
    const r = req({ prompt: '和風', budgetPerServingYen: 200, fridge: ['egg'] });
    const p = buildUserPrompt(r, ['egg', 'salt'], ['bad id']);
    expect(p).toContain('15分以内');
    expect(p).toContain('2人分');
    expect(p).toContain('200円');
    expect(p).toContain('bad id');
    expect(p.endsWith('/no_think')).toBe(true);

    const e = buildUserPrompt(req({ lang: 'en', maxMinutes: 30 }), ['egg']);
    expect(e).toContain('30 minutes');
    expect(e).not.toContain('previous output');
    expect(e.endsWith('/no_think')).toBe(true);
  });

  it('user prompt omits /no_think when noThink is false', () => {
    const p = buildUserPrompt(req(), ['egg'], undefined, { noThink: false });
    expect(p).not.toContain('/no_think');
    expect(buildUserPrompt(req(), ['egg'], undefined, { noThink: true }).endsWith('/no_think')).toBe(true);
  });
});

describe('extractJson', () => {
  it('strips think blocks and surrounding text', async () => {
    const { extractJson } = await import('./core');
    expect(extractJson('<think>\n\n</think>\n\n{"a":1}')).toBe('{"a":1}');
    expect(extractJson('Here: {"a":{"b":2}} done')).toBe('{"a":{"b":2}}');
  });
});
