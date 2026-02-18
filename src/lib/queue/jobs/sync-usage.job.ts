/**
 * Sync Usage Job
 *
 * Handles usage tracking, analytics, and billing cycle management
 */

import { inngest, EVENTS } from '../client';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { generationRepository } from '@/lib/db/repositories/generation.repository';
import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

interface UsageSyncData {
  userId: string;
  generationId: string;
  cost: number;
  task: string;
  provider: string;
}

interface UsageResetData {
  userId: string;
  newLimit: number;
}

interface UserPlanChangedData {
  userId: string;
  oldPlan: string;
  newPlan: string;
  newLimit: number;
}

// =============================================================================
// Job Handlers
// =============================================================================

/**
 * Sync Usage Job
 *
 * Records usage data for analytics and billing
 * - Logs generation usage
 * - Tracks costs per provider
 * - Updates usage statistics
 */
export const syncUsageJob = inngest.createFunction(
  {
    id: 'sync-usage',
    name: 'Sync Usage Data',
    retries: 3,
  },
  { event: EVENTS.USAGE_SYNC_REQUESTED },
  async ({ event, step }) => {
    const data = event.data as UsageSyncData;
    const { userId, generationId, cost, task, provider } = data;

    console.log(`[Sync Usage] Recording usage:`, {
      userId,
      generationId,
      cost,
      task,
      provider,
    });

    // Step 1: Create usage log entry
    await step.run('create-usage-log', async () => {
      await db.insert(usageLogs).values({
        userId,
        generationId,
        task,
        provider,
        cost,
      });

      return { logged: true };
    });

    // Step 2: Update user's total usage
    await step.run('update-user-usage', async () => {
      await userRepository.incrementGenerationsUsed(userId);
      return { updated: true };
    });

    // Step 3: Get updated stats
    const stats = await step.run('get-stats', async () => {
      const user = await userRepository.findById(userId);
      const genStats = await generationRepository.getStatsByUserId(userId);

      return {
        generationsUsed: user?.generationsUsed ?? 0,
        generationsLimit: user?.generationsLimit ?? 10,
        totalCost: genStats.totalCost,
      };
    });

    console.log(`[Sync Usage] Completed:`, {
      userId,
      stats,
    });

    return {
      success: true,
      userId,
      stats,
    };
  },
);

/**
 * Reset Usage Job
 *
 * Resets monthly usage for users at billing cycle start
 * - Resets generation count
 * - Updates billing cycle date
 * - Sets new limits based on plan
 */
export const resetUsageJob = inngest.createFunction(
  {
    id: 'reset-usage',
    name: 'Reset Monthly Usage',
    retries: 2,
  },
  { event: EVENTS.USAGE_RESET_REQUESTED },
  async ({ event, step }) => {
    const data = event.data as UsageResetData;
    const { userId, newLimit } = data;

    console.log(`[Reset Usage] Resetting for user:`, {
      userId,
      newLimit,
    });

    // Step 1: Reset usage
    await step.run('reset-user-usage', async () => {
      await userRepository.resetMonthlyUsage(userId, newLimit);
      return { reset: true };
    });

    // Step 2: Log reset
    await step.run('log-reset', async () => {
      const user = await userRepository.findById(userId);
      console.log(`[Reset Usage] User reset complete:`, {
        userId,
        plan: user?.plan,
        newLimit: user?.generationsLimit,
        billingCycleStart: user?.billingCycleStart,
      });

      return { logged: true };
    });

    return {
      success: true,
      userId,
      newLimit,
    };
  },
);

/**
 * Scheduled Usage Reset Job
 *
 * Cron job to reset usage for all users at billing cycle
 * Runs daily at midnight
 */
export const scheduledUsageResetJob = inngest.createFunction(
  {
    id: 'scheduled-usage-reset',
    name: 'Scheduled Monthly Usage Reset',
  },
  { cron: '0 0 * * *' }, // Daily at midnight
  async ({ step }) => {
    console.log('[Scheduled Reset] Checking for users needing reset...');

    // Step 1: Find users whose billing cycle has ended
    const usersToReset = await step.run('find-users', async () => {
      // In production, this would query for users where:
      // billingCycleStart + 30 days < now
      // For now, return empty array as placeholder
      return [] as Array<{ id: string; plan: string }>;
    });

    // Step 2: Send reset events for each user
    if (usersToReset.length > 0) {
      await step.sendEvent(
        'send-reset-events',
        usersToReset.map((user) => ({
          name: EVENTS.USAGE_RESET_REQUESTED,
          data: {
            userId: user.id,
            newLimit: getLimitForPlan(user.plan),
          },
        })),
      );
    }

    return {
      success: true,
      usersChecked: usersToReset.length,
    };
  },
);

// =============================================================================
// Plan Changed Job
// =============================================================================

/**
 * User Plan Changed Job
 *
 * Updates user limits when plan changes
 */
export const userPlanChangedJob = inngest.createFunction(
  {
    id: 'user-plan-changed',
    name: 'Handle Plan Change',
    retries: 2,
  },
  { event: EVENTS.USER_PLAN_CHANGED },
  async ({ event, step }) => {
    const data = event.data as UserPlanChangedData;
    const { userId, oldPlan, newPlan, newLimit } = data;

    console.log(`[Plan Changed] Processing:`, {
      userId,
      oldPlan,
      newPlan,
      newLimit,
    });

    // Step 1: Update user limits
    await step.run('update-limits', async () => {
      await userRepository.resetMonthlyUsage(userId, newLimit);
      return { updated: true };
    });

    // Step 2: Log change
    await step.run('log-change', async () => {
      console.log(`[Plan Changed] User plan updated:`, {
        userId,
        oldPlan,
        newPlan,
        newLimit,
      });
      return { logged: true };
    });

    return {
      success: true,
      userId,
      oldPlan,
      newPlan,
      newLimit,
    };
  },
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get generation limit for a plan
 */
function getLimitForPlan(plan: string): number {
  const limits: Record<string, number> = {
    free: 10,
    pro: 100,
    agency: 500,
  };
  return limits[plan] ?? 10;
}
