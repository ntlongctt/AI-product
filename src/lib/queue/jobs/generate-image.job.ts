/**
 * Generate Image Job
 *
 * Handles AI image generation tasks with retry logic and fallback providers
 */

import { inngest, EVENTS } from '../client';
import { generationRepository } from '@/lib/db/repositories/generation.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { getStorageService } from '@/lib/storage';
import { getProviderForTask } from '@/lib/ai/router';

// =============================================================================
// Types
// =============================================================================

interface GenerateImageData {
  generationId: string;
  userId: string;
  projectId?: string;
  task: string;
  inputUrl: string;
  inputUrls?: string[];
  prompt?: string;
  options?: Record<string, unknown>;
  provider?: string;
  model?: string;
}

// =============================================================================
// Job Configuration
// =============================================================================

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 3;

// =============================================================================
// Job Handler
// =============================================================================

/**
 * Generate Image Job
 *
 * Processes AI generation requests with:
 * - Usage limit checking
 * - Provider routing with fallback
 * - Result storage
 * - Error handling and retries
 */
export const generateImageJob = inngest.createFunction(
  {
    id: 'generate-image',
    name: 'Generate AI Image',
    retries: MAX_RETRIES,
  },
  { event: EVENTS.AI_GENERATE_REQUESTED },
  async ({ event, step }) => {
    const data = event.data as GenerateImageData;
    const { generationId, userId, task, inputUrl, prompt, options, provider, model } = data;

    console.log(`[Generate Image] Starting:`, {
      generationId,
      task,
      userId,
    });

    // Step 1: Check usage limits
    await step.run('check-usage-limit', async () => {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const limits: Record<string, number> = {
        free: 10,
        pro: 100,
        agency: 500,
      };

      if (user.generationsUsed >= limits[user.plan]) {
        throw new Error(`Generation limit exceeded for user: ${userId}`);
      }

      return { allowed: true, plan: user.plan };
    });

    // Step 2: Mark generation as processing
    await step.run('mark-processing', async () => {
      await generationRepository.markProcessing(generationId);
      return { status: 'processing' };
    });

    // Step 3: Get provider configuration
    const providerConfig = await step.run('get-provider-config', async () => {
      // Use specified provider or get from router
      const config = getProviderForTask(task as never);
      return {
        primary: provider ?? config.primary,
        model: model ?? config.model,
        fallback: config.fallback,
      };
    });

    // Step 4: Execute AI generation
    // Note: Actual AI execution would call the provider here
    const result = await step.run('execute-generation', async () => {
      const startTime = Date.now();

      try {
        // Placeholder: In production, this would call the actual AI provider
        // For now, we'll simulate with the input URL
        console.log(`[Generate Image] Executing with provider:`, {
          provider: providerConfig.primary,
          model: providerConfig.model,
          task,
        });

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const durationMs = Date.now() - startTime;

        // For now, return the input URL as output
        // In production, this would be the actual generated image URL
        return {
          success: true,
          outputUrl: inputUrl, // Placeholder
          durationMs,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error(`[Generate Image] Execution failed:`, error);

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs,
        };
      }
    });

    // Step 5: Handle failure
    if (!result.success) {
      const errorMsg = 'error' in result ? result.error : 'Unknown error';
      await generationRepository.incrementRetryCount(generationId);
      await generationRepository.markFailed(generationId, errorMsg, 'GENERATION_FAILED');

      return {
        success: false,
        generationId,
        error: errorMsg,
      };
    }

    // Step 6: Upload result to storage
    const storageResult = await step.run('upload-result', async () => {
      const storage = getStorageService();
      const key = `generations/${userId}/${task}/${generationId}.png`;
      const outputUrl = 'outputUrl' in result ? result.outputUrl : inputUrl;

      await storage.uploadFromUrl(outputUrl, key, {
        contentType: 'image/png',
      });

      return { key, url: storage.getPublicUrl(key) };
    });

    // Step 7: Mark generation as completed
    await step.run('mark-completed', async () => {
      await generationRepository.markCompleted(
        generationId,
        storageResult.url,
        undefined,
        undefined,
        result.durationMs,
      );

      return { status: 'completed' };
    });

    // Step 8: Increment user usage
    await step.run('increment-usage', async () => {
      await userRepository.incrementGenerationsUsed(userId);
      return { incremented: true };
    });

    // Step 9: Send completion event
    await step.sendEvent('send-completion-event', {
      name: EVENTS.AI_GENERATE_COMPLETED,
      data: {
        generationId,
        userId,
        outputUrl: storageResult.url,
        task,
        durationMs: result.durationMs,
      },
    });

    console.log(`[Generate Image] Completed:`, {
      generationId,
      outputUrl: storageResult.url,
      durationMs: result.durationMs,
    });

    return {
      success: true,
      generationId,
      outputUrl: storageResult.url,
      durationMs: result.durationMs,
    };
  },
);

// =============================================================================
// Batch Generate Job
// =============================================================================

interface BatchGenerateData {
  batchId: string;
  userId: string;
  items: Array<{
    generationId: string;
    task: string;
    inputUrl: string;
    prompt?: string;
  }>;
}

/**
 * Batch Generate Job
 *
 * Processes multiple generation requests in parallel
 */
export const batchGenerateJob = inngest.createFunction(
  {
    id: 'batch-generate',
    name: 'Batch Generate AI Images',
    retries: 1,
  },
  { event: EVENTS.BATCH_GENERATE_REQUESTED },
  async ({ event, step }) => {
    const data = event.data as BatchGenerateData;
    const { batchId, userId, items } = data;

    console.log(`[Batch Generate] Starting batch:`, {
      batchId,
      itemCount: items.length,
    });

    // Send individual generation events
    await step.sendEvent(
      'send-generation-events',
      items.map((item) => ({
        name: EVENTS.AI_GENERATE_REQUESTED,
        data: {
          generationId: item.generationId,
          userId,
          task: item.task,
          inputUrl: item.inputUrl,
          prompt: item.prompt,
        },
      })),
    );

    return {
      success: true,
      batchId,
      itemsTriggered: items.length,
    };
  },
);
