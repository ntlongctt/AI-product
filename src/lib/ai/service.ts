import type { AITask, AIProvider } from '@/types';
import type {
  GenerateImageParams,
  GenerateImageResult,
  ImageGenerationProvider,
} from './providers';
import { createImageProvider } from './providers';
import { getProviderForTask, getFallbackProvider } from './router';
import {
  getJobStore,
  type JobInput,
  type JobResult,
  type JobStatus,
} from './job-store';
import {
  getStorageService,
  type SaveImageResult,
} from '@/lib/storage/service';
import { generateId } from '@/lib/utils';

/**
 * Input for AI generation
 */
export interface GenerateInput {
  task: AITask;
  inputUrl?: string;
  inputUrls?: string[];
  prompt?: string;
  options?: Record<string, unknown>;
}

/**
 * Result from synchronous generation
 */
export interface GenerateResult {
  success: boolean;
  outputUrl?: string;
  outputUrls?: string[];
  localPath?: string;        // Absolute path to saved file
  localPaths?: string[];     // For multiple images
  publicUrl?: string;        // URL to serve the image
  publicUrls?: string[];     // For multiple images
  duration: number;
  cost: number;
  provider: AIProvider;
  model: string;
  error?: string;
}

/**
 * Result from async generation initiation
 */
export interface AsyncGenerateResult {
  success: true;
  jobId: string;
  status: JobStatus;
}

/**
 * Job status response
 */
export interface JobStatusResult {
  success: boolean;
  jobId: string;
  status: JobStatus;
  task: AITask;
  result?: JobResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * AI Service - Orchestrates sync and async execution modes
 * Handles provider routing, fallback logic, and job management
 */
export class AIService {
  private jobStore = getJobStore();

  /**
   * Synchronous execution - waits for result
   * Attempts primary provider, falls back if configured and primary fails
   */
  async generateSync(input: GenerateInput): Promise<GenerateResult> {
    const config = getProviderForTask(input.task);

    try {
      // Try primary provider
      const result = await this.executeWithProvider(
        input,
        config.primary,
        config.model
      );

      // Save images to disk
      const storageService = getStorageService();
      const savedImages = await this.saveGeneratedImages(
        storageService,
        result,
        input.task
      );

      return {
        success: true,
        outputUrl: result.images[0]?.url,
        outputUrls: result.images.map((img) => img.url),
        localPath: savedImages[0]?.filePath,
        localPaths: savedImages.map((img) => img.filePath),
        publicUrl: savedImages[0]?.publicUrl,
        publicUrls: savedImages.map((img) => img.publicUrl),
        duration: result.duration,
        cost: result.cost,
        provider: config.primary,
        model: config.model,
      };
    } catch (error) {
      const primaryError =
        error instanceof Error ? error.message : 'Unknown error';

      // Try fallback if available
      if (config.fallback) {
        try {
          const fallbackModel = this.getFallbackModel(config.fallback);
          const result = await this.executeWithProvider(
            input,
            config.fallback,
            fallbackModel
          );

          // Save images to disk
          const storageService = getStorageService();
          const savedImages = await this.saveGeneratedImages(
            storageService,
            result,
            input.task
          );

          return {
            success: true,
            outputUrl: result.images[0]?.url,
            outputUrls: result.images.map((img) => img.url),
            localPath: savedImages[0]?.filePath,
            localPaths: savedImages.map((img) => img.filePath),
            publicUrl: savedImages[0]?.publicUrl,
            publicUrls: savedImages.map((img) => img.publicUrl),
            duration: result.duration,
            cost: result.cost,
            provider: config.fallback,
            model: fallbackModel,
          };
        } catch (fallbackError) {
          const fallbackErrorMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Unknown error';

          return {
            success: false,
            duration: 0,
            cost: 0,
            provider: config.primary,
            model: config.model,
            error: `Primary provider failed: ${primaryError}. Fallback provider failed: ${fallbackErrorMessage}`,
          };
        }
      }

      // No fallback available
      return {
        success: false,
        duration: 0,
        cost: 0,
        provider: config.primary,
        model: config.model,
        error: primaryError,
      };
    }
  }

  /**
   * Asynchronous execution - returns job ID immediately
   * Job is processed in the background
   */
  async generateAsync(input: GenerateInput): Promise<AsyncGenerateResult> {
    const jobId = generateId();
    const config = getProviderForTask(input.task);

    // Create job record
    const jobInput: JobInput = {
      task: input.task,
      inputUrl: input.inputUrl,
      inputUrls: input.inputUrls,
      prompt: input.prompt,
      options: input.options,
    };

    await this.jobStore.create({
      id: jobId,
      status: 'pending',
      task: input.task,
      provider: config.primary,
      input: jobInput,
    });

    // Start async processing (don't await)
    this.processJobAsync(jobId, input).catch(console.error);

    return {
      success: true,
      jobId,
      status: 'pending',
    };
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatusResult | null> {
    const job = await this.jobStore.get(jobId);

    if (!job) {
      return null;
    }

    return {
      success: true,
      jobId: job.id,
      status: job.status,
      task: job.task,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  }

  /**
   * Execute generation with a specific provider
   */
  private async executeWithProvider(
    input: GenerateInput,
    provider: AIProvider,
    model: string
  ): Promise<GenerateImageResult> {
    const providerInstance = await createImageProvider(provider);

    const params: GenerateImageParams = {
      task: input.task,
      prompt: this.buildPrompt(input),
      model,
      inputUrl: input.inputUrl,
      providerOptions: {
        ...input.options,
        // Include inputUrls for try-on task
        ...(input.inputUrls && { inputUrls: input.inputUrls }),
      },
    };

    return providerInstance.generateImage(params);
  }

  /**
   * Save generated images to disk
   */
  private async saveGeneratedImages(
    storageService: ReturnType<typeof getStorageService>,
    result: GenerateImageResult,
    task: AITask
  ): Promise<SaveImageResult[]> {
    const savedImages: SaveImageResult[] = [];

    for (const image of result.images) {
      if (image.url) {
        const saved = await storageService.saveImage(image.url, task);
        savedImages.push(saved);
      }
    }

    return savedImages;
  }

  /**
   * Process job asynchronously
   */
  private async processJobAsync(
    jobId: string,
    input: GenerateInput
  ): Promise<void> {
    // Update status to processing
    await this.jobStore.update(jobId, { status: 'processing' });

    try {
      const result = await this.generateSync(input);

      if (result.success) {
        await this.jobStore.update(jobId, {
          status: 'completed',
          result: {
            outputUrl: result.outputUrl,
            outputUrls: result.outputUrls,
            localPath: result.localPath,
            localPaths: result.localPaths,
            publicUrl: result.publicUrl,
            publicUrls: result.publicUrls,
            duration: result.duration,
            cost: result.cost,
          },
          completedAt: new Date(),
        });
      } else {
        await this.jobStore.update(jobId, {
          status: 'failed',
          error: result.error,
          completedAt: new Date(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.jobStore.update(jobId, {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Build prompt based on task type and input
   */
  private buildPrompt(input: GenerateInput): string {
    const { task, prompt } = input;

    // If explicit prompt provided, use it
    if (prompt) {
      return prompt;
    }

    // Otherwise, build task-specific default prompt
    switch (task) {
      case 'remove-bg':
        return 'Remove the background from this product image, keeping only the product on a transparent or pure white background. Professional product photography style.';

      case 'scene-gen':
        return 'Professional product photography with studio lighting, clean composition, high quality.';

      case 'try-on':
        return 'Fashion model wearing the garment naturally, professional fashion photography, appropriate lighting and pose.';

      case 'upscale':
        return 'Enhance and upscale this image while preserving details and improving quality.';

      case 'polish':
        return 'Polish and enhance this image with improved lighting, clarity, and professional quality.';

      case 'relight':
        return 'Adjust lighting on this image for professional product photography look.';

      case 'object-removal':
        return 'Remove unwanted objects from this image seamlessly.';

      case 'text-removal':
        return 'Remove all text from this image while preserving the background naturally.';

      default:
        return 'Process this image with professional quality results.';
    }
  }

  /**
   * Get the default model for a fallback provider
   */
  private getFallbackModel(provider: AIProvider): string {
    switch (provider) {
      case 'gemini':
        return 'gemini-2.5-flash-preview-05-20';
      case 'zai':
        return 'glm-image';
      default:
        return 'gemini-2.5-flash-preview-05-20';
    }
  }
}

// Singleton instance for application use
let globalAIService: AIService | null = null;

/**
 * Get the global AI service instance
 */
export function getAIService(): AIService {
  if (!globalAIService) {
    globalAIService = new AIService();
  }
  return globalAIService;
}

/**
 * Set a custom AI service (useful for testing)
 */
export function setAIService(service: AIService): void {
  globalAIService = service;
}

/**
 * Reset the global AI service (useful for testing)
 */
export function resetAIService(): void {
  globalAIService = null;
}
