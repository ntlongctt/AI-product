/**
 * Inngest Client Configuration
 *
 * Central client for all background job processing
 */

import { Inngest } from 'inngest';

// =============================================================================
// Inngest Client
// =============================================================================

/**
 * Create Inngest client
 * This client is used to send events and define functions
 */
export const inngest = new Inngest({
  id: 'product-image-ai-studio',
  name: 'Product Image AI Studio',
  // Event key for authentication
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Signing key for production
  signingKey: process.env.INNGEST_SIGNING_KEY,
  // Enable dev mode in development
  isDev: process.env.NODE_ENV === 'development',
});

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event names for the application
 */
export const EVENTS = {
  // AI Generation Events
  AI_GENERATE_REQUESTED: 'ai/generate.requested',
  AI_GENERATE_COMPLETED: 'ai/generate.completed',
  AI_GENERATE_FAILED: 'ai/generate.failed',

  // Export Events
  EXPORT_REQUESTED: 'export/project.requested',
  EXPORT_COMPLETED: 'export/project.completed',
  EXPORT_FAILED: 'export/project.failed',

  // Usage Sync Events
  USAGE_SYNC_REQUESTED: 'usage/sync.requested',
  USAGE_RESET_REQUESTED: 'usage/reset.requested',

  // User Events
  USER_PLAN_CHANGED: 'user/plan.changed',

  // Batch Processing Events
  BATCH_GENERATE_REQUESTED: 'batch/generate.requested',
} as const;

// =============================================================================
// Event Schemas
// =============================================================================

/**
 * AI Generation Event
 */
export interface AIGenerateEvent {
  name: typeof EVENTS.AI_GENERATE_REQUESTED;
  data: {
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
  };
}

/**
 * Export Event
 */
export interface ExportEvent {
  name: typeof EVENTS.EXPORT_REQUESTED;
  data: {
    exportId: string;
    userId: string;
    projectId: string;
    options: {
      format: 'jpeg' | 'png';
      quality?: number;
      width?: number;
      height?: number;
      preset?: string;
      watermark?: boolean;
    };
  };
}

/**
 * Usage Sync Event
 */
export interface UsageSyncEvent {
  name: typeof EVENTS.USAGE_SYNC_REQUESTED;
  data: {
    userId: string;
    generationId: string;
    cost: number;
    task: string;
    provider: string;
  };
}

/**
 * Usage Reset Event
 */
export interface UsageResetEvent {
  name: typeof EVENTS.USAGE_RESET_REQUESTED;
  data: {
    userId: string;
    newLimit: number;
  };
}

/**
 * User Plan Changed Event
 */
export interface UserPlanChangedEvent {
  name: typeof EVENTS.USER_PLAN_CHANGED;
  data: {
    userId: string;
    oldPlan: string;
    newPlan: string;
    newLimit: number;
  };
}

/**
 * Batch Generate Event
 */
export interface BatchGenerateEvent {
  name: typeof EVENTS.BATCH_GENERATE_REQUESTED;
  data: {
    batchId: string;
    userId: string;
    items: Array<{
      generationId: string;
      task: string;
      inputUrl: string;
      prompt?: string;
    }>;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Send an event to Inngest
 */
export async function sendEvent<T extends { name: string; data: unknown }>(event: T): Promise<void> {
  await inngest.send(event);
}

/**
 * Send multiple events to Inngest
 */
export async function sendEvents<T extends { name: string; data: unknown }>(
  events: T[],
): Promise<void> {
  await inngest.send(events);
}

// =============================================================================
// Type Exports
// =============================================================================

export type AppEvents =
  | AIGenerateEvent
  | ExportEvent
  | UsageSyncEvent
  | UsageResetEvent
  | UserPlanChangedEvent
  | BatchGenerateEvent;
