// Recipe Gen API — Cloudflare Worker using Workers AI (free daily allocation).
// POST /generate { GenerateRequest } -> { recipe, model }
import type { GenerateRequest, Lang } from '../../src/types';
import { INGREDIENT_MAP } from '../../src/data/ingredients';
import { generateWith, RecipeGenerationError, type Complete, type ChatMessage } from '../../src/llm/core';

export interface Env {
  AI: Ai;
  /** Optional so the Worker still runs if the binding is absent (e.g. some local setups). */
  RATE_LIMITER?: RateLimit;
}

/**
 * Primary: Gemma 4 26B-A4B (MoE, 4B active). OpenAI-compatible chat endpoint, accepts
 * response_format json_schema, strong multilingual/Japanese, and cheap:
 * 9,091 in / 27,273 out neurons per 1M tokens.
 * Fallback: Llama 3.3 70B fp8-fast — officially listed for Workers AI JSON mode, but ~5x the cost.
 */
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

interface ModelConfig {
  /** OpenAI-style input/output (response_format {name, schema}, choices[].message.content). */
  openai: boolean;
  /** Reasoning model whose thinking must be disabled via chat_template_kwargs. */
  disableThinking: boolean;
  noThink: boolean;
  mergeSystem: boolean;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  [MODEL]: { openai: true, disableThinking: true, noThink: false, mergeSystem: false },
  [FALLBACK_MODEL]: { openai: false, disableThinking: false, noThink: false, mergeSystem: false },
};

const ALLOWED_ORIGINS = new Set([
  'https://xercluyn.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]);

const MAX_BODY_BYTES = 4096;
const MAX_PROMPT = 200;
const MAX_FRIDGE = 30;
const MINUTES = new Set([10, 15, 30, 60]);

class BadRequest extends Error {}
class QuotaError extends Error {}

// ---------- HTTP helpers ----------

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

// ---------- Input validation ----------

export function parseRequest(raw: unknown): GenerateRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequest('body must be a JSON object');
  const b = raw as Record<string, unknown>;

  if (typeof b.prompt !== 'string') throw new BadRequest('prompt must be a string');
  const prompt = b.prompt.trim();
  if (prompt.length > MAX_PROMPT) throw new BadRequest(`prompt must be <= ${MAX_PROMPT} chars`);

  if (b.lang !== 'ja' && b.lang !== 'en') throw new BadRequest("lang must be 'ja' or 'en'");
  const lang: Lang = b.lang;

  const servings = b.servings;
  if (typeof servings !== 'number' || !Number.isInteger(servings) || servings < 1 || servings > 8)
    throw new BadRequest('servings must be an integer 1-8');

  const maxMinutes = b.maxMinutes;
  if (typeof maxMinutes !== 'number' || !MINUTES.has(maxMinutes))
    throw new BadRequest('maxMinutes must be one of 10, 15, 30, 60');

  let budgetPerServingYen: number | undefined;
  if (b.budgetPerServingYen !== undefined && b.budgetPerServingYen !== null) {
    const y = b.budgetPerServingYen;
    if (typeof y !== 'number' || !Number.isFinite(y) || y < 50 || y > 5000)
      throw new BadRequest('budgetPerServingYen must be a number 50-5000');
    budgetPerServingYen = y;
  }

  const fridgeRaw = b.fridge ?? [];
  if (!Array.isArray(fridgeRaw) || fridgeRaw.length > MAX_FRIDGE)
    throw new BadRequest(`fridge must be an array of <= ${MAX_FRIDGE} ids`);
  const fridge = [
    ...new Set(fridgeRaw.filter((id): id is string => typeof id === 'string' && Object.hasOwn(INGREDIENT_MAP, id))),
  ];

  const req: GenerateRequest = { prompt, lang, servings, maxMinutes, fridge };
  if (budgetPerServingYen !== undefined) req.budgetPerServingYen = budgetPerServingYen;
  return req;
}

async function readBody(request: Request): Promise<unknown> {
  const len = Number(request.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY_BYTES) throw new BadRequest('body too large');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) throw new BadRequest('body too large');
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new BadRequest('body must be valid JSON');
  }
}

// ---------- Workers AI ----------

function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name} ${e.message}`;
  return String(e);
}

export function isQuotaError(e: unknown): boolean {
  const s = errorText(e);
  return /\b(3036|4006)\b|daily free allocation|neurons|rate.?limit|too many requests|\b429\b/i.test(s);
}

function isJsonModeError(e: unknown): boolean {
  return /JSON Mode couldn.t be met/i.test(errorText(e));
}

/** Extract the model text from either Workers AI output shape. */
export function outputText(out: unknown): string {
  if (typeof out === 'string') return out;
  if (!out || typeof out !== 'object') return '';
  const o = out as Record<string, unknown>;
  // Legacy shape: { response: string | object }
  if ('response' in o) {
    const r = o.response;
    if (typeof r === 'string') return r;
    if (r && typeof r === 'object') return JSON.stringify(r);
  }
  // OpenAI shape: { choices: [{ message: { content } }] }
  const choices = o.choices;
  if (Array.isArray(choices) && choices.length) {
    const msg = (choices[0] as { message?: { content?: unknown } }).message;
    const c = msg?.content;
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') return JSON.stringify(c);
  }
  return '';
}

type RunFn = (model: string, inputs: Record<string, unknown>) => Promise<unknown>;

function buildInputs(model: string, messages: ChatMessage[], schema: object): Record<string, unknown> {
  const cfg = MODEL_CONFIG[model];
  const inputs: Record<string, unknown> = { messages, temperature: 0.7 };
  if (cfg.openai) {
    inputs.response_format = { type: 'json_schema', json_schema: { name: 'recipe', schema, strict: true } };
    inputs.max_completion_tokens = 800;
  } else {
    inputs.response_format = { type: 'json_schema', json_schema: schema };
    inputs.max_tokens = 800;
  }
  if (cfg.disableThinking) inputs.chat_template_kwargs = { enable_thinking: false };
  return inputs;
}

export async function generateRecipe(env: Env, req: GenerateRequest) {
  // Loose call signature: model IDs are runtime strings and the two models take different input shapes.
  const run = env.AI.run.bind(env.AI) as unknown as RunFn;
  let model = MODEL;

  const complete: Complete = async ({ messages, schema }) => {
    for (;;) {
      try {
        return outputText(await run(model, buildInputs(model, messages, schema)));
      } catch (e) {
        if (isQuotaError(e)) throw new QuotaError('quota');
        // Constrained decoding failed: treat as invalid output so generateWith retries with feedback.
        if (isJsonModeError(e)) return '';
        if (model === FALLBACK_MODEL) throw e;
        console.warn('primary model failed, switching to fallback', errorText(e));
        model = FALLBACK_MODEL;
      }
    }
  };

  // Both models are configured identically for these options; read them from the primary.
  const cfg = MODEL_CONFIG[MODEL];
  const recipe = await generateWith(complete, req, {
    maxIds: 80,
    noThink: cfg.noThink,
    mergeSystem: cfg.mergeSystem,
    attempts: 2,
  });
  return { recipe, model };
}

// ---------- Handler ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, model: MODEL }, 200, origin);
    }

    if (url.pathname !== '/generate') return json({ error: 'not_found' }, 404, origin);
    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);

    // No Origin (curl, server-to-server) is allowed; a browser Origin must be on the list.
    if (origin !== null && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin' }, 403, origin);

    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success) return json({ error: 'rate' }, 429, origin);
      } catch (e) {
        console.warn('rate limiter error', errorText(e)); // fail open
      }
    }

    let req: GenerateRequest;
    try {
      req = parseRequest(await readBody(request));
    } catch (e) {
      const message = e instanceof BadRequest ? e.message : 'invalid request';
      return json({ error: 'bad_request', message }, 400, origin);
    }

    try {
      const { recipe, model } = await generateRecipe(env, req);
      return json({ recipe, model }, 200, origin);
    } catch (e) {
      if (e instanceof QuotaError || isQuotaError(e)) return json({ error: 'quota' }, 429, origin);
      if (e instanceof RecipeGenerationError) return json({ error: 'failed', message: e.message }, 422, origin);
      console.error('generate failed', errorText(e));
      return json({ error: 'upstream' }, 502, origin);
    }
  },
} satisfies ExportedHandler<Env>;
