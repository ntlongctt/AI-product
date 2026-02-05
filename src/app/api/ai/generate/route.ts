import { NextRequest, NextResponse } from 'next/server';
import { generateImageSchema } from '@/lib/validations/ai';
import { getProviderForTask } from '@/lib/ai/router';
import { createAIProvider } from '@/lib/ai/providers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = generateImageSchema.parse(body);

    const routing = getProviderForTask(validated.task);
    const provider = await createAIProvider(routing.primary);

    const result = await provider.generateImage({
      task: validated.task,
      inputUrl: validated.inputUrl,
      prompt: validated.prompt,
      options: validated.options,
    });

    return NextResponse.json({
      success: true,
      data: {
        outputUrl: result.outputUrl,
        duration: result.duration,
        cost: result.cost,
        provider: routing.primary,
        model: routing.model,
      },
    });
  } catch (error) {
    console.error('[AI Generate Error]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
