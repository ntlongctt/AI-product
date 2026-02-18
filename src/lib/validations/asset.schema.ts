/**
 * Asset Validation Schemas
 *
 * Zod schemas for validating asset-related inputs
 */

import { z } from 'zod';

// =============================================================================
// Asset Type Schema
// =============================================================================

export const assetTypeSchema = z.enum(['model', 'product', 'background', 'brand', 'prop']);

// =============================================================================
// Asset Schemas
// =============================================================================

export const assetMetadataSchema = z.object({
  originalFilename: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export const createAssetSchema = z.object({
  type: assetTypeSchema,
  name: z.string().min(1).max(100),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  fileSize: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: assetMetadataSchema.optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: assetMetadataSchema.optional(),
});

// =============================================================================
// Query Schemas
// =============================================================================

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: assetTypeSchema.optional(),
  search: z.string().max(100).optional(),
  tags: z.string().transform((val) => val.split(',').map((t) => t.trim())).optional(),
});

export const presignedUploadQuerySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|gif)$/),
  type: assetTypeSchema,
});

// =============================================================================
// Bulk Operation Schemas
// =============================================================================

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const bulkTagSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  tags: z.array(z.string().max(50)).min(1).max(20),
});

// =============================================================================
// Type Exports
// =============================================================================

export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetMetadata = z.infer<typeof assetMetadataSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
export type PresignedUploadQuery = z.infer<typeof presignedUploadQuerySchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type BulkTagInput = z.infer<typeof bulkTagSchema>;
