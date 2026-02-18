import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZaiProvider } from '@/lib/ai/providers/zai.provider';
import type { GenerateImageParams } from '@/lib/ai/providers';
import type { AITask } from '@/types';

describe('ZaiProvider', () => {
  const originalEnv = process.env;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      ZAI_API_KEY: 'test-zai-api-key',
      ZAI_BASE_URL: 'https://api.z.ai/api/paas/v4',
    };
    vi.clearAllMocks();

    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with API key from environment', () => {
      const provider = new ZaiProvider();
      expect(provider).toBeDefined();
    });

    it('should use custom base URL from environment variable', () => {
      process.env.ZAI_BASE_URL = 'https://custom.z.ai/api';
      const provider = new ZaiProvider();
      expect(provider).toBeDefined();
    });

    it('should throw error if API key is missing', () => {
      delete process.env.ZAI_API_KEY;
      expect(() => new ZaiProvider()).toThrow(
        'ZAI_API_KEY environment variable is required'
      );
    });

    it('should use default base URL when not specified', () => {
      delete process.env.ZAI_BASE_URL;
      const provider = new ZaiProvider();
      expect(provider).toBeDefined();
    });
  });

  describe('generateImage', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'test-generation-id',
          model: 'z.ai-image-gen',
          data: [
            {
              url: 'https://api.z.ai/images/test-image-123.png',
              revised_prompt: 'Enhanced prompt description',
            },
          ],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 100,
            total_tokens: 150,
          },
        }),
      } as unknown as Response);
    });

    it('should generate image for text-to-image task (scene-gen)', async () => {
      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'A beautiful product photo',
        model: 'z.ai-image-gen',
      };

      const result = await provider.generateImage(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.z.ai/api/paas/v4/images/generations',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-zai-api-key',
          },
          body: expect.stringContaining('A beautiful product photo'),
        })
      );

      expect(result).toMatchObject({
        images: [{ url: 'https://api.z.ai/images/test-image-123.png' }],
        cost: 6,
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should generate image for remove-bg task with prompt engineering', async () => {
      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'remove-bg' as AITask,
        inputUrl: 'https://example.com/input.jpg',
        prompt: 'Custom prompt',
        model: 'z.ai-image-gen',
      };

      await provider.generateImage(params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('transparent or white background'),
        })
      );
    });

    it('should pass through provider options', async () => {
      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
        providerOptions: {
          size: '512x512',
          quality: 'hd',
          seed: 12345,
        },
      };

      await provider.generateImage(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody).toMatchObject({
        size: '512x512',
        quality: 'hd',
        seed: 12345,
      });
    });

    it('should calculate correct cost for each task type', async () => {
      const provider = new ZaiProvider();
      const testCases: Array<{ task: AITask; expectedCost: number }> = [
        { task: 'remove-bg', expectedCost: 3 },
        { task: 'upscale', expectedCost: 4 },
        { task: 'polish', expectedCost: 4 },
        { task: 'relight', expectedCost: 5 },
        { task: 'scene-gen', expectedCost: 6 },
        { task: 'try-on', expectedCost: 6 },
        { task: 'object-removal', expectedCost: 5 },
        { task: 'text-removal', expectedCost: 4 },
      ];

      for (const { task, expectedCost } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'test-id',
            model: 'z.ai-image-gen',
            data: [{ url: 'https://example.com/image.png' }],
          }),
        } as unknown as Response);

        const result = await provider.generateImage({
          task,
          prompt: 'Test',
          model: 'z.ai-image-gen',
        });

        expect(result.cost).toBe(expectedCost);
      }
    });

    it('should use default cost for unknown task types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'test-id',
          model: 'z.ai-image-gen',
          data: [{ url: 'https://example.com/image.png' }],
        }),
      } as unknown as Response);

      const provider = new ZaiProvider();
      const result = await provider.generateImage({
        task: 'unknown-task' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      });

      expect(result.cost).toBe(5);
    });

    it('should throw error when API returns error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Invalid prompt content',
            type: 'invalid_request_error',
            code: 'content_policy_violation',
          },
        }),
      } as unknown as Response);

      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      };

      await expect(provider.generateImage(params)).rejects.toThrow(
        'z.ai API error: Invalid prompt content'
      );
    });

    it('should throw error when API returns no image URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'test-id',
          model: 'z.ai-image-gen',
          data: [],
        }),
      } as unknown as Response);

      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      };

      await expect(provider.generateImage(params)).rejects.toThrow(
        'z.ai API returned no image URL'
      );
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      };

      await expect(provider.generateImage(params)).rejects.toThrow('Network error');
    });

    it('should measure duration correctly', async () => {
      mockFetch.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'test-id',
            model: 'z.ai-image-gen',
            data: [{ url: 'https://example.com/image.png' }],
          }),
        } as unknown as Response;
      });

      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      };

      const result = await provider.generateImage(params);

      expect(result.duration).toBeGreaterThanOrEqual(50);
    });

    it('should use default model when not specified in options', async () => {
      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'scene-gen' as AITask,
        prompt: 'Test',
        model: 'z.ai-image-gen',
      };

      await provider.generateImage(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.model).toBe('z.ai-image-gen');
    });

    it('should include inputUrl reference in prompt for editing tasks', async () => {
      const provider = new ZaiProvider();
      const params: GenerateImageParams = {
        task: 'upscale' as AITask,
        inputUrl: 'https://example.com/input.jpg',
        prompt: 'Make it 4K',
        model: 'z.ai-image-gen',
      };

      await provider.generateImage(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.prompt).toContain('https://example.com/input.jpg');
      expect(callBody.prompt).toContain('Make it 4K');
    });
  });

  describe('downloadImage', () => {
    it('should download image from URL', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer.buffer),
      } as unknown as Response);

      const provider = new ZaiProvider();
      const result = await provider.downloadImage('https://example.com/image.png');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.png');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw error when download fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as unknown as Response);

      const provider = new ZaiProvider();

      await expect(
        provider.downloadImage('https://example.com/missing.png')
      ).rejects.toThrow('Failed to download image: Not Found');
    });
  });
});
