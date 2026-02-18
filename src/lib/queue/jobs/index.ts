/**
 * Inngest Jobs Index
 *
 * Exports all job functions for registration with Inngest
 */

import { generateImageJob, batchGenerateJob } from './generate-image.job';
import { processExportJob, getAvailablePresets, getPresetDimensions } from './process-export.job';
import {
  syncUsageJob,
  resetUsageJob,
  scheduledUsageResetJob,
  userPlanChangedJob,
} from './sync-usage.job';

// =============================================================================
// All Jobs
// =============================================================================

/**
 * Array of all Inngest functions to be served
 */
export const jobs = [
  // AI Generation
  generateImageJob,
  batchGenerateJob,

  // Export
  processExportJob,

  // Usage
  syncUsageJob,
  resetUsageJob,
  scheduledUsageResetJob,
  userPlanChangedJob,
];

// =============================================================================
// Re-exports
// =============================================================================

export {
  // Generate Image
  generateImageJob,
  batchGenerateJob,

  // Process Export
  processExportJob,
  getAvailablePresets,
  getPresetDimensions,

  // Sync Usage
  syncUsageJob,
  resetUsageJob,
  scheduledUsageResetJob,
  userPlanChangedJob,
};
