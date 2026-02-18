/**
 * Clerk Webhook Handler
 *
 * Handles webhooks from Clerk for user lifecycle events
 * - user.created: Create user in database
 * - user.updated: Update user in database
 * - user.deleted: Delete user from database
 */

import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { syncUserFromClerk, deleteUserFromDatabase, type ClerkUser } from '@/lib/auth/clerk';

// =============================================================================
// Types
// =============================================================================

interface WebhookEvent {
  data: ClerkUser;
  object: 'event';
  type: 'user.created' | 'user.updated' | 'user.deleted';
  id: string;
  timestamp: number;
}

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Verify webhook signature from Clerk
 */
async function verifyWebhookSignature(payload: string, signature: string): Promise<WebhookEvent> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable');
  }

  const wh = new Webhook(webhookSecret);

  try {
    const evt = wh.verify(payload, {
      'svix-id': signature.split(',')[0] || '',
      'svix-timestamp': signature.split(',')[1] || '',
      'svix-signature': signature.split(',')[2] || '',
    }) as WebhookEvent;

    return evt;
  } catch (err) {
    throw new Error('Invalid webhook signature');
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle user.created event
 */
async function handleUserCreated(data: ClerkUser): Promise<{ success: boolean; userId: string }> {
  try {
    const user = await syncUserFromClerk(data);
    console.log(`[Clerk Webhook] User created: ${user.id} (Clerk ID: ${data.id})`);
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('[Clerk Webhook] Error creating user:', error);
    throw error;
  }
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data: ClerkUser): Promise<{ success: boolean; userId: string }> {
  try {
    const user = await syncUserFromClerk(data);
    console.log(`[Clerk Webhook] User updated: ${user.id} (Clerk ID: ${data.id})`);
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('[Clerk Webhook] Error updating user:', error);
    throw error;
  }
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data: ClerkUser): Promise<{ success: boolean; clerkId: string }> {
  try {
    await deleteUserFromDatabase(data.id);
    console.log(`[Clerk Webhook] User deleted: ${data.id}`);
    return { success: true, clerkId: data.id };
  } catch (error) {
    console.error('[Clerk Webhook] Error deleting user:', error);
    throw error;
  }
}

// =============================================================================
// Main Handler
// =============================================================================

export type WebhookResult =
  | { success: true; event: string; data: unknown }
  | { success: false; error: string };

/**
 * Process Clerk webhook
 */
export async function processClerkWebhook(request: Request): Promise<WebhookResult> {
  // Get headers
  const headersList = await headers();
  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  // Validate headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    return {
      success: false,
      error: 'Missing svix headers',
    };
  }

  // Get payload
  const payload = await request.text();

  // Verify signature
  let event: WebhookEvent;
  try {
    event = await verifyWebhookSignature(payload, `${svixId},${svixTimestamp},${svixSignature}`);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid signature',
    };
  }

  // Process event
  try {
    switch (event.type) {
      case 'user.created': {
        const result = await handleUserCreated(event.data);
        return { success: true, event: event.type, data: result };
      }

      case 'user.updated': {
        const result = await handleUserUpdated(event.data);
        return { success: true, event: event.type, data: result };
      }

      case 'user.deleted': {
        const result = await handleUserDeleted(event.data);
        return { success: true, event: event.type, data: result };
      }

      default:
        return {
          success: false,
          error: `Unhandled event type: ${(event as { type: string }).type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };
  }
}
