// Pure helpers (no engine import) so they can be unit-tested in node.
import type { GenerateRequest, Ingredient } from '../types';
import { INGREDIENTS, INGREDIENT_MAP, PANTRY_IDS } from '../data/ingredients';

export const MAX_ALLOWED_IDS = 80;

/** JSON schema for the LLM output; ingredient ids constrained to `allowedIds`. */
export function buildSchema(allowedIds: string[]) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      servings: { type: 'integer' },
      totalMinutes: { type: 'integer' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: [...new Set(allowedIds)] },
            amount: { type: 'number' },
            unit: { type: 'string', enum: ['g', 'ml', 'piece'] },
          },
          required: ['id', 'amount', 'unit'],
          additionalProperties: false,
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      tip: { type: 'string' },
    },
    required: ['title', 'servings', 'totalMinutes', 'ingredients', 'steps'],
    additionalProperties: false,
  };
}

/** Ingredients named in the free-text prompt (by ja/en name or id). */
function mentionedIds(prompt: string, ingredients: Ingredient[]): string[] {
  const p = prompt.toLowerCase();
  if (!p.trim()) return [];
  return ingredients
    .filter((i) => p.includes(i.ja) || (i.en && p.includes(i.en.toLowerCase())) || p.includes(i.id))
    .map((i) => i.id);
}

/**
 * Allowed ids for one request, in priority order:
 * fridge items -> ids mentioned in the prompt -> pantry staples -> cheap common items
 * (round-robin across categories, cheapest first) until MAX_ALLOWED_IDS.
 * Fridge/pantry are never dropped, even if they exceed the cap.
 */
export function selectAllowedIds(
  req: Pick<GenerateRequest, 'fridge' | 'prompt'>,
  ingredients: Ingredient[] = INGREDIENTS,
  pantryIds: string[] = PANTRY_IDS,
  max: number = MAX_ALLOWED_IDS,
): string[] {
  const map: Record<string, Ingredient> =
    ingredients === INGREDIENTS ? INGREDIENT_MAP : Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const out = new Set<string>();
  for (const id of req.fridge ?? []) if (map[id]) out.add(id);
  for (const id of mentionedIds(req.prompt ?? '', ingredients)) out.add(id);
  for (const id of pantryIds) if (map[id]) out.add(id);

  // Cheap fillers, grouped by category, each group sorted by price.
  const byCat = new Map<string, Ingredient[]>();
  for (const ing of ingredients) {
    if (ing.pantry || out.has(ing.id)) continue;
    const list = byCat.get(ing.category) ?? [];
    list.push(ing);
    byCat.set(ing.category, list);
  }
  const queues = [...byCat.values()].map((l) => l.sort((a, b) => a.priceYen - b.priceYen));
  let added = true;
  while (out.size < max && added) {
    added = false;
    for (const q of queues) {
      if (out.size >= max) break;
      const next = q.shift();
      if (next) {
        out.add(next.id);
        added = true;
      }
    }
  }
  return [...out];
}
