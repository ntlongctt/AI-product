import type { AIProvider, AITask } from '@/types';

export interface GenerateImageParams {
  task: AITask;
  inputUrl: string;
  prompt?: string;
  options?: Record<string, unknown>;
}

export interface GenerateImageResult {
  outputUrl: string;
  duration: number;
  cost: number;
}

export interface AIProviderClient {
  generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;
}

export async function createAIProvider(provider: AIProvider): Promise<AIProviderClient> {
  switch (provider) {
    case 'fal':
      const { FalProvider } = await import('./fal');
      return new FalProvider();
    case 'replicate':
      const { ReplicateProvider } = await import('./replicate');
      return new ReplicateProvider();
    case 'openai':
      const { OpenAIProvider } = await import('./openai');
      return new OpenAIProvider();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
