import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { AIService, setAIService, resetAIService } from '@/lib/ai/service';
import {
  InMemoryJobStore,
  setJobStore,
  resetJobStore,
} from '@/lib/ai/job-store';
import {
  StorageService,
  setStorageService,
  resetStorageService,
} from '@/lib/storage/service';

// Mock the providers
vi.mock('@/lib/ai/providers', () => ({
  createImageProvider: vi.fn(),
}));

import { createImageProvider } from '@/lib/ai/providers';

const mockCreateImageProvider = vi.mocked(createImageProvider);

describe('Full Generation Flow', () => {
  let service: AIService;
  let mockJobStore: InMemoryJobStore;
  let storageService: StorageService;
  let testStoragePath: string;

  // Create a simple 1x1 pixel PNG in base64
  const testBase64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const testDataUrl = `data:image/png;base64,${testBase64Image}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAIService();
    resetJobStore();
    resetStorageService();

    // Create a temporary test directory
    testStoragePath = path.join(process.cwd(), 'tmp', 'test-generated', Date.now().toString());

    // Create fresh storage service with test directory
    storageService = new StorageService({
      storagePath: testStoragePath,
      publicUrl: '/generated',
    });
    setStorageService(storageService);

    // Create fresh job store for each test
    mockJobStore = new InMemoryJobStore();
    setJobStore(mockJobStore);

    // Create fresh service instance
    service = new AIService();

    // Ensure test directory exists
    await storageService.ensureDirectory();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up test files
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Sync Generation', () => {
    it('should generate image from prompt and save to disk', async () => {
      const mockResult = {
        images: [{ url: testDataUrl }],
        duration: 1500,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const result = await service.generateSync({
        task: 'scene-gen',
        prompt: 'A red apple on a table',
      });

      // Verify generation succeeded
      expect(result.success).toBe(true);
      expect(result.outputUrl).toBe(testDataUrl);

      // Verify local paths are included
      expect(result.localPath).toBeDefined();
      expect(result.localPath).toContain(testStoragePath);
      expect(result.publicUrl).toMatch(/^\/generated\//);

      // Verify file exists on disk
      const fileExists = await fs
        .access(result.localPath!)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content is valid PNG
      const fileContent = await fs.readFile(result.localPath!);
      expect(fileContent.toString('base64')).toBe(testBase64Image);
    });

    it('should handle multiple output images', async () => {
      const mockResult = {
        images: [{ url: testDataUrl }, { url: testDataUrl }],
        duration: 2000,
        cost: 10,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const result = await service.generateSync({
        task: 'scene-gen',
        prompt: 'Generate multiple images',
      });

      // Verify multiple images saved
      expect(result.outputUrls).toHaveLength(2);
      expect(result.localPaths).toHaveLength(2);
      expect(result.publicUrls).toHaveLength(2);

      // Verify all files exist
      for (const localPath of result.localPaths!) {
        const fileExists = await fs
          .access(localPath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should handle HTTP URL from provider', async () => {
      // Mock fetch for downloading HTTP image
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'image/png']]),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from(testBase64Image, 'base64');
          },
        },
      });
      global.fetch = mockFetch;

      const mockResult = {
        images: [{ url: 'https://example.com/image.png' }],
        duration: 1500,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const result = await service.generateSync({
        task: 'scene-gen',
        prompt: 'A product photo',
      });

      expect(result.success).toBe(true);
      expect(result.localPath).toBeDefined();
      expect(result.publicUrl).toBeDefined();
    });
  });

  describe('Async Generation', () => {
    it('should handle async generation flow with file saving', async () => {
      const mockResult = {
        images: [{ url: testDataUrl }],
        duration: 1500,
        cost: 5,
      };

      mockCreateImageProvider.mockResolvedValue({
        generateImage: vi.fn().mockResolvedValue(mockResult),
      } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      // Start async generation
      const asyncResult = await service.generateAsync({
        task: 'scene-gen',
        prompt: 'Async test',
      });

      expect(asyncResult.success).toBe(true);
      expect(asyncResult.jobId).toBeDefined();

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Poll job status until completed or failed
      let jobStatus = await service.getJobStatus(asyncResult.jobId);
      let attempts = 0;
      while (
        jobStatus?.status === 'pending' ||
        (jobStatus?.status === 'processing' && attempts < 10)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        jobStatus = await service.getJobStatus(asyncResult.jobId);
        attempts++;
      }

      // Verify job completed successfully
      expect(jobStatus?.status).toBe('completed');
      expect(jobStatus?.result).toBeDefined();
      expect(jobStatus?.result?.localPath).toBeDefined();
      expect(jobStatus?.result?.publicUrl).toBeDefined();
      expect(jobStatus?.result?.outputUrl).toBe(testDataUrl);

      // Verify file exists on disk
      const fileExists = await fs
        .access(jobStatus!.result!.localPath!)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should store error in job when generation fails', async () => {
      mockCreateImageProvider.mockRejectedValue(
        new Error('Provider API error')
      );

      const asyncResult = await service.generateAsync({
        task: 'relight',
        prompt: 'Will fail',
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const jobStatus = await service.getJobStatus(asyncResult.jobId);
      expect(jobStatus?.status).toBe('failed');
      expect(jobStatus?.error).toContain('Provider API error');
    });
  });

  describe('Fallback Provider', () => {
    it('should save image from fallback provider when primary fails', async () => {
      const fallbackResult = {
        images: [{ url: testDataUrl }],
        duration: 2000,
        cost: 6,
      };

      mockCreateImageProvider
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          generateImage: vi.fn().mockResolvedValue(fallbackResult),
        } as unknown as Awaited<ReturnType<typeof createImageProvider>>);

      const result = await service.generateSync({
        task: 'scene-gen',
        prompt: 'Fallback test',
      });

      expect(result.success).toBe(true);
      expect(result.localPath).toBeDefined();
      expect(result.publicUrl).toBeDefined();

      // Verify file exists
      const fileExists = await fs
        .access(result.localPath!)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});
