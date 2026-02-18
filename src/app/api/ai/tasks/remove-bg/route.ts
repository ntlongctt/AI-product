import { NextRequest, NextResponse } from 'next/server';
import { removeBgSchema } from '@/lib/validations/ai';
import { generateId } from '@/lib/utils';
import { getJobStore } from '@/lib/ai/job-store';
import { getAIService } from '@/lib/ai/service';

/**
 * POST /api/ai/tasks/remove-bg
 * Specialized endpoint for background removal
 * Accepts an image and returns a job ID for polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = removeBgSchema.parse(body);

    // Create job ID immediately
    const jobId = generateId();
    const jobStore = getJobStore();

    // Store initial job state
    await jobStore.create({
      id: jobId,
      status: 'pending',
      task: 'remove-bg',
      input: {
        task: 'remove-bg',
        inputUrl: validated.image,
        options: {
          ...validated.options,
          projectId: validated.projectId,
        },
      },
    });

    // Start async processing (fire and forget)
    processRemoveBgJob(jobId, validated).catch(console.error);

    // Return job ID immediately for polling
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          status: 'pending',
          task: 'remove-bg',
          message: 'Background removal job queued for processing',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Remove BG Error]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to queue background removal job' },
      { status: 500 }
    );
  }
}

// Async job processor for background removal
async function processRemoveBgJob(
  jobId: string,
  validated: {
    image: string;
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
      task: 'remove-bg',
      inputUrl: validated.image,
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
        error: result.error || 'Background removal failed',
        completedAt: new Date(),
      });
    }
  } catch (error) {
    await jobStore.update(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Background removal failed',
      completedAt: new Date(),
    });
  }
}
