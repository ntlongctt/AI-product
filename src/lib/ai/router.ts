import type { AITask, AIProvider } from '@/types';

export interface ProviderConfig {
  primary: AIProvider;
  model: string;
  fallback: AIProvider | null;
}

/**
 * AI Routing Configuration
 * Maps each task to its primary and fallback providers
 *
 * Routing Rules:
 * - remove-bg: Gemini → z.ai
 * - scene-gen: z.ai → Gemini
 * - try-on: Gemini → z.ai
 */
export const AI_ROUTING: Record<AITask, ProviderConfig> = {
  'remove-bg': {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: 'zai',
  },
  upscale: {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: 'zai',
  },
  polish: {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: 'zai',
  },
  relight: {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: null,
  },
  'scene-gen': {
    primary: 'zai',
    model: 'glm-image',
    fallback: 'gemini',
  },
  'try-on': {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: 'zai',
  },
  'object-removal': {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: 'zai',
  },
  'text-removal': {
    primary: 'gemini',
    model: 'gemini-2.5-flash-preview-05-20',
    fallback: null,
  },
};

/**
 * Get the provider configuration for a specific task
 */
export function getProviderForTask(task: AITask): ProviderConfig {
  const config = AI_ROUTING[task];
  if (!config) {
    throw new Error(`No provider configuration found for task: ${task}`);
  }
  return config;
}

/**
 * Get the fallback provider for a specific task
 */
export function getFallbackProvider(task: AITask): AIProvider | null {
  return AI_ROUTING[task]?.fallback ?? null;
}

/**
 * Check if a task has a fallback provider configured
 */
export function hasFallbackProvider(task: AITask): boolean {
  return AI_ROUTING[task]?.fallback != null;
}
