import type { GeneratedRecipe, RecipeIngredient } from '../types';
import { INGREDIENT_MAP, getGramsPerPiece } from '../data/ingredients';

/** Fallback when a recipe uses pieces for an item sold by weight and no per-piece weight is known. */
const DEFAULT_PACK_FRACTION_PER_PIECE = 0.25;
/** Fallback weight (g) of one piece when a recipe uses g/ml for an item sold by the piece. */
const DEFAULT_GRAMS_PER_PIECE = 100;

/**
 * Fraction of one pack used by a recipe line. Unit rules:
 * - same unit: amount / packAmount
 * - g <-> ml: treated as 1:1
 * - recipe 'piece', pack in g/ml: amount * gramsPerPiece / packAmount
 *   (falls back to 0.25 pack per piece if the per-piece weight is unknown)
 * - recipe g/ml, pack in 'piece': (amount / gramsPerPiece) / packAmount
 *   (gramsPerPiece defaults to 100 g)
 * Returns 0 for unknown ids or non-positive/invalid amounts.
 */
export function packFraction(ri: RecipeIngredient): number {
  const ing = INGREDIENT_MAP[ri.id];
  if (ri.unit === 'pinch') return 0; // 少々 / to taste
  if (!ing || !Number.isFinite(ri.amount) || ri.amount <= 0 || ing.packAmount <= 0) return 0;
  const recipePiece = ri.unit === 'piece';
  const packPiece = ing.unit === 'piece';
  if (recipePiece === packPiece) return ri.amount / ing.packAmount;
  const gpp = getGramsPerPiece(ri.id);
  if (recipePiece) {
    return gpp !== undefined
      ? (ri.amount * gpp) / ing.packAmount
      : ri.amount * DEFAULT_PACK_FRACTION_PER_PIECE;
  }
  return ri.amount / (gpp ?? DEFAULT_GRAMS_PER_PIECE) / ing.packAmount;
}

function rawCost(r: Pick<GeneratedRecipe, 'ingredients'>): number {
  let total = 0;
  for (const ri of r.ingredients ?? []) {
    const ing = INGREDIENT_MAP[ri.id];
    if (!ing || ing.pantry) continue; // pantry staples are already at home
    total += ing.priceYen * packFraction(ri);
  }
  return total;
}

/** Estimated total cost in yen (proportional to amount used, pantry staples excluded — the user already has them). */
export function estimateCost(r: Pick<GeneratedRecipe, 'ingredients'>): number {
  return Math.round(rawCost(r));
}

/** Estimated cost per serving in yen (servings < 1 treated as 1). */
export function costPerServing(r: Pick<GeneratedRecipe, 'ingredients' | 'servings'>): number {
  const s = Number.isFinite(r.servings) && r.servings >= 1 ? r.servings : 1;
  return Math.round(rawCost(r) / s);
}
