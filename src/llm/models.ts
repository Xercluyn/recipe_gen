import type { ModelKey } from '../types';

/**
 * Model ids verified against @mlc-ai/web-llm 0.2.87 prebuiltAppConfig.
 * Both are q4f16_1 builds flagged `low_resource_required` (VRAM ~2.0GB / ~1.4GB).
 * sizeMB = approximate download size of the weights.
 */
export const MODELS: Record<ModelKey, { id: string; label: { ja: string; en: string }; sizeMB: number }> = {
  standard: {
    id: 'Qwen3-1.7B-q4f16_1-MLC',
    label: { ja: '標準 (Qwen3 1.7B・高品質)', en: 'Standard (Qwen3 1.7B, better quality)' },
    sizeMB: 1000,
  },
  light: {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    label: { ja: '軽量 (Qwen3 0.6B・高速)', en: 'Light (Qwen3 0.6B, faster)' },
    sizeMB: 350,
  },
};

/** Context window override (prebuilt default is 4096). Smaller = less KV-cache memory on iPhone. */
export const CONTEXT_WINDOW_SIZE = 3072;
