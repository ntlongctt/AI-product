import { NextRequest, NextResponse } from 'next/server';
import { sceneGenSchema } from '@/lib/validations/ai';
import { generateId } from '@/lib/utils';
import { getJobStore } from '@/lib/ai/job-store';
import { getAIService } from '@/lib/ai/service';

/**
 * POST /api/ai/tasks/scene-gen
 * Specialized endpoint for scene generation
 * Accepts a product image and scene description, returns a job ID for polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = sceneGenSchema.parse(body);

    // Create job ID immediately
    const jobId = generateId();
    const jobStore = getJobStore();

    // Store initial job state
    await jobStore.create({
      id: jobId,
      status: 'pending',
      task: 'scene-gen',
      input: {
        task: 'scene-gen',
        inputUrl: validated.productImage,
        prompt: validated.sceneDescription,
        options: {
          ...validated.options,
          projectId: validated.projectId,
        },
      },
    });

    // Start async processing (fire and forget)
    processSceneGenJob(jobId, validated).catch(console.error);

    // Return job ID immediately for polling
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          status: 'pending',
          task: 'scene-gen',
          message: 'Scene generation job queued for processing',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Scene Gen Error]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to queue scene generation job' },
      { status: 500 }
    );
  }
}

// Async job processor for scene generation
async function processSceneGenJob(
  jobId: string,
  validated: {
    productImage: string;
    sceneDescription: string;
    projectId?: string;
    options?: Record<string, unknown>;
  }
) {
  const jobStore = getJobStore();
  const aiService = getAIService();

  // Update to processing
  await jobStore.update(jobId, { status: 'processing' });

  try {
    const result = await aiService.generateSync({
      task: 'scene-gen',
      inputUrl: validated.productImage,
      prompt: validated.sceneDescription,
      options: validated.options,
    });

    if (result.success) {
      await jobStore.update(jobId, {
        status: 'completed',
        result: {
          outputUrl: result.outputUrl,
          outputUrls: result.outputUrls,
          duration: result.duration,
          cost: result.cost,
        },
        completedAt: new Date(),
      });
    } else {
      await jobStore.update(jobId, {
        status: 'failed',
        error: result.error || 'Scene generation failed',
        completedAt: new Date(),
      });
    }
  } catch (error) {
    await jobStore.update(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Scene generation failed',
      completedAt: new Date(),
    });
  }
}
