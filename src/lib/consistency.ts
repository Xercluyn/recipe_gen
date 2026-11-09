// Deterministic quality gate for generated recipes. Runs after validateRecipe().
// - fixes what can be fixed safely (servings, unit conversions, salt/pepper "to taste")
// - reports everything else as errors so the model is asked again with feedback.
import type { GeneratedRecipe, GenerateRequest, Ingredient, RecipeIngredient } from '../types';
import { INGREDIENT_MAP, getGramsPerPiece } from '../data/ingredients';
import { allRefs, canonicalizeTokens, findMentions, findVagueWords, renderSteps, scaleRecipe } from './recipeText';

/** Seasonings that may be added automatically as 少々 / "a pinch" when a step uses them. */
export const PINCHABLE = new Set(['salt', 'pepper', 'salt_pepper', 'ichimi', 'shichimi', 'sesame_seeds']);

export const STEP_COUNT = { min: 3, max: 8 };
export const STEP_MAX_CHARS_JA = 90;
export const STEP_MAX_WORDS_EN = 40;

/** Plausible grams (or ml) per serving, by category, with per-item overrides. */
const PER_SERVING_G: Record<Ingredient['category'], [number, number]> = {
  meat: [30, 300],
  seafood: [20, 300],
  vegetable: [5, 350],
  mushroom: [5, 200],
  egg_dairy: [3, 300],
  tofu_soy: [10, 400],
  grain_noodle: [20, 400],
  seasoning: [0.1, 60],
  other: [0.5, 300],
};
const OVERRIDES_G: Record<string, [number, number]> = {
  tomato_can: [20, 250],
  curry_roux: [10, 60],
  stew_roux: [10, 60],
  // small-amount items in otherwise "bulk" categories
  katakuriko: [0.5, 30],
  flour: [1, 80],
  panko: [2, 50],
  tempura_flour: [5, 80],
  wakame_dried: [0.5, 10],
  hijiki: [1, 15],
  kizami_nori: [0.2, 5],
  katsuobushi: [0.5, 10],
  kombu: [1, 20],
  sakura_ebi: [0.5, 10],
  shirasu: [3, 60],
  butter: [2, 30],
  margarine: [2, 30],
  powdered_cheese: [1, 20],
  beni_shoga: [1, 20],
  agedama: [2, 30],
  fu: [1, 20],
  gelatin: [0.5, 10],
  kinako: [1, 20],
  seaweed_salad: [0.5, 10],
  zha_cai: [3, 60],
  walnuts: [3, 40],
  peanuts: [3, 40],
  raisins: [3, 40],
  kiriboshi_daikon: [3, 30],
};

/**
 * When the request looks like a dish name (short, no descriptive particles), the title must
 * share a meaningful piece with it: a 2-char chunk that isn't plain hiragana (ja), or a 4+ letter
 * word (en). "照り焼きチキン" ✓ "鶏ひき肉の照り焼き", ✗ "麻婆豆腐".
 */
export function titleMatchesDish(prompt: string, title: string, lang: GenerateRequest['lang']): boolean | null {
  const p = prompt.trim();
  if (!p) return null;
  if (lang === 'ja') {
    if (p.length > 12 || /[でをにがはもへ、。,\s]|ため|みたい|ような|簡単|安い|早い|夕飯|ご飯|おかず|弁当/.test(p)) return null;
    const grams = [...p].slice(0, -1).map((c, i) => c + p[i + 1]).filter((g) => !/^[ぁ-ゟ]+$/.test(g));
    if (!grams.length) return null;
    return grams.some((g) => title.includes(g));
  }
  const words = p.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
  if (!words.length || words.length > 4 || /\b(with|using|for|quick|cheap|easy|dinner|lunch|something)\b/.test(p.toLowerCase())) return null;
  return words.some((w) => title.toLowerCase().includes(w));
}

export interface ConsistencyResult {
  recipe: GeneratedRecipe;
  errors: string[];
  /** Human-readable notes about automatic fixes (for logging/tests). */
  fixes: string[];
}

function toGrams(ri: RecipeIngredient): number | undefined {
  if (ri.unit === 'g' || ri.unit === 'ml') return ri.amount;
  if (ri.unit === 'piece') {
    const gpp = getGramsPerPiece(ri.id);
    return gpp !== undefined ? ri.amount * gpp : undefined;
  }
  return undefined; // pinch
}

/** Convert an ingredient line to the catalogue unit when possible. */
function normalizeUnit(ri: RecipeIngredient, errors: string[], fixes: string[]): RecipeIngredient | null {
  const ing = INGREDIENT_MAP[ri.id];
  if (!ing) return ri;
  if (ri.unit === ing.unit) return ri;
  if (ri.unit === 'pinch') {
    if (ing.category === 'seasoning') return ri;
    errors.push(`"${ri.id}": unit "pinch" is only for seasonings; use ${ing.unit}`);
    return ri;
  }
  const isMass = (u: string) => u === 'g' || u === 'ml';
  if (isMass(ri.unit) && isMass(ing.unit)) {
    fixes.push(`${ri.id}: ${ri.unit} -> ${ing.unit}`);
    return { ...ri, unit: ing.unit };
  }
  const gpp = getGramsPerPiece(ri.id);
  if (gpp !== undefined) {
    if (ri.unit === 'piece') {
      fixes.push(`${ri.id}: piece -> ${ing.unit}`);
      return { ...ri, unit: ing.unit, amount: Math.round(ri.amount * gpp) };
    }
    fixes.push(`${ri.id}: ${ri.unit} -> piece`);
    return { ...ri, unit: 'piece', amount: Math.max(0.25, Math.round((ri.amount / gpp) * 4) / 4) };
  }
  errors.push(`"${ri.id}": use unit "${ing.unit}" (not "${ri.unit}")`);
  return null;
}

export function checkRecipe(
  input: GeneratedRecipe,
  req: Pick<GenerateRequest, 'servings' | 'lang'> & { fridge?: string[]; prompt?: string },
): ConsistencyResult {
  const errors: string[] = [];
  const fixes: string[] = [];
  const lang = req.lang;

  // 1. Units -> catalogue units; merge duplicate lines.
  const merged = new Map<string, RecipeIngredient>();
  for (const raw of input.ingredients) {
    const ri = normalizeUnit(raw, errors, fixes);
    if (!ri) continue;
    const prev = merged.get(ri.id);
    if (prev && prev.unit === ri.unit) {
      prev.amount += ri.unit === 'pinch' ? 0 : ri.amount;
      fixes.push(`${ri.id}: merged duplicate`);
    } else if (!prev) {
      merged.set(ri.id, { ...ri });
    }
  }
  let recipe: GeneratedRecipe = { ...input, ingredients: [...merged.values()], steps: input.steps.map(canonicalizeTokens) };

  // 2. Servings must be exactly what the user asked for.
  if (recipe.servings !== req.servings) {
    fixes.push(`servings ${recipe.servings} -> ${req.servings} (amounts rescaled)`);
    recipe = scaleRecipe(recipe, req.servings);
  }

  // 3. Steps: every ingredient used must be listed, every listed ingredient must be used.
  const listed = new Set(recipe.ingredients.map((ri) => ri.id));
  const used = allRefs(recipe.steps);
  const mentioned = new Set(recipe.steps.flatMap((s) => findMentions(s, lang)));
  for (const id of new Set([...used, ...mentioned])) {
    if (listed.has(id)) continue;
    if (!INGREDIENT_MAP[id]) {
      errors.push(`steps reference unknown ingredient "{${id}}"`);
    } else if (PINCHABLE.has(id)) {
      recipe.ingredients.push({ id, amount: 1, unit: 'pinch' });
      listed.add(id);
      fixes.push(`${id}: added as pinch (used in steps)`);
    } else {
      errors.push(`steps use "${id}" but it is not in ingredients — add it with an amount, or remove it from the steps`);
    }
  }
  for (const id of listed) {
    if (!used.has(id) && !mentioned.has(id)) {
      errors.push(`ingredient "${id}" is listed but never used in the steps — use it as {${id}} or remove it`);
    }
  }
  if (used.size === 0) errors.push('steps must reference ingredients as {ingredient_id}');
  if (req.prompt) {
    const match = titleMatchesDish(req.prompt, recipe.title, lang);
    if (match === false) {
      errors.push(`the user asked for "${req.prompt.trim()}" — make exactly that dish and include its name in the title`);
    } else if (match === null && recipe.title.trim() === req.prompt.trim()) {
      errors.push('the title repeats the request — give the dish its real name (e.g. 鶏むね肉のポン酢炒め)');
    }
  }
  const fridge = (req.fridge ?? []).filter((id) => INGREDIENT_MAP[id]);
  if (fridge.length && !fridge.some((id) => listed.has(id))) {
    errors.push(`use the user's fridge items (${fridge.join(', ')}) — none of them are in the recipe`);
  }

  // 4. Step count, length and vagueness.
  if (recipe.steps.length < STEP_COUNT.min || recipe.steps.length > STEP_COUNT.max) {
    errors.push(`write ${STEP_COUNT.min + 1}-${STEP_COUNT.max - 1} steps (got ${recipe.steps.length})`);
  }
  const rendered = renderSteps(recipe, lang).map((parts) => parts.map((p) => ('text' in p ? p.text : p.name)).join(''));
  rendered.forEach((s, i) => {
    if (lang === 'ja' ? s.length > STEP_MAX_CHARS_JA : s.split(/\s+/).length > STEP_MAX_WORDS_EN) {
      errors.push(`step ${i + 1} is too long — one action per step, ${lang === 'ja' ? `max ${STEP_MAX_CHARS_JA} characters` : `max ${STEP_MAX_WORDS_EN} words`}`);
    }
  });
  recipe.steps.forEach((s, i) => {
    const vague = findVagueWords(s, lang);
    if (vague.length) errors.push(`step ${i + 1} says "${vague[0]}" — name each ingredient as {id} instead`);
  });

  // 5. Amounts per serving must be realistic.
  for (const ri of recipe.ingredients) {
    const ing = INGREDIENT_MAP[ri.id];
    const g = toGrams(ri);
    if (!ing || g === undefined) continue;
    const per = g / req.servings;
    const [lo, hi] = OVERRIDES_G[ri.id] ?? PER_SERVING_G[ing.category];
    if (per < lo || per > hi) {
      errors.push(
        `"${ri.id}" amount ${ri.amount}${ri.unit} is unrealistic for ${req.servings} serving(s) (expected about ${Math.round(lo * req.servings * 10) / 10}-${Math.round(hi * req.servings)} ${ri.unit === 'piece' ? 'g total' : ri.unit})`,
      );
    }
  }

  return { recipe, errors, fixes };
}
