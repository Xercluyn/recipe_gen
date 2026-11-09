import {
  CreateWebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type InitProgressReport,
  type WebWorkerMLCEngine,
} from '@mlc-ai/web-llm';
import type { LoadProgress, ModelKey } from '../types';
import { CONTEXT_WINDOW_SIZE, MODELS, RETIRED_MODEL_IDS } from './models';

let engine: WebWorkerMLCEngine | null = null;
let loadedKey: ModelKey | null = null;
let loading: { key: ModelKey; promise: Promise<void> } | null = null;
let progressListener: ((p: LoadProgress) => void) | undefined;

const chatOpts = { context_window_size: CONTEXT_WINDOW_SIZE };

function onInitProgress(report: InitProgressReport) {
  progressListener?.({ progress: report.progress, text: report.text });
}

export async function hasWebGPU(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export function getEngine(): WebWorkerMLCEngine | null {
  return engine;
}

export function getLoadedModel(): ModelKey | null {
  return loadedKey;
}

async function doLoad(key: ModelKey): Promise<void> {
  const modelId = MODELS[key].id;
  if (!engine) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    engine = await CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: onInitProgress }, chatOpts);
  } else {
    loadedKey = null;
    await engine.reload(modelId, chatOpts);
  }
  loadedKey = key;
}

/** Load (or switch to) a model. Concurrent calls for the same model share one promise. */
export async function loadModel(key: ModelKey, onProgress?: (p: LoadProgress) => void): Promise<void> {
  progressListener = onProgress;
  if (loading) {
    if (loading.key === key) return loading.promise;
    await loading.promise.catch(() => {});
    progressListener = onProgress;
  }
  if (engine && loadedKey === key) {
    onProgress?.({ progress: 1, text: 'ready' });
    return;
  }
  const promise = doLoad(key).finally(() => {
    if (loading?.promise === promise) loading = null;
  });
  loading = { key, promise };
  return promise;
}

export async function isModelCached(key: ModelKey): Promise<boolean> {
  try {
    return await hasModelInCache(MODELS[key].id);
  } catch {
    return false;
  }
}

export async function deleteModel(key: ModelKey): Promise<void> {
  if (engine && loadedKey === key) {
    await engine.unload();
    loadedKey = null;
  }
  await deleteModelAllInfoInCache(MODELS[key].id);
}

/** Free storage used by models that older app versions downloaded. */
export async function cleanupRetiredModels(): Promise<void> {
  for (const id of RETIRED_MODEL_IDS) {
    try {
      if (await hasModelInCache(id)) await deleteModelAllInfoInCache(id);
    } catch {
      /* ignore */
    }
  }
}
