/**
 * User Repository
 *
 * Handles all database operations for users
 */

import { eq, and } from 'drizzle-orm';
import { db, users, type User, type NewUser, type UserPreferences } from '../index';

export interface UserFilters {
  plan?: string;
}

export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find user by Clerk ID
   */
  async findByClerkId(clerkId: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<NewUser>): Promise<User> {
    const result = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: Partial<UserPreferences>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const currentPreferences = (user.preferences as UserPreferences) ?? {
      defaultExportFormat: 'jpeg',
      jpegQuality: 95,
      shareUsageData: false,
    };
    const newPreferences = { ...currentPreferences, ...preferences } as UserPreferences;

    return this.update(id, { preferences: newPreferences });
  }

  /**
   * Update user plan
   */
  async updatePlan(
    id: string,
    plan: 'free' | 'pro' | 'agency',
    stripeData?: { stripeCustomerId?: string; stripeSubscriptionId?: string },
  ): Promise<User> {
    const updateData: Partial<NewUser> = { plan };
    if (stripeData?.stripeCustomerId) {
      updateData.stripeCustomerId = stripeData.stripeCustomerId;
    }
    if (stripeData?.stripeSubscriptionId) {
      updateData.stripeSubscriptionId = stripeData.stripeSubscriptionId;
    }
    return this.update(id, updateData);
  }

  /**
   * Increment generations used
   */
  async incrementGenerationsUsed(id: string, count: number = 1): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    return this.update(id, {
      generationsUsed: user.generationsUsed + count,
    });
  }

  /**
   * Reset monthly usage
   */
  async resetMonthlyUsage(id: string, limit: number): Promise<User> {
    return this.update(id, {
      generationsUsed: 0,
      generationsLimit: limit,
      billingCycleStart: new Date(),
    });
  }

  /**
   * Get users with filters
   */
  async findAll(filters?: UserFilters): Promise<User[]> {
    if (filters?.plan) {
      return db
        .select()
        .from(users)
        .where(eq(users.plan, filters.plan as 'free' | 'pro' | 'agency'));
    }

    return db.select().from(users);
  }

  /**
   * Upsert user (create or update based on Clerk ID)
   */
  async upsertByClerkId(data: NewUser): Promise<User> {
    const existing = await this.findByClerkId(data.clerkId);

    if (existing) {
      return this.update(existing.id, data);
    }

    return this.create(data);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
