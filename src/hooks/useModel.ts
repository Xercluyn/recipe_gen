import { useSyncExternalStore } from 'react';
import type { LoadProgress, ModelKey } from '../types';

/**
 * App-wide model state that survives page navigation (a download keeps
 * progressing while the user browses Saved / Settings).
 * The heavy engine module is imported lazily.
 */
export interface ModelState {
  webgpu: boolean | null; // null = still checking
  loaded: ModelKey | null;
  loading: ModelKey | null;
  progress: LoadProgress | null;
  error: string | null;
  cached: Partial<Record<ModelKey, boolean>>;
}

let state: ModelState = {
  webgpu: null,
  loaded: null,
  loading: null,
  progress: null,
  error: null,
  cached: {},
};
const listeners = new Set<() => void>();

function set(patch: Partial<ModelState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const engine = () => import('../llm/engine');

let initStarted = false;
export function initModelState(): void {
  if (initStarted) return;
  initStarted = true;
  void (async () => {
    try {
      const e = await engine();
      const ok = await e.hasWebGPU();
      set({ webgpu: ok, loaded: e.getLoadedModel() });
      if (ok) await refreshCached();
    } catch {
      set({ webgpu: false });
    }
  })();
}

export async function refreshCached(): Promise<void> {
  try {
    const e = await engine();
    const keys: ModelKey[] = ['standard', 'light'];
    const vals = await Promise.all(keys.map((k) => e.isModelCached(k).catch(() => false)));
    set({ cached: { standard: vals[0], light: vals[1] } });
  } catch {
    /* ignore */
  }
}

export async function startLoad(key: ModelKey): Promise<void> {
  if (state.loading) return;
  set({ loading: key, progress: { progress: 0, text: '' }, error: null });
  try {
    const e = await engine();
    await e.loadModel(key, (p) => set({ progress: p }));
    set({ loaded: e.getLoadedModel() ?? key, loading: null, progress: null });
    void refreshCached();
  } catch (err) {
    set({
      loading: null,
      progress: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function removeModel(key: ModelKey): Promise<void> {
  const e = await engine();
  await e.deleteModel(key);
  set({ loaded: e.getLoadedModel() });
  await refreshCached();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useModelState(): ModelState {
  initModelState();
  return useSyncExternalStore(subscribe, () => state);
}
