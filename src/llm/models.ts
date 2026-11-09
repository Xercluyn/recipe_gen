import type { ModelKey } from '../types';

/**
 * Model ids verified against @mlc-ai/web-llm 0.2.87 prebuiltAppConfig.
 * vramMB = web-llm's estimate at 4096 context (we use less, see CONTEXT_WINDOW_SIZE).
 * - standard: Qwen3 1.7B (~2.0 GB VRAM) — best quality, for desktop / newest iPhones.
 * - light: Gemma 3 1B (~0.7 GB VRAM, 512-token prefill chunks) — safe on iPhone Safari,
 *   whose per-tab memory limit kills the page when Qwen-sized buffers are used.
 * sizeMB = approximate download size of the weights.
 * thinking: model supports Qwen3 thinking mode (we disable it with /no_think).
 * mergeSystem: model has no system role (Gemma) — prepend system prompt to the user turn.
 */
export interface ModelInfo {
  id: string;
  label: { ja: string; en: string };
  sizeMB: number;
  thinking: boolean;
  mergeSystem: boolean;
}

export const MODELS: Record<ModelKey, ModelInfo> = {
  standard: {
    id: 'Qwen3-1.7B-q4f16_1-MLC',
    label: { ja: '標準 (Qwen3 1.7B・高品質・PC/最新iPhone向け)', en: 'Standard (Qwen3 1.7B, better quality, PC / newest iPhone)' },
    sizeMB: 1000,
    thinking: true,
    mergeSystem: false,
  },
  light: {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    label: { ja: '軽量 (Gemma 3 1B・省メモリ・iPhone推奨)', en: 'Light (Gemma 3 1B, low memory, best for iPhone)' },
    sizeMB: 750,
    thinking: false,
    mergeSystem: true,
  },
};

/** Models shipped by earlier versions of the app; their cache is deleted to free storage. */
export const RETIRED_MODEL_IDS = ['Qwen3-0.6B-q4f16_1-MLC'];

/**
 * Context window override (prebuilt default is 4096). The KV cache is allocated for the
 * whole window, so smaller = less GPU memory. Prompt (~600 tokens with 40 ingredients)
 * + output (max 600 tokens) fits in 1536.
 */
export const CONTEXT_WINDOW_SIZE = 1536;
