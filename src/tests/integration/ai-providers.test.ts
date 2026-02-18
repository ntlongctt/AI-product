import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createImageProvider } from '@/lib/ai/providers';
import { getProviderForTask } from '@/lib/ai/router';
import type { AITask, AIProvider } from '@/types';

// MSW Server for mocking external APIs
const server = setupServer();

describe('AI Providers Integration', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Provider Factory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        GEMINI_API_KEY: 'test-gemini-key',
        ZAI_API_KEY: 'test-zai-key',
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should create Gemini provider', async () => {
      const provider = await createImageProvider('gemini');
      expect(provider).toBeDefined();
      expect(typeof provider.generateImage).toBe('function');
    });

    it('should create z.ai provider', async () => {
      const provider = await createImageProvider('zai');
      expect(provider).toBeDefined();
      expect(typeof provider.generateImage).toBe('function');
    });

    it('should throw error for unknown provider', async () => {
      await expect(
        createImageProvider('unknown' as AIProvider)
      ).rejects.toThrow('Unknown AI provider: unknown');
    });
  });

  describe('End-to-End Generation Flow', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        GEMINI_API_KEY: 'test-gemini-key',
        ZAI_API_KEY: 'test-zai-key',
      };

      // Mock Gemini API
      server.use(
        http.post(
          'https://generativelanguage.googleapis.com/v1beta/models/*',
          () => {
            return HttpResponse.json({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'image/png',
                          data: 'mocked-base64-image-data',
                        },
                      },
                    ],
                  },
                },
              ],
            });
          }
        )
      );

      // Mock z.ai API
      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', () => {
          return HttpResponse.json({
            id: 'test-generation-id',
            model: 'z.ai-image-gen',
            data: [
              {
                url: 'https://api.z.ai/images/test-image.png',
                revised_prompt: 'Enhanced prompt',
              },
            ],
          });
        })
      );
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should complete full flow: router -> provider -> API', async () => {
      // Step 1: Get provider from router
      const task: AITask = 'scene-gen';
      const config = getProviderForTask(task);
      expect(config.primary).toBe('zai');

      // Step 2: Create provider
      const provider = await createImageProvider(config.primary);

      // Step 3: Generate image
      const result = await provider.generateImage({
        task,
        prompt: 'A beautiful product scene',
        model: config.model,
      });

      // Step 4: Verify result
      expect(result).toHaveProperty('images');
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toHaveProperty('url');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('cost');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should verify routing configuration for different task types', async () => {
      const testCases: Array<{ task: AITask; expectedProvider: AIProvider }> = [
        { task: 'scene-gen', expectedProvider: 'zai' },
        { task: 'remove-bg', expectedProvider: 'gemini' },
        { task: 'upscale', expectedProvider: 'gemini' },
      ];

      for (const { task, expectedProvider } of testCases) {
        const config = getProviderForTask(task);
        expect(config.primary).toBe(expectedProvider);
      }
    });

    it('should handle z.ai task generation end-to-end', async () => {
      const task: AITask = 'scene-gen';
      const config = getProviderForTask(task);
      expect(config.primary).toBe('zai');

      const provider = await createImageProvider(config.primary);
      const result = await provider.generateImage({
        task,
        prompt: 'Test prompt',
        model: config.model,
      });

      expect(result).toHaveProperty('images');
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toHaveProperty('url');
      expect(result.cost).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        GEMINI_API_KEY: 'test-gemini-key',
        ZAI_API_KEY: 'test-zai-key',
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should handle API rate limit errors', async () => {
      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', () => {
          return HttpResponse.json(
            {
              error: {
                message: 'Rate limit exceeded',
                type: 'rate_limit_error',
                code: 'rate_limit_exceeded',
              },
            },
            { status: 429 }
          );
        })
      );

      const provider = await createImageProvider('zai');

      await expect(
        provider.generateImage({
          task: 'scene-gen',
          prompt: 'Test',
          model: 'z.ai-image-gen',
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle invalid API key errors', async () => {
      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', () => {
          return HttpResponse.json(
            {
              error: {
                message: 'Invalid API key',
                type: 'authentication_error',
                code: 'invalid_api_key',
              },
            },
            { status: 401 }
          );
        })
      );

      const provider = await createImageProvider('zai');

      await expect(
        provider.generateImage({
          task: 'scene-gen',
          prompt: 'Test',
          model: 'z.ai-image-gen',
        })
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle content policy violations', async () => {
      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', () => {
          return HttpResponse.json(
            {
              error: {
                message: 'Content policy violation',
                type: 'invalid_request_error',
                code: 'content_policy_violation',
              },
            },
            { status: 400 }
          );
        })
      );

      const provider = await createImageProvider('zai');

      await expect(
        provider.generateImage({
          task: 'scene-gen',
          prompt: 'Inappropriate content',
          model: 'z.ai-image-gen',
        })
      ).rejects.toThrow('Content policy violation');
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', () => {
          return HttpResponse.error();
        })
      );

      const provider = await createImageProvider('zai');

      await expect(
        provider.generateImage({
          task: 'scene-gen',
          prompt: 'Test',
          model: 'z.ai-image-gen',
        })
      ).rejects.toThrow();
    });
  });

  describe('Provider Options Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        GEMINI_API_KEY: 'test-gemini-key',
        ZAI_API_KEY: 'test-zai-key',
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should pass size option to z.ai API', async () => {
      let requestBody: Record<string, unknown> | null = null;

      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'test-id',
            model: 'z.ai-image-gen',
            data: [{ url: 'https://example.com/image.png' }],
          });
        })
      );

      const provider = await createImageProvider('zai');
      await provider.generateImage({
        task: 'scene-gen',
        prompt: 'Test',
        model: 'z.ai-image-gen',
        providerOptions: {
          size: '512x512',
        },
      });

      expect(requestBody).toMatchObject({
        size: '512x512',
      });
    });

    it('should pass quality option to z.ai API', async () => {
      let requestBody: Record<string, unknown> | null = null;

      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'test-id',
            model: 'z.ai-image-gen',
            data: [{ url: 'https://example.com/image.png' }],
          });
        })
      );

      const provider = await createImageProvider('zai');
      await provider.generateImage({
        task: 'scene-gen',
        prompt: 'Test',
        model: 'z.ai-image-gen',
        providerOptions: {
          quality: 'hd',
        },
      });

      expect(requestBody).toMatchObject({
        quality: 'hd',
      });
    });

    it('should pass seed option to z.ai API', async () => {
      let requestBody: Record<string, unknown> | null = null;

      server.use(
        http.post('https://api.z.ai/api/paas/v4/images/generations', async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'test-id',
            model: 'z.ai-image-gen',
            data: [{ url: 'https://example.com/image.png' }],
          });
        })
      );

      const provider = await createImageProvider('zai');
      await provider.generateImage({
        task: 'scene-gen',
        prompt: 'Test',
        model: 'z.ai-image-gen',
        providerOptions: {
          seed: 12345,
        },
      });

      expect(requestBody).toMatchObject({
        seed: 12345,
      });
    });
  });
});
