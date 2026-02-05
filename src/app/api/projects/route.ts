import { NextRequest, NextResponse } from 'next/server';
import { createProjectSchema } from '@/lib/validations/project';
import { generateId } from '@/lib/utils';

export async function GET() {
  // TODO: Implement with database
  const projects: unknown[] = [];

  return NextResponse.json({ success: true, data: projects });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = createProjectSchema.parse(body);

    // TODO: Implement with database
    const project = {
      id: generateId(),
      userId: 'temp-user-id',
      name: validated.name,
      sku: validated.sku,
      layers: [],
      settings: {
        width: validated.width,
        height: validated.height,
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error('[Create Project Error]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
