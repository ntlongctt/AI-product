import { GoogleGenAI } from '@google/genai';
import type { ImageGenerationProvider, GenerateImageParams, GenerateImageResult } from './index';

export class GeminiProvider implements ImageGenerationProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const startTime = Date.now();

    const { task, inputUrl, prompt, providerOptions } = params;

    try {
      // Fetch and convert input URL to base64 if it's an HTTP URL
      const processedInputUrl = inputUrl ? await this.processInputUrl(inputUrl) : undefined;
      const contents = this.buildContents(task, prompt, processedInputUrl);

      const result = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          ...this.getGenerationConfig(providerOptions),
        },
      });

      // Extract image from response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response from Gemini');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No content in Gemini response');
      }

      // Find the image part
      const imagePart = parts.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData);
      if (!imagePart?.inlineData?.data) {
        throw new Error('No image generated');
      }

      const base64Data = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const url = `data:${mimeType};base64,${base64Data}`;

      return {
        images: [{ url }],
        duration: Date.now() - startTime,
        cost: this.calculateCost(task),
      };
    } catch (error) {
      console.error('[GeminiProvider] generateImage error:', error);
      throw error;
    }
  }

  private buildContents(
    task: string,
    prompt?: string,
    inputUrl?: string
  ): Array<{ role: string; parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> }> {
    const text = this.buildPrompt(task, prompt);

    if (inputUrl) {
      // Image editing mode - include input image
      const base64Data = this.extractBase64Data(inputUrl);
      const mimeType = this.extractMimeType(inputUrl) || 'image/png';

      return [
        {
          role: 'user',
          parts: [
            { text },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ];
    }

    // Text-to-image mode
    return [
      {
        role: 'user',
        parts: [{ text }],
      },
    ];
  }

  private async processInputUrl(url: string): Promise<string> {
    // If already a data URL, return as-is
    if (url.startsWith('data:')) {
      return url;
    }

    // Fetch HTTP(S) URL and convert to base64 data URL
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      throw new Error(`Failed to process input URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractBase64Data(dataUrl: string): string {
    if (dataUrl.startsWith('data:')) {
      const commaIndex = dataUrl.indexOf(',');
      return dataUrl.substring(commaIndex + 1);
    }
    return dataUrl;
  }

  private extractMimeType(dataUrl: string): string | undefined {
    if (dataUrl.startsWith('data:')) {
      const match = dataUrl.match(/data:([^;]+);/);
      return match?.[1];
    }
    return undefined;
  }

  private buildPrompt(task: string, userPrompt?: string): string {
    const taskPrompts: Record<string, string> = {
      'remove-bg': 'Remove the background from this image, keeping only the main subject.',
      'upscale': 'Enhance and upscale this image to higher resolution while preserving details.',
      'polish': 'Improve the quality of this image, enhance colors, lighting, and overall appearance.',
      'relight': 'Adjust the lighting in this image to create a more professional look.',
      'scene-gen': userPrompt || 'Generate a high-quality product scene image.',
      'try-on': 'Place the product in this image into a realistic usage scenario.',
      'object-removal': 'Remove unwanted objects from this image seamlessly.',
      'text-removal': 'Remove all text from this image while preserving the background.',
    };

    const basePrompt = taskPrompts[task] || userPrompt || 'Process this image.';

    if (userPrompt && task !== 'scene-gen') {
      return `${basePrompt} Additional instructions: ${userPrompt}`;
    }

    return basePrompt;
  }

  private getGenerationConfig(options?: Record<string, unknown>): Record<string, unknown> {
    // Gemini generation config options
    const config: Record<string, unknown> = {};

    if (options?.seed !== undefined) {
      config.seed = options.seed;
    }

    // Map size to aspect ratio hints if provided
    const size = options?.size as string | undefined;
    if (size) {
      const [width, height] = size.split('x').map(Number);
      if (width && height) {
        // Store aspect ratio info in responseModalities or use as needed
        config.responseModalities = ['IMAGE', 'TEXT'];
      }
    }

    return config;
  }

  private calculateCost(task: string): number {
    // Cost in cents based on task complexity
    const costs: Record<string, number> = {
      'remove-bg': 2,
      'upscale': 3,
      'polish': 3,
      'relight': 4,
      'scene-gen': 5,
      'try-on': 5,
      'object-removal': 4,
      'text-removal': 3,
    };

    return costs[task] || 5;
  }
}
