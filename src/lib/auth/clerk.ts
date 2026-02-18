/**
 * Clerk Authentication Utilities
 *
 * Helper functions for working with Clerk authentication
 */

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { userRepository } from '@/lib/db/repositories/user.repository';
import type { User } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface ClerkUser {
  id: string;
  emailAddresses: Array<{
    emailAddress: string;
    id: string;
  }>;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  username?: string | null;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
}

export interface AuthResult {
  userId: string | null;
  isAuthenticated: boolean;
  user: User | null;
  clerkUser: ClerkUser | null;
}

// =============================================================================
// Authentication Helpers
// =============================================================================

/**
 * Get the current authenticated user
 * Returns both Clerk user and database user
 */
export async function getAuthUser(): Promise<AuthResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      isAuthenticated: false,
      user: null,
      clerkUser: null,
    };
  }

  // Get Clerk user
  const clerkUser = await currentUser();

  // Get database user
  const user = await userRepository.findByClerkId(userId);

  return {
    userId,
    isAuthenticated: true,
    user,
    clerkUser: clerkUser as ClerkUser | null,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const authResult = await getAuthUser();

  if (!authResult.isAuthenticated) {
    throw new Error('Unauthorized: Authentication required');
  }

  return authResult;
}

/**
 * Get current user ID or throw
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: Authentication required');
  }

  return userId;
}

/**
 * Get current database user or throw
 */
export async function requireUser(): Promise<User> {
  const authResult = await requireAuth();

  if (!authResult.user) {
    throw new Error('User not found in database. Please sync with Clerk.');
  }

  return authResult.user;
}

/**
 * Check if user has Pro or Agency plan
 */
export async function isProUser(): Promise<boolean> {
  const authResult = await getAuthUser();

  if (!authResult.user) {
    return false;
  }

  return authResult.user.plan === 'pro' || authResult.user.plan === 'agency';
}

/**
 * Check if user is on Agency plan
 */
export async function isAgencyUser(): Promise<boolean> {
  const authResult = await getAuthUser();

  if (!authResult.user) {
    return false;
  }

  return authResult.user.plan === 'agency';
}

// =============================================================================
// User Sync
// =============================================================================

/**
 * Sync user from Clerk to database
 * Creates or updates user record
 */
export async function syncUserFromClerk(clerkUser: ClerkUser): Promise<User> {
  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error('User has no email address');
  }

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

  return userRepository.upsertByClerkId({
    clerkId: clerkUser.id,
    email: primaryEmail,
    name,
    avatarUrl: clerkUser.imageUrl,
    plan: 'free',
  });
}

/**
 * Delete user from database
 */
export async function deleteUserFromDatabase(clerkId: string): Promise<void> {
  const user = await userRepository.findByClerkId(clerkId);

  if (user) {
    await userRepository.delete(user.id);
  }
}

// =============================================================================
// Clerk Client Helpers
// =============================================================================

/**
 * Get user's primary email from Clerk
 */
export async function getClerkUserEmail(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Update user metadata in Clerk
 */
export async function updateClerkUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: metadata,
  });
}

// =============================================================================
// Plan Limits
// =============================================================================

export const PLAN_LIMITS = {
  free: {
    generations: 10,
    maxProjects: 5,
    watermark: true,
    templates: 'basic',
  },
  pro: {
    generations: 100,
    maxProjects: -1, // unlimited
    watermark: false,
    templates: 'all',
  },
  agency: {
    generations: 500,
    maxProjects: -1,
    watermark: false,
    templates: 'all',
    teamMembers: 5,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

/**
 * Get plan limits for user
 */
export function getPlanLimits(plan: PlanType) {
  return PLAN_LIMITS[plan];
}

/**
 * Check if user can generate more images
 */
export async function canGenerate(): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const authResult = await getAuthUser();

  if (!authResult.user) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const limits = PLAN_LIMITS[authResult.user.plan];
  const remaining = Math.max(0, limits.generations - authResult.user.generationsUsed);

  return {
    allowed: remaining > 0,
    remaining,
    limit: limits.generations,
  };
}

/**
 * Check if user can create more projects
 */
export async function canCreateProject(currentProjectCount: number): Promise<boolean> {
  const authResult = await getAuthUser();

  if (!authResult.user) {
    return false;
  }

  const limits = PLAN_LIMITS[authResult.user.plan];

  // -1 means unlimited
  if (limits.maxProjects === -1) {
    return true;
  }

  return currentProjectCount < limits.maxProjects;
}
