// Client for the recipe API (Cloudflare Worker, see api/).
import type { GeneratedRecipe, GenerateRequest } from '../types';
import { sanitizeRecipe, validateRecipe } from '../lib/validate';
import { API_URL } from '../config';

export type CloudErrorCode =
  | 'offline'
  | 'quota'
  | 'rate'
  | 'failed'
  | 'network'
  | 'timeout'
  | 'bad_request'
  | 'upstream';

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  readonly status?: number;
  constructor(code: CloudErrorCode, message?: string, status?: number) {
    super(message || code);
    this.name = 'CloudError';
    this.code = code;
    this.status = status;
  }
}

export const TIMEOUT_MS = 60_000;

const KNOWN: ReadonlySet<string> = new Set(['quota', 'rate', 'failed', 'bad_request', 'upstream']);

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function codeFor(status: number, body: unknown): CloudErrorCode {
  const err = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  if (typeof err === 'string' && KNOWN.has(err)) return err as CloudErrorCode;
  if (status === 429) return 'rate';
  if (status === 400) return 'bad_request';
  if (status === 422) return 'failed';
  return 'upstream'; // 403 origin, 5xx, unknown
}

/** Re-check the server's recipe on the client; fall back to a sanitized copy. */
function checkRecipe(value: unknown, req: GenerateRequest): GeneratedRecipe {
  const v = validateRecipe(value, { maxMinutes: req.maxMinutes });
  if (v.ok) return v.recipe;
  if (value && typeof value === 'object') {
    try {
      const s = sanitizeRecipe(value as GeneratedRecipe);
      if (s.ingredients.length >= 2 && s.steps.length >= 1 && s.title) return s;
    } catch {
      /* fall through */
    }
  }
  throw new CloudError('failed', v.errors.join('; '));
}

export async function generateRecipe(
  req: GenerateRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<GeneratedRecipe> {
  const { signal } = opts;
  if (signal?.aborted) throw abortError();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new CloudError('offline');

  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, TIMEOUT_MS);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let res: Response;
    let body: unknown;
    try {
      res = await fetch(`${API_URL.replace(/\/+$/, '')}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, format: 2 }), // 2 = we render {ingredient_id} tokens
        signal: ac.signal,
      });
      body = await res.json().catch(() => null);
    } catch (e) {
      if (signal?.aborted) throw abortError();
      if (timedOut) throw new CloudError('timeout');
      throw new CloudError('network', e instanceof Error ? e.message : String(e));
    }
    if (signal?.aborted) throw abortError();

    if (!res.ok) {
      const msg = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;
      throw new CloudError(codeFor(res.status, body), typeof msg === 'string' ? msg : undefined, res.status);
    }
    const recipe = body && typeof body === 'object' ? (body as { recipe?: unknown }).recipe : undefined;
    return checkRecipe(recipe, req);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}
