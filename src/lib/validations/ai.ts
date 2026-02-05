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
