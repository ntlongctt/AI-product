/**
 * Project Validation Schemas
 *
 * Zod schemas for validating project-related inputs
 */

import { z } from 'zod';

// =============================================================================
// Layer Schemas
// =============================================================================

export const layerTypeSchema = z.enum(['image', 'background', 'text']);

export const layerSchema = z.object({
  id: z.string().uuid(),
  type: layerTypeSchema,
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(0).max(360).default(0),
  scale: z.number().positive().default(1),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().int().min(0),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
});

export const createLayerSchema = z.object({
  type: layerTypeSchema,
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
  x: z.number().min(0).default(0),
  y: z.number().min(0).default(0),
  width: z.number().positive().default(100),
  height: z.number().positive().default(100),
  rotation: z.number().min(0).max(360).default(0),
  scale: z.number().positive().default(1),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
});

export const updateLayerSchema = z.object({
  id: z.string().uuid(),
  type: layerTypeSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional().nullable(),
  x: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().min(0).max(360).optional(),
  scale: z.number().positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
});

// =============================================================================
// Project Settings Schemas
// =============================================================================

export const projectSettingsSchema = z.object({
  width: z.number().int().positive().min(100).max(10000).default(1200),
  height: z.number().int().positive().min(100).max(10000).default(1200),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// =============================================================================
// Project Schemas
// =============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().max(50).optional(),
  templateId: z.string().uuid().optional(),
  settings: projectSettingsSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sku: z.string().max(50).optional().nullable(),
  layers: z.array(layerSchema).optional(),
  settings: projectSettingsSchema.partial().optional(),
  thumbnailUrl: z.string().url().optional(),
});

export const duplicateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// =============================================================================
// Query Schemas
// =============================================================================

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['active', 'archived']).optional(),
  search: z.string().max(100).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type LayerType = z.infer<typeof layerTypeSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type CreateLayerInput = z.infer<typeof createLayerSchema>;
export type UpdateLayerInput = z.infer<typeof updateLayerSchema>;
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DuplicateProjectInput = z.infer<typeof duplicateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
