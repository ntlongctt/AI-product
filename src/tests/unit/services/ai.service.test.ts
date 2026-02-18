import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AITask, AIProvider } from '@/types';
import {
  AIService,
  type GenerateInput,
  type GenerateResult,
  type AsyncGenerateResult,
  type JobStatusResult,
  getAIService,
  setAIService,
  resetAIService,
} from '@/lib/ai/service';
import {
  InMemoryJobStore,
  setJobStore,
  resetJobStore,
  type Job,
} from '@/lib/ai/job-store';
import {
  setStorageService,
  resetStorageService,
} from '@/lib/storage/service';

// Mock the providers
vi.mock('@/lib/ai/providers', () => ({
  createImageProvider: vi.fn(),
}));

// Mock the storage service
vi.mock('@/lib/storage/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/service')>('@/lib/storage/service');
  return {
    ...actual,
    getStorageService: vi.fn().mockReturnValue({
      saveImage: vi.fn().mockResolvedValue({
        filePath: '/mock/path/image.png',
        publicUrl: '/generated/image.png',
        fileName: 'image.png',
      }),
      saveImages: vi.fn().mockResolvedValue([
        {
          filePath: '/mock/path/image1.png',
          publicUrl: '/generated/image1.png',
          fileName: 'image1.png',
        },
        {
          filePath: '/mock/path/image2.png',
          publicUrl: '/generated/image2.png',
          fileName: 'image2.png',
        },
      ]),
    }),
  };
});

import { createImageProvider } from '@/lib/ai/providers';

const mockCreateImageProvider = vi.mocked(createImageProvider);

describe('AIService', () => {
  let service: AIService;
  let mockJobStore: InMemoryJobStore;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAIService();
    resetJobStore();
    resetStorageService();

    // Create fresh job store for each test
    mockJobStore = new InMemoryJobStore();
    setJobStore(mockJobStore);

    // Create fresh service instance
    service = new AIService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateSync', () => {
    it('should generate image successfully with primary provider', async () => {
      const mockResult = {
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1500,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'A beautiful product photo',
      };

      const result: GenerateResult = await service.generateSync(input);

      expect(result.success).toBe(true);
      expect(result.outputUrl).toBe('https://example.com/output.png');
      expect(result.outputUrls).toEqual(['https://example.com/output.png']);
      expect(result.duration).toBe(1500);
      expect(result.cost).toBe(5);
      expect(result.provider).toBe('zai');
      expect(result.model).toBe('glm-image');
    });

    it('should use fallback provider when primary fails', async () => {
      const primaryError = new Error('Primary provider failed');
      const fallbackResult = {
        images: [{ url: 'https://example.com/fallback.png' }],
        duration: 2000,
        cost: 6,
      };

      mockCreateImageProvider
        .mockRejectedValueOnce(primaryError)
        .mockResolvedValueOnce({
          generateImage: vi.fn().mockResolvedValue(fallbackResult),
        } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test prompt',
      };

      const result: GenerateResult = await service.generateSync(input);

      expect(result.success).toBe(true);
      expect(result.outputUrl).toBe('https://example.com/fallback.png');
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-2.5-flash-preview-05-20');
    });

    it('should return error when both primary and fallback fail', async () => {
      mockCreateImageProvider.mockRejectedValue(new Error('Provider failed'));

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test prompt',
      };

      const result: GenerateResult = await service.generateSync(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Primary provider failed');
      expect(result.error).toContain('Fallback provider failed');
      expect(result.duration).toBe(0);
      expect(result.cost).toBe(0);
    });

    it('should return error when no fallback is configured', async () => {
      mockCreateImageProvider.mockRejectedValue(new Error('Provider failed'));

      const input: GenerateInput = {
        task: 'relight',
        prompt: 'Test prompt',
      };

      const result: GenerateResult = await service.generateSync(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider failed');
      expect(result.provider).toBe('gemini');
    });

    it('should not interact with job store', async () => {
      const mockResult = {
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      await service.generateSync(input);

      const jobs = await mockJobStore.list();
      expect(jobs).toHaveLength(0);
    });

    it('should handle multiple output images', async () => {
      const mockResult = {
        images: [
          { url: 'https://example.com/1.png' },
          { url: 'https://example.com/2.png' },
        ],
        duration: 2000,
        cost: 10,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const result: GenerateResult = await service.generateSync(input);

      expect(result.outputUrls).toHaveLength(2);
      expect(result.outputUrls).toEqual([
        'https://example.com/1.png',
        'https://example.com/2.png',
      ]);
    });
  });

  describe('generateAsync', () => {
    it('should create job in store and return jobId', async () => {
      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'A beautiful product photo',
      };

      const result: AsyncGenerateResult = await service.generateAsync(input);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.status).toBe('pending');

      // Check job was created
      const job = await mockJobStore.get(result.jobId);
      expect(job).toBeDefined();
      expect(job?.task).toBe('scene-gen');
      // Job may be pending or processing depending on timing
      expect(['pending', 'processing']).toContain(job?.status);
    });

    it('should return jobId immediately', async () => {
      const input: GenerateInput = {
        task: 'remove-bg',
        inputUrl: 'https://example.com/input.png',
      };

      const result: AsyncGenerateResult = await service.generateAsync(input);

      expect(typeof result.jobId).toBe('string');
      expect(result.jobId.length).toBeGreaterThan(0);
    });

    it('should store input params in job', async () => {
      const input: GenerateInput = {
        task: 'upscale',
        inputUrl: 'https://example.com/input.png',
        prompt: 'Custom prompt',
        options: { size: '1024x1024' },
      };

      const result: AsyncGenerateResult = await service.generateAsync(input);
      const job = await mockJobStore.get(result.jobId);

      expect(job?.input.task).toBe('upscale');
      expect(job?.input.inputUrl).toBe('https://example.com/input.png');
      expect(job?.input.prompt).toBe('Custom prompt');
      expect(job?.input.options).toEqual({ size: '1024x1024' });
    });

    it('should store inputUrls for try-on task', async () => {
      const input: GenerateInput = {
        task: 'try-on',
        inputUrls: ['https://example.com/model.png', 'https://example.com/garment.png'],
        prompt: 'Fashion photo',
      };

      const result: AsyncGenerateResult = await service.generateAsync(input);
      const job = await mockJobStore.get(result.jobId);

      expect(job?.input.inputUrls).toEqual([
        'https://example.com/model.png',
        'https://example.com/garment.png',
      ]);
    });
  });

  describe('getJobStatus', () => {
    it('should return job for valid jobId', async () => {
      const mockResult = {
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      // Create and process a job
      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const asyncResult = await service.generateAsync(input);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status: JobStatusResult | null = await service.getJobStatus(asyncResult.jobId);

      expect(status).toBeDefined();
      expect(status?.jobId).toBe(asyncResult.jobId);
      expect(status?.task).toBe('scene-gen');
    });

    it('should return null for invalid jobId', async () => {
      const status = await service.getJobStatus('non-existent-job');
      expect(status).toBeNull();
    });

    it('should include all job metadata', async () => {
      const input: GenerateInput = {
        task: 'polish',
        inputUrl: 'https://example.com/input.png',
      };

      const asyncResult = await service.generateAsync(input);
      const status = await service.getJobStatus(asyncResult.jobId);

      expect(status).toMatchObject({
        success: true,
        jobId: asyncResult.jobId,
        status: expect.any(String),
        task: 'polish',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('fallback behavior by task', () => {
    const fallbackTestCases: Array<{
      task: AITask;
      hasFallback: boolean;
      expectedFallback?: AIProvider;
    }> = [
      { task: 'scene-gen', hasFallback: true, expectedFallback: 'gemini' },
      { task: 'remove-bg', hasFallback: true, expectedFallback: 'zai' },
      { task: 'upscale', hasFallback: true, expectedFallback: 'zai' },
      { task: 'polish', hasFallback: true, expectedFallback: 'zai' },
      { task: 'relight', hasFallback: false },
      { task: 'try-on', hasFallback: true, expectedFallback: 'zai' },
      { task: 'object-removal', hasFallback: true, expectedFallback: 'zai' },
      { task: 'text-removal', hasFallback: false },
    ];

    it.each(fallbackTestCases)(
      'should handle fallback correctly for $task',
      async ({ task, hasFallback, expectedFallback }) => {
        const primaryError = new Error('Primary failed');
        const fallbackResult = {
          images: [{ url: 'https://example.com/fallback.png' }],
          duration: 1000,
          cost: 5,
        };

        if (hasFallback) {
          mockCreateImageProvider
            .mockRejectedValueOnce(primaryError)
            .mockResolvedValueOnce({
              generateImage: vi.fn().mockResolvedValue(fallbackResult),
            } as unknown as Awaited<ReturnType<typeof createImageProvider>>);
        } else {
          mockCreateImageProvider.mockRejectedValue(primaryError);
        }

        const input: GenerateInput = {
          task,
          prompt: 'Test',
        };

        const result = await service.generateSync(input);

        if (hasFallback) {
          expect(result.success).toBe(true);
          expect(result.provider).toBe(expectedFallback);
          expect(mockCreateImageProvider).toHaveBeenCalledTimes(2);
        } else {
          expect(result.success).toBe(false);
          expect(mockCreateImageProvider).toHaveBeenCalledTimes(1);
        }
      }
    );
  });

  describe('error handling', () => {
    it('should handle provider initialization errors', async () => {
      mockCreateImageProvider.mockRejectedValue(new Error('Failed to initialize provider'));

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const result = await service.generateSync(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize');
    });

    it('should handle API errors with fallback', async () => {
      const apiError = new Error('API rate limit exceeded');
      const fallbackResult = {
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      };

      mockCreateImageProvider
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce({
          generateImage: vi.fn().mockResolvedValue(fallbackResult),
        } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const result = await service.generateSync(input);

      expect(result.success).toBe(true);
      expect(result.outputUrl).toBeDefined();
    });

    it('should include error details in failed result', async () => {
      mockCreateImageProvider.mockRejectedValue(new Error('Network timeout'));

      const input: GenerateInput = {
        task: 'relight',
        prompt: 'Test',
      };

      const result = await service.generateSync(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.duration).toBe(0);
      expect(result.cost).toBe(0);
    });
  });

  describe('buildPrompt', () => {
    it('should use explicit prompt when provided', async () => {
      const mockGenerateImage = vi.fn().mockResolvedValue({
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      });

      mockCreateImageProvider.mockResolvedValue({
        generateImage: mockGenerateImage,
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'My custom prompt',
      };

      await service.generateSync(input);

      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'My custom prompt',
        })
      );
    });

    it('should build default prompt for task when no prompt provided', async () => {
      const mockGenerateImage = vi.fn().mockResolvedValue({
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      });

      mockCreateImageProvider.mockResolvedValue({
        generateImage: mockGenerateImage,
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'remove-bg',
        inputUrl: 'https://example.com/input.png',
      };

      await service.generateSync(input);

      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Remove the background'),
        })
      );
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getAIService', () => {
      const service1 = getAIService();
      const service2 = getAIService();

      expect(service1).toBe(service2);
    });

    it('should allow setting custom service', () => {
      const customService = new AIService();
      setAIService(customService);

      const retrievedService = getAIService();
      expect(retrievedService).toBe(customService);
    });

    it('should create new instance after reset', () => {
      const service1 = getAIService();
      resetAIService();
      const service2 = getAIService();

      expect(service1).not.toBe(service2);
    });
  });

  describe('job store integration', () => {
    it('should use global job store', async () => {
      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const result = await service.generateAsync(input);
      const job = await mockJobStore.get(result.jobId);

      expect(job).toBeDefined();
    });

    it('should update job status during async processing', async () => {
      const mockResult = {
        images: [{ url: 'https://example.com/output.png' }],
        duration: 1000,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const input: GenerateInput = {
        task: 'scene-gen',
        prompt: 'Test',
      };

      const asyncResult = await service.generateAsync(input);

      // Job should exist (status may be pending or processing depending on timing)
      let job = await mockJobStore.get(asyncResult.jobId);
      expect(job).toBeDefined();
      expect(['pending', 'processing']).toContain(job?.status);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check completed status
      job = await mockJobStore.get(asyncResult.jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result?.outputUrl).toBe('https://example.com/output.png');
      expect(job?.completedAt).toBeDefined();
    });

    it('should store error in job when async processing fails', async () => {
      mockCreateImageProvider.mockRejectedValue(new Error('Processing failed'));

      const input: GenerateInput = {
        task: 'relight',
        prompt: 'Test',
      };

      const asyncResult = await service.generateAsync(input);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = await mockJobStore.get(asyncResult.jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Processing failed');
      expect(job?.completedAt).toBeDefined();
    });
  });
});
