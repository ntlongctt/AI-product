/**
 * Auth Module Exports
 */

// Clerk utilities
export {
  getAuthUser,
  requireAuth,
  requireUserId,
  requireUser,
  isProUser,
  isAgencyUser,
  syncUserFromClerk,
  deleteUserFromDatabase,
  getClerkUserEmail,
  updateClerkUserMetadata,
  canGenerate,
  canCreateProject,
  getPlanLimits,
  PLAN_LIMITS,
  type ClerkUser,
  type AuthResult,
  type PlanType,
} from './clerk';

// Webhook handler
export { processClerkWebhook, type WebhookResult } from './webhook-handler';
