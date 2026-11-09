import type { GeneratedRecipe, GenerateRequest, RecipeIngredient } from '../types';
import { INGREDIENT_MAP } from '../data/ingredients';

export const TIME_TOLERANCE_MIN = 5;
const UNITS = new Set(['g', 'ml', 'piece', 'pinch']);

export type ValidationResult =
  | { ok: true; recipe: GeneratedRecipe }
  | { ok: false; errors: string[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate an LLM-produced recipe. On success returns a clean copy containing
 * only known fields (strings trimmed).
 */
export function validateRecipe(
  r: unknown,
  req?: Pick<GenerateRequest, 'maxMinutes'>,
): ValidationResult {
  const errors: string[] = [];
  if (!isObj(r)) return { ok: false, errors: ['recipe must be an object'] };

  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title) errors.push('title must be a non-empty string');

  if (!isNum(r.servings) || !Number.isInteger(r.servings) || r.servings < 1 || r.servings > 8) {
    errors.push('servings must be an integer between 1 and 8');
  }

  if (!isNum(r.totalMinutes) || r.totalMinutes <= 0) {
    errors.push('totalMinutes must be a positive number');
  } else if (req && isNum(req.maxMinutes) && r.totalMinutes > req.maxMinutes + TIME_TOLERANCE_MIN) {
    errors.push(`totalMinutes ${r.totalMinutes} exceeds limit of ${req.maxMinutes} minutes`);
  }

  const ingredients: RecipeIngredient[] = [];
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    errors.push('ingredients must be a non-empty array');
  } else {
    r.ingredients.forEach((ri, i) => {
      if (!isObj(ri)) {
        errors.push(`ingredients[${i}] must be an object`);
        return;
      }
      const id = typeof ri.id === 'string' ? ri.id.trim() : '';
      if (!id || !INGREDIENT_MAP[id]) errors.push(`ingredients[${i}]: unknown ingredient id "${String(ri.id)}"`);
      if (!isNum(ri.amount) || ri.amount <= 0) errors.push(`ingredients[${i}]: amount must be > 0`);
      if (typeof ri.unit !== 'string' || !UNITS.has(ri.unit)) {
        errors.push(`ingredients[${i}]: unit must be g, ml, piece or pinch`);
      }
      ingredients.push({ id, amount: ri.amount as number, unit: ri.unit as RecipeIngredient['unit'] });
    });
  }

  let steps: string[] = [];
  if (!Array.isArray(r.steps)) {
    errors.push('steps must be an array');
  } else {
    if (r.steps.some((s) => typeof s !== 'string' || !s.trim())) {
      errors.push('every step must be a non-empty string');
    }
    steps = r.steps.filter((s): s is string => typeof s === 'string').map((s) => s.trim());
    if (r.steps.length < 1 || r.steps.length > 15) errors.push('steps must contain 1 to 15 items');
  }

  if (r.description !== undefined && r.description !== null && typeof r.description !== 'string') {
    errors.push('description must be a string if present');
  }
  if (r.tip !== undefined && r.tip !== null && typeof r.tip !== 'string') {
    errors.push('tip must be a string if present');
  }

  if (errors.length) return { ok: false, errors };

  const recipe: GeneratedRecipe = {
    title,
    servings: r.servings as number,
    totalMinutes: r.totalMinutes as number,
    ingredients,
    steps,
  };
  const description = typeof r.description === 'string' ? r.description.trim() : '';
  if (description) recipe.description = description;
  const tip = typeof r.tip === 'string' ? r.tip.trim() : '';
  if (tip) recipe.tip = tip;
  return { ok: true, recipe };
}

/**
 * Best-effort cleanup used as a fallback: drops ingredients with unknown ids or
 * invalid amounts/units, trims strings, removes empty steps, clamps servings to 1-8.
 */
export function sanitizeRecipe(r: GeneratedRecipe): GeneratedRecipe {
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map((ri) => ({
      id: typeof ri?.id === 'string' ? ri.id.trim() : '',
      amount: ri?.amount,
      unit: ri?.unit,
    }))
    .filter(
      (ri): ri is RecipeIngredient =>
        !!INGREDIENT_MAP[ri.id] && isNum(ri.amount) && ri.amount > 0 && UNITS.has(ri.unit as string),
    );
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);
  const servings = isNum(r.servings) ? Math.min(8, Math.max(1, Math.round(r.servings))) : 2;
  const out: GeneratedRecipe = {
    title: typeof r.title === 'string' ? r.title.trim() : '',
    servings,
    totalMinutes: isNum(r.totalMinutes) && r.totalMinutes > 0 ? r.totalMinutes : 0,
    ingredients,
    steps,
  };
  const description = typeof r.description === 'string' ? r.description.trim() : '';
  if (description) out.description = description;
  const tip = typeof r.tip === 'string' ? r.tip.trim() : '';
  if (tip) out.tip = tip;
  return out;
}
