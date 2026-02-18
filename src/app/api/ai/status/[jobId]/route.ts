import { NextRequest, NextResponse } from 'next/server';
import { getJobStore } from '@/lib/ai/job-store';

interface RouteParams {
  params: Promise<{
    jobId: string;
  }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const jobStore = getJobStore();
    const job = await jobStore.get(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Build response based on status
    const response: {
      jobId: string;
      status: string;
      task: string;
      createdAt: string;
      completedAt?: string;
      outputUrl?: string;
      error?: string;
    } = {
      jobId: job.id,
      status: job.status,
      task: job.task,
      createdAt: job.createdAt.toISOString(),
    };

    // Include additional fields based on job state
    if (job.completedAt) {
      response.completedAt = job.completedAt.toISOString();
    }

    if (job.status === 'completed') {
      response.outputUrl = job.result?.outputUrl;
    }

    if (job.status === 'failed') {
      response.error = job.error;
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[AI Status Error]', error);

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve job status' },
      { status: 500 }
    );
  }
}
