import type { AITask, AIProvider } from '@/types';

interface ProviderConfig {
  primary: AIProvider;
  model: string;
  fallback: AIProvider | null;
}

export const AI_ROUTING: Record<AITask, ProviderConfig> = {
  'remove-bg': {
    primary: 'replicate',
    model: 'lucataco/birefnet',
    fallback: 'fal',
  },
  upscale: {
    primary: 'fal',
    model: 'fal-ai/real-esrgan',
    fallback: 'replicate',
  },
  polish: {
    primary: 'fal',
    model: 'fal-ai/clarity-upscaler',
    fallback: 'replicate',
  },
  relight: {
    primary: 'fal',
    model: 'fal-ai/ic-light',
    fallback: null,
  },
  'scene-gen': {
    primary: 'openai',
    model: 'gpt-image-1',
    fallback: 'fal',
  },
  'try-on': {
    primary: 'replicate',
    model: 'cuuupid/idm-vton',
    fallback: null,
  },
  'object-removal': {
    primary: 'replicate',
    model: 'zylim0702/remove-object',
    fallback: 'fal',
  },
  'text-removal': {
    primary: 'replicate',
    model: 'lucataco/lama',
    fallback: null,
  },
};

export function getProviderForTask(task: AITask): ProviderConfig {
  return AI_ROUTING[task];
}

export function getFallbackProvider(task: AITask): AIProvider | null {
  return AI_ROUTING[task].fallback;
}
