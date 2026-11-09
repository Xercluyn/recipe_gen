import { describe, expect, it, vi } from 'vitest';
import worker, { FALLBACK_MODEL, MODEL, outputText, parseRequest, type Env } from './index';

const ORIGIN = 'https://xercluyn.github.io';

const VALID = {
  title: 'もやし卵炒め',
  servings: 2,
  totalMinutes: 10,
  ingredients: [
    { id: 'moyashi', amount: 200, unit: 'g' },
    { id: 'egg', amount: 2, unit: 'piece' },
  ],
  description: 'ふわふわ卵とシャキシャキもやしの節約おかず。',
  steps: ['{egg}をボウルに溶きほぐす。', 'フライパンを中火で熱し、{moyashi}を2分炒める。', '{egg}を回し入れ、半熟になるまで30秒ほど混ぜて火を止める。'],
  tip: 'もやしは安い日にまとめ買い',
};

const BODY = { prompt: '簡単な炒め物', lang: 'ja', servings: 2, maxMinutes: 15, fridge: ['moyashi', 'egg'] };

/** Gemma (OpenAI shape) output. */
const openai = (content: unknown) => ({
  choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
});

function makeEnv(outputs: Array<unknown | Error>, rateOk = true) {
  const run = vi.fn(async () => {
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const limit = vi.fn(async () => ({ success: rateOk }));
  const env = { AI: { run }, RATE_LIMITER: { limit } } as unknown as Env;
  return { env, run, limit };
}

function post(body: unknown, headers: Record<string, string> = { Origin: ORIGIN }) {
  return new Request('https://api.example/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('worker', () => {
  it('valid recipe -> 200 with CORS', async () => {
    const { env, run, limit } = makeEnv([openai(VALID)]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const data = (await res.json()) as { recipe: { title: string }; model: string };
    expect(data.recipe.title).toBe(VALID.title);
    expect(data.model).toBe(MODEL);
    expect(limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
    const [model, inputs] = run.mock.calls[0] as unknown as [string, Record<string, any>];
    expect(model).toBe(MODEL);
    expect(inputs.response_format.type).toBe('json_schema');
    expect(inputs.response_format.json_schema.schema.properties.ingredients).toBeTruthy();
    expect(inputs.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(inputs.messages[0].role).toBe('system');
  });

  it('retries after an unknown ingredient id, second valid -> 200', async () => {
    const bad = { ...VALID, ingredients: [{ id: 'dragon_fruit_xx', amount: 1, unit: 'piece' }] };
    const { env, run } = makeEnv([openai(bad), openai(VALID)]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
    const second = (run.mock.calls[1] as unknown as [string, { messages: { content: string }[] }])[1];
    expect(second.messages.at(-1)!.content).toContain('dragon_fruit_xx');
  });

  it('garbage on every attempt -> 422', async () => {
    const { env, run } = makeEnv([openai('not json at all'), openai('{{{'), openai('nope')]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe('failed');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('legacy { response: object } shape is accepted', async () => {
    expect(outputText({ response: VALID })).toBe(JSON.stringify(VALID));
    expect(outputText({ response: '{"a":1}' })).toBe('{"a":1}');
  });

  it('falls back to the second model when the primary errors', async () => {
    const { env, run } = makeEnv([new Error('5007: No such model'), { response: VALID }]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { model: string }).model).toBe(FALLBACK_MODEL);
    const [model, inputs] = run.mock.calls[1] as unknown as [string, Record<string, any>];
    expect(model).toBe(FALLBACK_MODEL);
    expect(inputs.response_format.json_schema.type).toBe('object');
  });

  it('other upstream failure on both models -> 502 without leaking details', async () => {
    const { env } = makeEnv([new Error('boom secret'), new Error('boom secret')]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret');
  });

  it('disallowed origin -> 403', async () => {
    const { env, run } = makeEnv([openai(VALID)]);
    const res = await worker.fetch(post(BODY, { Origin: 'https://evil.example' }), env);
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('no Origin header (curl) is allowed', async () => {
    const { env } = makeEnv([openai(VALID)]);
    const res = await worker.fetch(post(BODY, {}), env);
    expect(res.status).toBe(200);
  });

  it('OPTIONS -> 204 with CORS headers', async () => {
    const req = new Request('https://api.example/generate', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
    });
    const res = await worker.fetch(req, makeEnv([]).env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('GET /health', async () => {
    const res = await worker.fetch(new Request('https://api.example/health'), makeEnv([]).env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, model: MODEL });
  });

  it.each([
    ['bad lang', { ...BODY, lang: 'fr' }],
    ['servings 0', { ...BODY, servings: 0 }],
    ['servings float', { ...BODY, servings: 1.5 }],
    ['maxMinutes 20', { ...BODY, maxMinutes: 20 }],
    ['prompt too long', { ...BODY, prompt: 'あ'.repeat(201) }],
    ['budget too low', { ...BODY, budgetPerServingYen: 10 }],
    ['fridge too long', { ...BODY, fridge: Array(31).fill('egg') }],
    ['not json', 'nope'],
    ['body > 4KB', { ...BODY, pad: 'x'.repeat(5000) }],
  ])('bad input (%s) -> 400', async (_name, body) => {
    const { env, run } = makeEnv([openai(VALID)]);
    const res = await worker.fetch(post(body), env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('bad_request');
    expect(run).not.toHaveBeenCalled();
  });

  it('parseRequest trims prompt and drops unknown fridge ids', () => {
    const r = parseRequest({ ...BODY, prompt: '  hi  ', fridge: ['egg', 'nope', 'egg', 3] });
    expect(r.prompt).toBe('hi');
    expect(r.fridge).toEqual(['egg']);
  });

  it('quota error -> 429 quota (no fallback attempt)', async () => {
    const { env, run } = makeEnv([
      new Error('3036: Your account has reached its daily free allocation of 10,000 neurons'),
    ]);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'quota' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rate limiter false -> 429 rate', async () => {
    const { env, run } = makeEnv([openai(VALID)], false);
    const res = await worker.fetch(post(BODY), env);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate' });
    expect(run).not.toHaveBeenCalled();
  });
});
