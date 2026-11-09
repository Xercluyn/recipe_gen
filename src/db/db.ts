import Dexie, { type EntityTable } from 'dexie';
import type { Lang, ModelKey, SavedRecipe } from '../types';

export const db = new Dexie('recipe-gen') as Dexie & {
  recipes: EntityTable<SavedRecipe, 'id'>;
};

db.version(1).stores({ recipes: '++id, createdAt, favorite, title' });

export type NewRecipe = Omit<SavedRecipe, 'id'>;

export async function saveRecipe(r: NewRecipe): Promise<number> {
  const { id: _ignored, ...rest } = r as SavedRecipe;
  return (await db.recipes.add(rest as SavedRecipe)) as number;
}

export async function deleteRecipe(id: number): Promise<void> {
  await db.recipes.delete(id);
}

export async function toggleFavorite(id: number): Promise<boolean> {
  return db.transaction('rw', db.recipes, async () => {
    const r = await db.recipes.get(id);
    if (!r) return false;
    const favorite = !r.favorite;
    await db.recipes.update(id, { favorite });
    return favorite;
  });
}

const EXPORT_FORMAT = 'recipe-gen-backup';

export async function exportAll(): Promise<string> {
  const recipes = await db.recipes.orderBy('createdAt').toArray();
  return JSON.stringify(
    { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), recipes },
    null,
    2,
  );
}

function isRecipeLike(x: unknown): x is SavedRecipe {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.ingredients) &&
    Array.isArray(r.steps) &&
    typeof r.servings === 'number' &&
    typeof r.totalMinutes === 'number'
  );
}

/** Imports recipes from an exportAll() JSON (or a bare array). Skips duplicates
 *  (same title + createdAt). Returns the number of recipes added. Throws on invalid JSON. */
export async function importAll(json: string): Promise<number> {
  const parsed: unknown = JSON.parse(json);
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { recipes?: unknown }).recipes)
      ? (parsed as { recipes: unknown[] }).recipes
      : (() => {
          throw new Error('Invalid backup file');
        })();

  return db.transaction('rw', db.recipes, async () => {
    const existing = await db.recipes.toArray();
    const keys = new Set(existing.map((r) => `${r.createdAt}|${r.title}`));
    const toAdd: SavedRecipe[] = [];
    for (const item of list) {
      if (!isRecipeLike(item)) continue;
      const r = item as SavedRecipe;
      const createdAt = typeof r.createdAt === 'number' ? r.createdAt : Date.now();
      const key = `${createdAt}|${r.title}`;
      if (keys.has(key)) continue;
      keys.add(key);
      toAdd.push({
        title: r.title,
        servings: r.servings,
        totalMinutes: r.totalMinutes,
        ingredients: r.ingredients,
        steps: r.steps,
        ...(r.tip ? { tip: r.tip } : {}),
        lang: r.lang === 'en' ? 'en' : 'ja',
        prompt: typeof r.prompt === 'string' ? r.prompt : '',
        costYen: typeof r.costYen === 'number' ? r.costYen : 0,
        favorite: !!r.favorite,
        createdAt,
      });
    }
    if (toAdd.length) await db.recipes.bulkAdd(toAdd);
    return toAdd.length;
  });
}

// ---------------- Settings (localStorage) ----------------

export interface AppSettings {
  lang: Lang | null; // null = auto-detect
  modelKey: ModelKey;
  maxMinutes: number;
  servings: number;
}

// iPhone Safari has a tight per-tab memory limit, so default to the light model there.
const IS_IOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

export const DEFAULT_SETTINGS: AppSettings = {
  lang: null,
  modelKey: IS_IOS ? 'light' : 'standard',
  maxMinutes: 15,
  servings: 2,
};

const SETTINGS_KEY = 'recipe-gen:settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<AppSettings>;
    return {
      lang: s.lang === 'ja' || s.lang === 'en' ? s.lang : null,
      modelKey: s.modelKey === 'light' || s.modelKey === 'standard' ? s.modelKey : DEFAULT_SETTINGS.modelKey,
      maxMinutes: typeof s.maxMinutes === 'number' ? s.maxMinutes : DEFAULT_SETTINGS.maxMinutes,
      servings: typeof s.servings === 'number' ? s.servings : DEFAULT_SETTINGS.servings,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode) — keep in memory only */
  }
  return next;
}
