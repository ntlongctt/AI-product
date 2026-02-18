/**
 * User Service
 *
 * High-level business logic for user management
 * Handles Clerk sync, preferences, and subscription management
 */

import { userRepository } from '@/lib/db/repositories/user.repository';
import { generationRepository } from '@/lib/db/repositories/generation.repository';
import type { User, Plan, UserPreferences } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface ClerkUserData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
  }>;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string;
  username?: string | null;
}

export interface UpdatePreferencesInput {
  defaultExportFormat?: 'jpeg' | 'png';
  jpegQuality?: number;
  shareUsageData?: boolean;
}

export interface UsageStats {
  generationsUsed: number;
  generationsLimit: number;
  remaining: number;
  percentUsed: number;
  plan: Plan;
  billingCycleStart: Date | null;
}

export interface SubscriptionUpdate {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// =============================================================================
// Plan Limits
// =============================================================================

export const PLAN_LIMITS: Record<Plan, { generations: number; maxProjects: number; watermark: boolean }> = {
  free: { generations: 10, maxProjects: 5, watermark: true },
  pro: { generations: 100, maxProjects: -1, watermark: false },
  agency: { generations: 500, maxProjects: -1, watermark: false },
};

// =============================================================================
// User Service Class
// =============================================================================

export class UserService {
  /**
   * Sync user from Clerk webhook
   * Creates or updates user in database
   */
  async syncFromClerk(clerkUser: ClerkUserData): Promise<User> {
    const primaryEmail = clerkUser.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      throw new Error('User has no email address');
    }

    const name = [clerkUser.first_name, clerkUser.last_name]
      .filter(Boolean)
      .join(' ') || null;

    // Check if user exists
    const existingUser = await userRepository.findByClerkId(clerkUser.id);

    if (existingUser) {
      // Update existing user
      return userRepository.update(existingUser.id, {
        email: primaryEmail,
        name,
        avatarUrl: clerkUser.image_url,
      });
    }

    // Create new user
    return userRepository.create({
      clerkId: clerkUser.id,
      email: primaryEmail,
      name,
      avatarUrl: clerkUser.image_url,
      plan: 'free',
      generationsUsed: 0,
      generationsLimit: PLAN_LIMITS.free.generations,
      preferences: {
        defaultExportFormat: 'jpeg',
        jpegQuality: 95,
        shareUsageData: false,
      },
    });
  }

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<User | null> {
    return userRepository.findById(userId);
  }

  /**
   * Get user by Clerk ID
   */
  async getByClerkId(clerkId: string): Promise<User | null> {
    return userRepository.findByClerkId(clerkId);
  }

  /**
   * Delete user and all associated data
   */
  async delete(userId: string): Promise<void> {
    // In production, this should also:
    // - Delete all projects
    // - Delete all assets
    // - Delete all generations
    // - Delete storage files
    await userRepository.delete(userId);
  }

  // ==========================================================================
  // Preferences
  // ==========================================================================

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return (user.preferences as UserPreferences) ?? {
      defaultExportFormat: 'jpeg',
      jpegQuality: 95,
      shareUsageData: false,
    };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<User> {
    return userRepository.updatePreferences(userId, input);
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Update subscription plan
   */
  async updateSubscription(userId: string, update: SubscriptionUpdate): Promise<User> {
    const { plan, stripeCustomerId, stripeSubscriptionId } = update;
    const limits = PLAN_LIMITS[plan];

    const user = await userRepository.updatePlan(userId, plan, {
      stripeCustomerId,
      stripeSubscriptionId,
    });

    // Reset usage limits for new plan
    await userRepository.resetMonthlyUsage(userId, limits.generations);

    return user;
  }

  /**
   * Handle subscription cancellation
   */
  async cancelSubscription(userId: string): Promise<User> {
    // Downgrade to free at end of billing period
    // For now, immediately downgrade
    return this.updateSubscription(userId, {
      plan: 'free',
    });
  }

  /**
   * Handle subscription upgrade
   */
  async upgradeSubscription(
    userId: string,
    newPlan: 'pro' | 'agency',
    stripeData?: { stripeCustomerId: string; stripeSubscriptionId: string },
  ): Promise<User> {
    return this.updateSubscription(userId, {
      plan: newPlan,
      ...stripeData,
    });
  }

  // ==========================================================================
  // Usage Management
  // ==========================================================================

  /**
   * Get usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const limit = PLAN_LIMITS[user.plan].generations;
    const used = user.generationsUsed;
    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      generationsUsed: used,
      generationsLimit: limit,
      remaining,
      percentUsed,
      plan: user.plan,
      billingCycleStart: user.billingCycleStart,
    };
  }

  /**
   * Get detailed generation statistics
   */
  async getGenerationStats(userId: string): Promise<{
    total: number;
    byTask: Record<string, number>;
    byProvider: Record<string, number>;
    byStatus: Record<string, number>;
    totalCost: number;
  }> {
    const stats = await generationRepository.getStatsByUserId(userId);
    return stats;
  }

  /**
   * Reset monthly usage
   */
  async resetMonthlyUsage(userId: string): Promise<User> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const limit = PLAN_LIMITS[user.plan].generations;
    return userRepository.resetMonthlyUsage(userId, limit);
  }

  /**
   * Check if user can generate
   */
  async canGenerate(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const user = await this.getById(userId);
    if (!user) {
      return { allowed: false, remaining: 0 };
    }

    const limit = PLAN_LIMITS[user.plan].generations;
    const remaining = Math.max(0, limit - user.generationsUsed);

    return {
      allowed: remaining > 0,
      remaining,
    };
  }

  /**
   * Increment usage count
   */
  async incrementUsage(userId: string, count: number = 1): Promise<User> {
    return userRepository.incrementGenerationsUsed(userId, count);
  }

  // ==========================================================================
  // Plan Helpers
  // ==========================================================================

  /**
   * Get plan limits
   */
  getPlanLimits(plan: Plan) {
    return PLAN_LIMITS[plan];
  }

  /**
   * Check if user is on Pro or Agency plan
   */
  async isPro(userId: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user) return false;
    return user.plan === 'pro' || user.plan === 'agency';
  }

  /**
   * Check if user is on Agency plan
   */
  async isAgency(userId: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user) return false;
    return user.plan === 'agency';
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let userService: UserService | null = null;

export function getUserService(): UserService {
  if (!userService) {
    userService = new UserService();
  }
  return userService;
}

export function resetUserService(): void {
  userService = null;
}
