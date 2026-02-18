/**
 * Usage Service
 *
 * High-level business logic for usage tracking
 * Handles limit checking, usage tracking, and billing cycle management
 */

import { userRepository } from '@/lib/db/repositories/user.repository';
import { generationRepository } from '@/lib/db/repositories/generation.repository';
import { db } from '@/lib/db';
import { usageLogs } from '@/lib/db/schema';
import { getUserService, PLAN_LIMITS } from './user.service';
import type { Plan } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  plan: Plan;
  percentUsed: number;
}

export interface UsageStats {
  total: number;
  byTask: Record<string, number>;
  byProvider: Record<string, number>;
  byStatus: Record<string, number>;
  totalCost: number;
  currentPeriod: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface UsageLog {
  id: string;
  userId: string;
  generationId: string | null;
  task: string;
  provider: string;
  cost: number;
  createdAt: Date;
}

// =============================================================================
// Usage Service Class
// =============================================================================

export class UsageService {
  /**
   * Check if user can generate
   * Returns usage limits and remaining count
   */
  async checkUsage(userId: string): Promise<UsageCheck> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        plan: 'free',
        percentUsed: 100,
      };
    }

    const limit = PLAN_LIMITS[user.plan].generations;
    const used = user.generationsUsed;
    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 100;

    return {
      allowed: remaining > 0,
      remaining,
      limit,
      plan: user.plan,
      percentUsed,
    };
  }

  /**
   * Increment usage after successful generation
   */
  async incrementUsage(
    userId: string,
    generationId: string,
    task: string,
    provider: string,
    cost: number = 0,
  ): Promise<void> {
    // Log usage
    await db.insert(usageLogs).values({
      userId,
      generationId,
      task,
      provider,
      cost,
    });

    // Increment user's generation count
    await userRepository.incrementGenerationsUsed(userId);
  }

  /**
   * Get usage statistics for user
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const genStats = await generationRepository.getStatsByUserId(userId);
    const limit = PLAN_LIMITS[user.plan].generations;

    return {
      total: genStats.total,
      byTask: genStats.byTask,
      byProvider: genStats.byProvider,
      byStatus: genStats.byStatus,
      totalCost: genStats.totalCost,
      currentPeriod: {
        used: user.generationsUsed,
        limit,
        remaining: Math.max(0, limit - user.generationsUsed),
      },
    };
  }

  /**
   * Get plan limits
   */
  getPlanLimits(plan: Plan) {
    return PLAN_LIMITS[plan];
  }

  /**
   * Get all plan limits
   */
  getAllPlanLimits() {
    return PLAN_LIMITS;
  }

  /**
   * Reset monthly usage
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const limit = PLAN_LIMITS[user.plan].generations;
    await userRepository.resetMonthlyUsage(userId, limit);
  }

  /**
   * Get usage history for user
   */
  async getUsageHistory(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ logs: UsageLog[]; total: number }> {
    // This would query usage_logs table with pagination
    // For now, return empty result
    return {
      logs: [],
      total: 0,
    };
  }

  /**
   * Get cost breakdown for user
   */
  async getCostBreakdown(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalCost: number;
    byTask: Record<string, number>;
    byProvider: Record<string, number>;
  }> {
    const stats = await generationRepository.getStatsByUserId(userId);

    return {
      totalCost: stats.totalCost,
      byTask: stats.byTask,
      byProvider: stats.byProvider,
    };
  }

  // ==========================================================================
  // Billing Cycle Helpers
  // ==========================================================================

  /**
   * Check if billing cycle needs reset
   */
  async needsReset(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);

    if (!user || !user.billingCycleStart) {
      return false;
    }

    // Check if 30 days have passed since last reset
    const cycleStart = new Date(user.billingCycleStart);
    const now = new Date();
    const daysSinceReset = Math.floor(
      (now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSinceReset >= 30;
  }

  /**
   * Reset usage for all users who need it
   * Called by scheduled job
   */
  async resetExpiredCycles(): Promise<{ resetCount: number }> {
    // This would query all users whose billing cycle has expired
    // and reset their usage
    // For now, return 0
    return { resetCount: 0 };
  }

  // ==========================================================================
  // Admin Helpers
  // ==========================================================================

  /**
   * Get platform-wide usage stats
   */
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalGenerations: number;
    totalCost: number;
    usersByPlan: Record<Plan, number>;
  }> {
    // This would aggregate stats across all users
    // For now, return placeholder
    return {
      totalUsers: 0,
      totalGenerations: 0,
      totalCost: 0,
      usersByPlan: {
        free: 0,
        pro: 0,
        agency: 0,
      },
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let usageService: UsageService | null = null;

export function getUsageService(): UsageService {
  if (!usageService) {
    usageService = new UsageService();
  }
  return usageService;
}

export function resetUsageService(): void {
  usageService = null;
}
