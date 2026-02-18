import { z } from 'zod';

export const generateImageSchema = z.object({
  task: z.enum([
    'remove-bg',
    'upscale',
    'polish',
    'relight',
    'scene-gen',
    'try-on',
    'object-removal',
    'text-removal',
  ]),
  inputUrl: z.string().url('Valid image URL is required'),
  prompt: z.string().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

// Specialized task validation schemas
export const removeBgSchema = z.object({
  image: z.string().url('Valid image URL is required'),
  projectId: z.string().uuid().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export type RemoveBgInput = z.infer<typeof removeBgSchema>;

export const sceneGenSchema = z.object({
  productImage: z.string().url('Valid product image URL is required'),
  sceneDescription: z.string().min(1, 'Scene description is required').max(2000),
  projectId: z.string().uuid().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export type SceneGenInput = z.infer<typeof sceneGenSchema>;

export const tryOnSchema = z.object({
  personImage: z.string().url('Valid person image URL is required'),
  garmentImage: z.string().url('Valid garment image URL is required'),
  projectId: z.string().uuid().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export type TryOnInput = z.infer<typeof tryOnSchema>;
