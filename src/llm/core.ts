// Model-agnostic recipe generation loop. Pure: the caller supplies `complete`,
// which sends chat messages to some LLM and returns its raw text.
// Used by the Cloudflare Worker (api/) — keep free of browser/Worker-only APIs.
import type { GeneratedRecipe, GenerateRequest } from '../types';
import { sanitizeRecipe, validateRecipe } from '../lib/validate';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { buildSchema, selectAllowedIds } from './schema';
import { INGREDIENTS, PANTRY_IDS } from '../data/ingredients';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteArgs {
  messages: ChatMessage[];
  /** JSON schema the output must follow (ingredient ids restricted to the allowed list). */
  schema: object;
}

export type Complete = (args: CompleteArgs) => Promise<string>;

export interface CoreOptions {
  /** Max ingredient ids offered to the model (fridge + pantry are always kept). */
  maxIds?: number;
  /** Append Qwen3 "/no_think" to the user prompt. */
  noThink?: boolean;
  /** Model has no system role — prepend system prompt to the user turn. */
  mergeSystem?: boolean;
  /** Total attempts (first try + retries with error feedback). */
  attempts?: number;
}

export class RecipeGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeGenerationError';
  }
}

/** Remove <think> blocks and anything outside the outermost JSON object. */
export function extractJson(text: string): string {
  let t = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t.trim();
}

export function buildMessages(
  req: GenerateRequest,
  allowedIds: string[],
  prevErrors: string[] | undefined,
  opts: CoreOptions,
): ChatMessage[] {
  const system = buildSystemPrompt(req.lang);
  const user = buildUserPrompt(req, allowedIds, prevErrors, { noThink: opts.noThink ?? false });
  return opts.mergeSystem
    ? [{ role: 'user', content: `${system}\n\n${user}` }]
    : [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];
}

export async function generateWith(
  complete: Complete,
  req: GenerateRequest,
  opts: CoreOptions = {},
): Promise<GeneratedRecipe> {
  const allowedIds = selectAllowedIds(req, INGREDIENTS, PANTRY_IDS, opts.maxIds ?? 80);
  const schema = buildSchema(allowedIds);
  const attempts = Math.max(1, opts.attempts ?? 2);
  let lastValue: unknown;
  let errors: string[] | undefined;

  for (let i = 0; i < attempts; i++) {
    const text = await complete({ messages: buildMessages(req, allowedIds, errors, opts), schema });
    let value: unknown;
    try {
      value = JSON.parse(extractJson(text));
    } catch {
      errors = ['output was not valid/complete JSON'];
      continue;
    }
    lastValue = value;
    const v = validateRecipe(value, { maxMinutes: req.maxMinutes });
    if (v.ok) return v.recipe;
    errors = v.errors;
  }

  if (lastValue && typeof lastValue === 'object') {
    try {
      const s = sanitizeRecipe(lastValue as GeneratedRecipe);
      if (s.ingredients.length >= 2 && s.steps.length >= 1 && s.title) return s;
    } catch {
      /* fall through */
    }
  }
  throw new RecipeGenerationError(
    req.lang === 'ja'
      ? 'レシピをうまく作れませんでした。条件を変えてもう一度お試しください。'
      : 'Could not create a recipe. Please adjust your request and try again.',
  );
}
