/**
 * Clerk Webhook API Route
 *
 * Handles webhooks from Clerk for user lifecycle events
 * Endpoint: POST /api/webhooks/clerk
 */

import { NextResponse } from 'next/server';
import { processClerkWebhook } from '@/lib/auth/webhook-handler';

export async function POST(request: Request) {
  const result = await processClerkWebhook(request);

  if (result.success) {
    return NextResponse.json({
      success: true,
      event: result.event,
      data: result.data,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error,
    },
    { status: 400 },
  );
}

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs';
