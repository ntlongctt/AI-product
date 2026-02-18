import { NextRequest, NextResponse } from 'next/server';
import { tryOnSchema } from '@/lib/validations/ai';
import { generateId } from '@/lib/utils';
import { getJobStore } from '@/lib/ai/job-store';
import { getAIService } from '@/lib/ai/service';

/**
 * POST /api/ai/tasks/try-on
 * Specialized endpoint for virtual try-on
 * Accepts a person image and garment image, returns a job ID for polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = tryOnSchema.parse(body);

    // Create job ID immediately
    const jobId = generateId();
    const jobStore = getJobStore();

    // Store initial job state
    await jobStore.create({
      id: jobId,
      status: 'pending',
      task: 'try-on',
      input: {
        task: 'try-on',
        inputUrls: [validated.personImage, validated.garmentImage],
        options: {
          ...validated.options,
          projectId: validated.projectId,
        },
      },
    });

    // Start async processing (fire and forget)
    processTryOnJob(jobId, validated).catch(console.error);

    // Return job ID immediately for polling
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          status: 'pending',
          task: 'try-on',
          message: 'Virtual try-on job queued for processing',
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Try-On Error]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to queue virtual try-on job' },
      { status: 500 }
    );
  }
}

// Async job processor for virtual try-on
async function processTryOnJob(
  jobId: string,
  validated: {
    personImage: string;
    garmentImage: string;
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
      task: 'try-on',
      inputUrls: [validated.personImage, validated.garmentImage],
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
        error: result.error || 'Virtual try-on failed',
        completedAt: new Date(),
      });
    }
  } catch (error) {
    await jobStore.update(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Virtual try-on failed',
      completedAt: new Date(),
    });
  }
}
