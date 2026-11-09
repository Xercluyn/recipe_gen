import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import type { GeneratedRecipe, GenerateRequest } from '../types';
import { sanitizeRecipe, validateRecipe } from '../lib/validate';
import { getEngine, getLoadedModel } from './engine';
import { MODELS } from './models';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { buildSchema, selectAllowedIds } from './schema';

export { buildSchema, selectAllowedIds };

/** Remove <think> blocks and anything outside the outermost JSON object. */
export function extractJson(text: string): string {
  let t = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t.trim();
}

function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

async function runOnce(
  req: GenerateRequest,
  allowedIds: string[],
  prevErrors: string[] | undefined,
  opts: { onToken?: (partialText: string) => void; signal?: AbortSignal },
): Promise<string> {
  const engine = getEngine();
  if (!engine) throw new Error(req.lang === 'ja' ? 'モデルが読み込まれていません' : 'Model is not loaded');
  if (opts.signal?.aborted) throw abortError();

  const key = getLoadedModel();
  const info = key ? MODELS[key] : undefined;
  const system = buildSystemPrompt(req.lang);
  const user = buildUserPrompt(req, allowedIds, prevErrors, { noThink: info?.thinking ?? true });
  const messages: ChatCompletionMessageParam[] = info?.mergeSystem
    ? [{ role: 'user', content: `${system}

${user}` }]
    : [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];
  const onAbort = () => engine.interruptGenerate();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object', schema: JSON.stringify(buildSchema(allowedIds)) },
      ...(info?.thinking === false ? {} : { extra_body: { enable_thinking: false } }),
    });
    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? '';
      opts.onToken?.(text);
      if (opts.signal?.aborted) break;
    }
    if (opts.signal?.aborted) throw abortError();
    return text;
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

function parse(text: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(extractJson(text)) };
  } catch {
    return { error: 'output was not valid/complete JSON' };
  }
}

export async function generateRecipe(
  req: GenerateRequest,
  opts: { onToken?: (partialText: string) => void; signal?: AbortSignal } = {},
): Promise<GeneratedRecipe> {
  const allowedIds = selectAllowedIds(req);
  let lastValue: unknown;
  let errors: string[] | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await runOnce(req, allowedIds, errors, opts);
    const parsed = parse(text);
    if (parsed.error) {
      errors = [parsed.error];
      continue;
    }
    lastValue = parsed.value;
    const v = validateRecipe(parsed.value, { maxMinutes: req.maxMinutes });
    if (v.ok) return v.recipe;
    errors = v.errors;
  }

  if (lastValue !== undefined) {
    try {
      const s = sanitizeRecipe(lastValue as GeneratedRecipe);
      if (s.ingredients.length >= 2 && s.steps.length >= 1) return s;
    } catch {
      /* fall through */
    }
  }
  throw new Error(
    req.lang === 'ja'
      ? 'レシピをうまく作れませんでした。条件を変えてもう一度お試しください。'
      : 'Could not create a recipe. Please adjust your request and try again.',
  );
}
