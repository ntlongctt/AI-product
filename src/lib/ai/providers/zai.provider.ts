import type { ImageGenerationProvider, GenerateImageParams, GenerateImageResult } from './index';

interface ZaiImageGenerationResponse {
  id: string;
  model: string;
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ZaiErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class ZaiProvider implements ImageGenerationProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ZAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ZAI_API_KEY environment variable is required');
    }

    this.baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4';
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const startTime = Date.now();

    const { task, inputUrl, prompt, providerOptions, n } = params;

    try {
      // z.ai only supports text-to-image, so for editing tasks we use prompt engineering
      const enhancedPrompt = await this.buildPrompt(task, prompt, inputUrl);

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'z.ai-image-gen',
          prompt: enhancedPrompt,
          n: n || 1,
          size: (providerOptions?.size as string) || '1024x1024',
          quality: (providerOptions?.quality as string) || 'standard',
          response_format: 'url',
          ...(providerOptions?.seed !== undefined ? { seed: providerOptions.seed } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as ZaiErrorResponse;
        throw new Error(
          `z.ai API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json() as ZaiImageGenerationResponse;

      if (!data.data || data.data.length === 0 || !data.data[0].url) {
        throw new Error('z.ai API returned no image URL');
      }

      // Note: Image URLs expire after 30 days per z.ai documentation
      const url = data.data[0].url;

      return {
        images: [{ url }],
        duration: Date.now() - startTime,
        cost: this.calculateCost(task),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('[ZaiProvider] generateImage error:', error);
      throw error;
    }
  }

  private async buildPrompt(
    task: string,
    userPrompt?: string,
    inputUrl?: string
  ): Promise<string> {
    // For tasks that require an input image, we need to describe what we want
    // since z.ai doesn't support native image editing
    const taskPrompts: Record<string, string> = {
      'remove-bg':
        'Create a product image with a clean transparent or white background. ' +
        'The main subject should be clearly visible with no distracting background elements.',
      'upscale':
        'Generate a high-resolution, detailed image with sharp focus and crisp details. ' +
        'Professional quality, 4K resolution appearance.',
      'polish':
        'Create a polished, professional image with enhanced colors, ' +
        'perfect lighting, and high-end photography quality.',
      'relight':
        'Generate an image with professional studio lighting, ' +
        'soft shadows, and perfect illumination of the subject.',
      'scene-gen':
        userPrompt ||
        'Generate a high-quality product scene with professional photography styling.',
      'try-on':
        'Create a realistic lifestyle product image showing the item in use ' +
        'in an appropriate real-world setting.',
      'object-removal':
        'Generate a clean image with only the essential elements, ' +
        'removing any distracting or unwanted objects.',
      'text-removal':
        'Create a clean image with no text, labels, or typography, ' +
        'showing only the visual content.',
    };

    let basePrompt = taskPrompts[task] || userPrompt || 'Generate a high-quality image.';

    // If there's a user prompt, incorporate it
    if (userPrompt && task !== 'scene-gen') {
      basePrompt = `${basePrompt} User request: ${userPrompt}`;
    }

    // If there's an input image URL for editing tasks, we note it
    // (In a production system, you might want to download and analyze the image,
    // or use a vision model to describe it for better prompt engineering)
    if (inputUrl && task !== 'scene-gen') {
      basePrompt = `${basePrompt} Based on reference image: ${inputUrl}`;
    }

    return basePrompt;
  }

  private calculateCost(task: string): number {
    // Cost in cents based on task complexity
    // z.ai pricing may vary, these are estimated costs
    const costs: Record<string, number> = {
      'remove-bg': 3,
      'upscale': 4,
      'polish': 4,
      'relight': 5,
      'scene-gen': 6,
      'try-on': 6,
      'object-removal': 5,
      'text-removal': 4,
    };

    return costs[task] || 5;
  }

  /**
   * Note: Image URLs from z.ai expire after 30 days.
   * For persistent storage, download and store images in your own storage (e.g., R2).
   */
  async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
