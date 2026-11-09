// Helpers for recipe step text.
// Steps reference ingredients as `{ingredient_id}` tokens; the app renders the
// catalogue name (and amount) so step text can never disagree with the
// ingredient list, in either language, at any serving size.
import type { GeneratedRecipe, Lang, RecipeIngredient } from '../types';
import { INGREDIENTS, INGREDIENT_MAP, getIngredientName } from '../data/ingredients';

/**
 * Ingredient token. Tolerates what models actually emit: `{id}`, `{ id }`, `{Green_Onion}`,
 * `{green-onion}`, full-width `｛id｝`. Use `tokenId()` to get the canonical id.
 */
export const TOKEN_RE = /[{｛]\s*([A-Za-z][A-Za-z0-9_\- ]{0,40}?)\s*[}｝]/g;

/** Canonical id for a raw token body: lower case, spaces/hyphens -> underscores. */
export function tokenId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** "chicken_minced" -> "chicken minced" (last resort for ids not in the catalogue). */
export function humanizeId(id: string): string {
  return id.replace(/_/g, ' ').trim();
}

/** Ingredient ids referenced as {id} tokens in one step. */
export function stepRefs(step: string): string[] {
  return [...step.matchAll(TOKEN_RE)].map((m) => tokenId(m[1]));
}

/** Rewrite every token in canonical `{id}` form. */
export function canonicalizeTokens(step: string): string {
  return step.replace(TOKEN_RE, (_m, raw: string) => `{${tokenId(raw)}}`);
}

/** Ingredient ids referenced anywhere in the steps. */
export function allRefs(steps: string[]): Set<string> {
  return new Set(steps.flatMap(stepRefs));
}

// ---- Plain-word mentions (ingredient names written without a token) ----

/** Extra spellings the model commonly uses for catalogue items. */
const ALIASES: [string, string][] = [
  ['しょうゆ', 'soy_sauce'],
  ['しょう油', 'soy_sauce'],
  ['塩コショウ', 'salt_pepper'],
  ['塩胡椒', 'salt_pepper'],
  ['コショウ', 'pepper'],
  ['胡椒', 'pepper'],
  ['酒', 'sake'],
  ['ごま', 'sesame_seeds'],
];

let jaNames: [string, string][] | null = null;
function jaNameIndex(): [string, string][] {
  if (!jaNames) {
    // Longest first so 塩こしょう / 塩麹 win over 塩, ポン酢 over 酢.
    jaNames = [...INGREDIENTS.map((i) => [i.ja.replace(/（.*?）|\(.*?\)/g, ''), i.id] as [string, string]), ...ALIASES]
      // Skip 1-2 letter all-hiragana names (たら, ぶり, あじ, なす...): they occur inside
      // ordinary words (なったら, たっぷり, 味=あじ). Models reference those via {id} anyway.
      .filter(([n]) => n.length > 0 && !(n.length <= 2 && /^[ぁ-ゟ]+$/.test(n)))
      .sort((a, b) => b[0].length - a[0].length);
  }
  return jaNames;
}

let enNames: [RegExp, string][] | null = null;
function enNameIndex(): [RegExp, string][] {
  if (!enNames) {
    const rows: [string, string][] = INGREDIENTS.map((i) => [i.en.replace(/\s*\(.*?\)/g, '').toLowerCase(), i.id]);
    rows.push(['eggs', 'egg'], ['black pepper', 'pepper']);
    enNames = rows
      .sort((a, b) => b[0].length - a[0].length)
      .map(([n, id]) => [new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), id]);
  }
  return enNames;
}

/**
 * Catalogue ingredients mentioned by plain name (outside {id} tokens) in a step.
 * Longest names are matched first and blanked out, so "塩こしょう" does not also count as "塩".
 */
export function findMentions(step: string, lang: Lang): string[] {
  let text = step.replace(TOKEN_RE, ' ');
  const found = new Set<string>();
  if (lang === 'ja') {
    for (const [name, id] of jaNameIndex()) {
      if (text.includes(name)) {
        found.add(id);
        text = text.split(name).join('　');
      }
    }
  } else {
    for (const [re, id] of enNameIndex()) {
      re.lastIndex = 0;
      if (re.test(text)) {
        found.add(id);
        text = text.replace(re, ' ');
      }
    }
  }
  return [...found];
}

/** Words that hide which ingredient is meant (e.g. "add the seasonings"). */
export const VAGUE_WORDS: Record<Lang, string[]> = {
  ja: ['調味料', '具材', '材料を', 'タレを', 'たれを', 'ソースを'],
  en: ['seasonings', 'the sauce ingredients', 'all ingredients', 'the ingredients'],
};

export function findVagueWords(step: string, lang: Lang): string[] {
  const text = step.replace(TOKEN_RE, ' ');
  const lower = text.toLowerCase();
  return VAGUE_WORDS[lang].filter((w) => lower.includes(w.toLowerCase()));
}

// ---- Scaling ----

function roundAmount(ri: RecipeIngredient): number {
  const a = ri.amount;
  if (ri.unit === 'pinch') return a;
  if (ri.unit === 'piece') return Math.max(0.25, Math.round(a * 4) / 4); // quarter pieces
  if (a < 10) return Math.max(0.5, Math.round(a * 2) / 2); // 0.5 g/ml steps for small amounts
  if (a < 100) return Math.round(a);
  return Math.round(a / 5) * 5;
}

/** Recipe with amounts scaled from recipe.servings to `servings`. */
export function scaleRecipe<T extends Pick<GeneratedRecipe, 'servings' | 'ingredients'>>(recipe: T, servings: number): T {
  const from = recipe.servings > 0 ? recipe.servings : 1;
  if (servings === from) return recipe;
  const f = servings / from;
  return {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((ri) => {
      if (ri.unit === 'pinch') return ri;
      const scaled = { ...ri, amount: ri.amount * f };
      return { ...scaled, amount: roundAmount(scaled) };
    }),
  };
}

// ---- Rendering ----

export type StepPart = { text: string } | { id: string; name: string; amount?: RecipeIngredient };

/**
 * Split a step into text and ingredient parts. The first mention of each ingredient
 * in the whole recipe carries its amount so the cook sees "醤油（大さじ1）".
 */
export function renderSteps(recipe: Pick<GeneratedRecipe, 'steps' | 'ingredients'>, lang: Lang): StepPart[][] {
  const byId = new Map(recipe.ingredients.map((ri) => [ri.id, ri]));
  const shown = new Set<string>();
  return recipe.steps.map((step) => {
    const parts: StepPart[] = [];
    let last = 0;
    for (const m of step.matchAll(TOKEN_RE)) {
      const id = tokenId(m[1]);
      if (m.index! > last) parts.push({ text: step.slice(last, m.index) });
      const ri = byId.get(id);
      const name = INGREDIENT_MAP[id] ? getIngredientName(id, lang) : humanizeId(id);
      if (ri && !shown.has(id)) {
        shown.add(id);
        parts.push({ id, name, amount: ri });
      } else {
        parts.push({ id, name });
      }
      last = m.index! + m[0].length;
    }
    if (last < step.length) parts.push({ text: step.slice(last) });
    return parts;
  });
}

/** Plain-text steps (for sharing/copying). */
export function renderStepsText(
  recipe: Pick<GeneratedRecipe, 'steps' | 'ingredients'>,
  lang: Lang,
  formatAmount: (ri: RecipeIngredient) => string,
): string[] {
  const [open, close] = lang === 'ja' ? ['（', '）'] : [' (', ')'];
  return renderSteps(recipe, lang).map((parts) =>
    parts.map((p) => ('text' in p ? p.text : p.amount ? `${p.name}${open}${formatAmount(p.amount)}${close}` : p.name)).join(''),
  );
}

/** Steps with tokens replaced by plain ingredient names (no amounts). For clients that can't render tokens. */
export function stepsWithNames(steps: string[], lang: Lang): string[] {
  return steps.map((step) =>
    step.replace(TOKEN_RE, (_m, raw: string) => {
      const id = tokenId(raw);
      return INGREDIENT_MAP[id] ? getIngredientName(id, lang) : humanizeId(id);
    }),
  );
}
