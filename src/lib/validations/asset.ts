import { z } from 'zod';

export const uploadAssetSchema = z.object({
  type: z.enum(['model', 'product', 'background', 'brand', 'prop']),
  name: z.string().min(1, 'Name is required').max(100),
  tags: z.array(z.string()).default([]),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
});

export type UploadAssetInput = z.infer<typeof uploadAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
