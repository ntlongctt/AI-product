import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  sku: z.string().max(50).optional(),
  width: z.number().min(100).max(4096).default(1200),
  height: z.number().min(100).max(4096).default(1200),
  templateId: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sku: z.string().max(50).optional(),
  layers: z.array(z.any()).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
