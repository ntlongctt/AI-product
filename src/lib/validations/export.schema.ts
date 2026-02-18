/**
 * Export Validation Schemas
 *
 * Zod schemas for validating export-related inputs
 */

import { z } from 'zod';

// =============================================================================
// Export Preset Schema
// =============================================================================

export const exportPresetSchema = z.enum([
  'shopee-main',
  'shopee-gallery',
  'lazada-main',
  'tiktok-cover',
  'instagram-post',
  'facebook-product',
  'hd',
  '4k',
]);

// =============================================================================
// Export Options Schema
// =============================================================================

export const exportOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png']).default('jpeg'),
  quality: z.number().int().min(1).max(100).default(95),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  preset: exportPresetSchema.optional(),
  watermark: z.boolean().optional(),
});

export const batchExportSchema = z.object({
  projectIds: z.array(z.string().uuid()).min(1).max(50),
  options: exportOptionsSchema,
});

// =============================================================================
// Type Exports
// =============================================================================

export type ExportPreset = z.infer<typeof exportPresetSchema>;
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
export type BatchExportInput = z.infer<typeof batchExportSchema>;
