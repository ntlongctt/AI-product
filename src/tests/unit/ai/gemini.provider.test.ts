import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerateImageParams } from '@/lib/ai/providers';
import type { AITask } from '@/types';

// Mock the @google/genai SDK
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
    constructor() {
      // Mock constructor
    }
  },
}));

// Import the provider after mocking
import { GeminiProvider } from '@/lib/ai/providers/gemini.provider';

describe('GeminiProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize with API key from environment', () => {
      const provider = new GeminiProvider();
      expect(provider).toBeDefined();
    });

    it('should use custom model from environment variable', () => {
      process.env.GEMINI_MODEL = 'gemini-custom-model';
      const provider = new GeminiProvider();
      expect(provider).toBeDefined();
    });

    it('should throw error if API key is missing', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => new GeminiProvider()).toThrow(
        'GEMINI_API_KEY environment variable is required'
      );
    });
  });

  describe('generateImage', () => {
    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64-image-data',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      });
    });

    it('should generate image for text-to-image task (scene-gen)', async () => {
      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'A beautiful product photo',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      const result = await provider.generateImage(params);

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'A beautiful product photo' }],
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      expect(result).toMatchObject({
        images: [{ url: 'data:image/png;base64,base64-image-data' }],
        cost: 5,
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should generate image for image-to-image task (remove-bg)', async () => {
      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'remove-bg' as AITask,
        inputUrl: 'https://example.com/input.jpg',
        prompt: 'Custom prompt',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      const result = await provider.generateImage(params);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('Remove the background'),
                }),
              ]),
            }),
          ]),
        })
      );

      expect(result.cost).toBe(2);
    });

    it('should handle data URL input format', async () => {
      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'upscale' as AITask,
        inputUrl: 'data:image/jpeg;base64,input-image-data',
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      await provider.generateImage(params);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({ text: expect.any(String) }),
                expect.objectContaining({
                  inlineData: {
                    data: 'input-image-data',
                    mimeType: 'image/jpeg',
                  },
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should pass through provider options (seed)', async () => {
      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
        providerOptions: {
          seed: 12345,
        },
      };

      await provider.generateImage(params);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            seed: 12345,
            responseModalities: ['IMAGE', 'TEXT'],
          }),
        })
      );
    });

    it('should calculate correct cost for each task type', async () => {
      const provider = new GeminiProvider();
      const testCases: Array<{ task: AITask; expectedCost: number }> = [
        { task: 'remove-bg', expectedCost: 2 },
        { task: 'upscale', expectedCost: 3 },
        { task: 'polish', expectedCost: 3 },
        { task: 'relight', expectedCost: 4 },
        { task: 'scene-gen', expectedCost: 5 },
        { task: 'try-on', expectedCost: 5 },
        { task: 'object-removal', expectedCost: 4 },
        { task: 'text-removal', expectedCost: 3 },
      ];

      for (const { task, expectedCost } of testCases) {
        mockGenerateContent.mockResolvedValueOnce({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: 'base64-data',
                      mimeType: 'image/png',
                    },
                  },
                ],
              },
            },
          ],
        });

        const result = await provider.generateImage({
          task,
          prompt: 'Test',
          model: 'gemini-2.5-flash-preview-05-20',
        });

        expect(result.cost).toBe(expectedCost);
      }
    });

    it('should use default cost for unknown task types', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64-data',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      });

      const provider = new GeminiProvider();
      const result = await provider.generateImage({
        task: 'unknown-task' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      });

      expect(result.cost).toBe(5);
    });

    it('should append user prompt to base prompt for non-scene-gen tasks', async () => {
      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'upscale' as AITask,
        inputUrl: 'https://example.com/input.jpg',
        prompt: 'Make it 4K quality',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      await provider.generateImage(params);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('Additional instructions: Make it 4K quality'),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should throw error when generateContent fails', async () => {
      const error = new Error('API rate limit exceeded');
      mockGenerateContent.mockRejectedValue(error);

      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      await expect(provider.generateImage(params)).rejects.toThrow(
        'API rate limit exceeded'
      );
    });

    it('should throw error when no candidates returned', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [],
      });

      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      await expect(provider.generateImage(params)).rejects.toThrow(
        'No response from Gemini'
      );
    });

    it('should throw error when no image in response', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'Some text response' }],
            },
          },
        ],
      });

      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      await expect(provider.generateImage(params)).rejects.toThrow(
        'No image generated'
      );
    });

    it('should measure duration correctly', async () => {
      mockGenerateContent.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: 'base64-data',
                      mimeType: 'image/png',
                    },
                  },
                ],
              },
            },
          ],
        };
      });

      const provider = new GeminiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-05-20',
      };

      const result = await provider.generateImage(params);

      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });
});
