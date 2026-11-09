import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedRecipe, GenerateRequest } from '../types';
import { CloudError, generateRecipe, TIMEOUT_MS } from './cloud';

const req: GenerateRequest = { prompt: '安い夕飯', lang: 'ja', fridge: ['moyashi'], maxMinutes: 15, servings: 2 };

const recipe: GeneratedRecipe = {
  title: 'もやし炒め',
  servings: 2,
  totalMinutes: 10,
  ingredients: [
    { id: 'moyashi', amount: 200, unit: 'g' },
    { id: 'onion', amount: 1, unit: 'piece' },
  ],
  steps: ['切る', '炒める'],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(CloudError);
    return (e as CloudError).code;
  }
  throw new Error('expected rejection');
}

describe('generateRecipe (cloud)', () => {
  it('posts the request and returns a validated recipe', async () => {
    fetchMock.mockResolvedValue(json(200, { recipe: { ...recipe, title: '  もやし炒め ', extra: 1 }, model: 'm' }));
    const r = await generateRecipe(req);
    expect(r.title).toBe('もやし炒め');
    expect(r).not.toHaveProperty('extra');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/generate$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ...req, format: 2 });
  });

  it('falls back to a sanitized recipe when validation fails but enough remains', async () => {
    const bad = {
      ...recipe,
      ingredients: [...recipe.ingredients, { id: 'not_a_real_thing', amount: 1, unit: 'g' }],
    };
    fetchMock.mockResolvedValue(json(200, { recipe: bad, model: 'm' }));
    const r = await generateRecipe(req);
    expect(r.ingredients.map((i) => i.id)).toEqual(['moyashi', 'onion']);
  });

  it('throws failed when the recipe is unusable', async () => {
    fetchMock.mockResolvedValue(json(200, { recipe: { title: 'x' }, model: 'm' }));
    expect(await codeOf(generateRecipe(req))).toBe('failed');
  });

  it.each([
    [400, { error: 'bad_request', message: 'nope' }, 'bad_request'],
    [403, { error: 'origin' }, 'upstream'],
    [422, { error: 'failed', message: 'x' }, 'failed'],
    [429, { error: 'quota' }, 'quota'],
    [429, { error: 'rate' }, 'rate'],
    [502, { error: 'upstream' }, 'upstream'],
    [500, 'not json', 'upstream'],
    [429, null, 'rate'],
  ])('maps HTTP %i %j to %s', async (status, body, code) => {
    fetchMock.mockResolvedValue(
      typeof body === 'string' ? new Response(body, { status }) : json(status, body),
    );
    expect(await codeOf(generateRecipe(req))).toBe(code);
  });

  it('keeps the server message', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'bad_request', message: 'too long' }));
    await expect(generateRecipe(req)).rejects.toMatchObject({ code: 'bad_request', message: 'too long', status: 400 });
  });

  it('throws network on fetch failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Load failed'));
    expect(await codeOf(generateRecipe(req))).toBe('network');
  });

  it('throws offline without fetching', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(await codeOf(generateRecipe(req))).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const hangingFetch = (_url: string, init: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });

  it('rejects with AbortError when the caller aborts', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const ac = new AbortController();
    const p = generateRecipe(req, { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(generateRecipe(req, { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('times out after 60s', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hangingFetch);
    const p = codeOf(generateRecipe(req));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    expect(await p).toBe('timeout');
  });
});
