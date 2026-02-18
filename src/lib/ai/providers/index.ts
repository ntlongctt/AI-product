import type { AIProvider, AITask } from '@/types';

/**
 * Provider-specific options for image generation
 * Passed through to the underlying provider SDK
 */
export type ProviderOptions = Record<string, unknown>;

/**
 * Image data returned from generation
 */
export interface GeneratedImage {
  /** URL to the generated image */
  url: string;
  /** Base64 encoded image data (if available) */
  base64?: string;
}

/**
 * Token usage information for the generation
 */
export interface GenerationUsage {
  /** Number of tokens in the prompt */
  promptTokens?: number;
  /** Number of tokens in the completion/output */
  completionTokens?: number;
  /** Total tokens used */
  totalTokens?: number;
}

/**
 * Parameters for image generation
 * Follows Vercel AI SDK patterns
 */
export interface GenerateImageParams {
  /** The AI task being performed */
  task: AITask;
  /** Text prompt for generation (required) */
  prompt: string;
  /** Input image URL for image-to-image tasks */
  inputUrl?: string;
  /** Provider-specific model ID */
  model: string;
  /** Number of images to generate (default: 1) */
  n?: number;
  /** Provider-specific options (aspectRatio, seed, etc.) */
  providerOptions?: ProviderOptions;
}

/**
 * Result from image generation
 */
export interface GenerateImageResult {
  /** Generated images */
  images: GeneratedImage[];
  /** Duration of the generation in milliseconds */
  duration: number;
  /** Cost in cents */
  cost: number;
  /** Token usage information */
  usage?: GenerationUsage;
}

/**
 * Interface that all image generation providers must implement
 * Aligned with Vercel AI SDK's ImageGenerationModel interface
 */
export interface ImageGenerationProvider {
  /**
   * Generate images based on the provided parameters
   */
  generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;
}

/**
 * Factory function to create the appropriate provider instance
 */
export async function createImageProvider(
  provider: AIProvider
): Promise<ImageGenerationProvider> {
  switch (provider) {
    case 'gemini':
      const { GeminiProvider } = await import('./gemini.provider');
      return new GeminiProvider();
    case 'zai':
      const { ZaiProvider } = await import('./zai.provider');
      return new ZaiProvider();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// Re-export external types for convenience
export type { AIProvider, AITask } from '@/types';
