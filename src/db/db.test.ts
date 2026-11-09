import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, deleteRecipe, exportAll, importAll, saveRecipe, toggleFavorite, type NewRecipe } from './db';

const sample = (over: Partial<NewRecipe> = {}): NewRecipe => ({
  title: 'もやし炒め',
  servings: 2,
  totalMinutes: 10,
  ingredients: [{ id: 'moyashi', amount: 200, unit: 'g' }],
  steps: ['炒める', '味付けする'],
  lang: 'ja',
  prompt: '安くて早い',
  costYen: 40,
  favorite: false,
  createdAt: 1_700_000_000_000,
  ...over,
});

beforeEach(async () => {
  await db.recipes.clear();
});

describe('recipes db', () => {
  it('saves and reads a recipe', async () => {
    const id = await saveRecipe(sample());
    const r = await db.recipes.get(id);
    expect(r?.title).toBe('もやし炒め');
    expect(r?.ingredients[0].id).toBe('moyashi');
  });

  it('toggles favorite', async () => {
    const id = await saveRecipe(sample());
    expect(await toggleFavorite(id)).toBe(true);
    expect((await db.recipes.get(id))?.favorite).toBe(true);
    expect(await toggleFavorite(id)).toBe(false);
    expect(await toggleFavorite(9999)).toBe(false);
  });

  it('deletes a recipe', async () => {
    const id = await saveRecipe(sample());
    await deleteRecipe(id);
    expect(await db.recipes.count()).toBe(0);
  });

  it('exports and imports, skipping duplicates', async () => {
    await saveRecipe(sample());
    await saveRecipe(sample({ title: 'Egg rice', lang: 'en', createdAt: 1_700_000_000_500, tip: 'tip' }));
    const json = await exportAll();
    expect(JSON.parse(json).recipes).toHaveLength(2);

    // Same data again -> nothing new
    expect(await importAll(json)).toBe(0);

    await db.recipes.clear();
    expect(await importAll(json)).toBe(2);
    const all = await db.recipes.orderBy('createdAt').toArray();
    expect(all.map((r) => r.title)).toEqual(['もやし炒め', 'Egg rice']);
    expect(all[1].tip).toBe('tip');
  });

  it('imports bare arrays and ignores invalid entries', async () => {
    const n = await importAll(JSON.stringify([sample({ createdAt: 1 }), { foo: 1 }, null]));
    expect(n).toBe(1);
  });

  it('rejects invalid backup', async () => {
    await expect(importAll('{"nope":true}')).rejects.toThrow();
    await expect(importAll('not json')).rejects.toThrow();
  });
});
