import { describe, it, expect } from 'vitest';
import {
  getProviderForTask,
  getFallbackProvider,
  hasFallbackProvider,
  AI_ROUTING,
  type ProviderConfig,
} from '@/lib/ai/router';
import type { AITask, AIProvider } from '@/types';

describe('AI Router', () => {
  describe('AI_ROUTING configuration', () => {
    it('should have configuration for all AITask types', () => {
      const allTasks: AITask[] = [
        'remove-bg',
        'upscale',
        'polish',
        'relight',
        'scene-gen',
        'try-on',
        'object-removal',
        'text-removal',
      ];

      for (const task of allTasks) {
        expect(AI_ROUTING[task]).toBeDefined();
        expect(AI_ROUTING[task].primary).toBeDefined();
        expect(AI_ROUTING[task].model).toBeDefined();
      }
    });

    it('should have valid provider values', () => {
      const validProviders: AIProvider[] = ['gemini', 'zai'];

      for (const task of Object.keys(AI_ROUTING) as AITask[]) {
        const config = AI_ROUTING[task];
        expect(validProviders).toContain(config.primary);

        if (config.fallback) {
          expect(validProviders).toContain(config.fallback);
        }
      }
    });

    it('should route scene-gen to z.ai as primary', () => {
      expect(AI_ROUTING['scene-gen'].primary).toBe('zai');
      expect(AI_ROUTING['scene-gen'].model).toBe('glm-image');
    });

    it('should route remove-bg to gemini as primary', () => {
      expect(AI_ROUTING['remove-bg'].primary).toBe('gemini');
      expect(AI_ROUTING['remove-bg'].model).toBe('gemini-2.5-flash-preview-05-20');
    });

    it('should have fallback for most tasks', () => {
      expect(AI_ROUTING['scene-gen'].fallback).toBe('gemini');
      expect(AI_ROUTING['remove-bg'].fallback).toBe('zai');
      expect(AI_ROUTING['upscale'].fallback).toBe('zai');
      expect(AI_ROUTING['polish'].fallback).toBe('zai');
      expect(AI_ROUTING['try-on'].fallback).toBe('zai');
      expect(AI_ROUTING['object-removal'].fallback).toBe('zai');
    });

    it('should have null fallback for relight and text-removal', () => {
      expect(AI_ROUTING['relight'].fallback).toBeNull();
      expect(AI_ROUTING['text-removal'].fallback).toBeNull();
    });
  });

  describe('getProviderForTask', () => {
    it('should return provider config for valid tasks', () => {
      const testCases: Array<{ task: AITask; expectedPrimary: AIProvider }> = [
        { task: 'scene-gen', expectedPrimary: 'zai' },
        { task: 'remove-bg', expectedPrimary: 'gemini' },
        { task: 'upscale', expectedPrimary: 'gemini' },
        { task: 'polish', expectedPrimary: 'gemini' },
        { task: 'relight', expectedPrimary: 'gemini' },
        { task: 'try-on', expectedPrimary: 'gemini' },
        { task: 'object-removal', expectedPrimary: 'gemini' },
        { task: 'text-removal', expectedPrimary: 'gemini' },
      ];

      for (const { task, expectedPrimary } of testCases) {
        const config = getProviderForTask(task);
        expect(config).toBeDefined();
        expect(config.primary).toBe(expectedPrimary);
        expect(config.model).toBeDefined();
      }
    });

    it('should return complete ProviderConfig structure', () => {
      const config = getProviderForTask('scene-gen');

      expect(config).toHaveProperty('primary');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('fallback');
    });

    it('should throw error for invalid task', () => {
      expect(() => getProviderForTask('invalid-task' as AITask)).toThrow(
        'No provider configuration found for task: invalid-task'
      );
    });

    it('should return consistent results for same task', () => {
      const config1 = getProviderForTask('scene-gen');
      const config2 = getProviderForTask('scene-gen');

      expect(config1).toEqual(config2);
    });
  });

  describe('getFallbackProvider', () => {
    it('should return fallback provider for tasks with fallback', () => {
      expect(getFallbackProvider('scene-gen')).toBe('gemini');
      expect(getFallbackProvider('remove-bg')).toBe('zai');
      expect(getFallbackProvider('upscale')).toBe('zai');
      expect(getFallbackProvider('polish')).toBe('zai');
      expect(getFallbackProvider('try-on')).toBe('zai');
      expect(getFallbackProvider('object-removal')).toBe('zai');
    });

    it('should return null for tasks without fallback', () => {
      expect(getFallbackProvider('relight')).toBeNull();
      expect(getFallbackProvider('text-removal')).toBeNull();
    });

    it('should return null for unknown tasks', () => {
      expect(getFallbackProvider('unknown-task' as AITask)).toBeNull();
    });
  });

  describe('hasFallbackProvider', () => {
    it('should return true for tasks with fallback', () => {
      expect(hasFallbackProvider('scene-gen')).toBe(true);
      expect(hasFallbackProvider('remove-bg')).toBe(true);
      expect(hasFallbackProvider('upscale')).toBe(true);
      expect(hasFallbackProvider('polish')).toBe(true);
      expect(hasFallbackProvider('try-on')).toBe(true);
      expect(hasFallbackProvider('object-removal')).toBe(true);
    });

    it('should return false for tasks without fallback', () => {
      expect(hasFallbackProvider('relight')).toBe(false);
      expect(hasFallbackProvider('text-removal')).toBe(false);
    });

    it('should return false for unknown tasks', () => {
      expect(hasFallbackProvider('unknown-task' as AITask)).toBe(false);
    });
  });

  describe('routing rules compliance', () => {
    it('should follow documented routing: remove-bg: Gemini → z.ai', () => {
      const config = getProviderForTask('remove-bg');
      expect(config.primary).toBe('gemini');
      expect(config.fallback).toBe('zai');
    });

    it('should follow documented routing: scene-gen: z.ai → Gemini', () => {
      const config = getProviderForTask('scene-gen');
      expect(config.primary).toBe('zai');
      expect(config.fallback).toBe('gemini');
    });

    it('should use gemini-2.5-flash-preview-05-20 for gemini tasks', () => {
      const geminiTasks: AITask[] = [
        'remove-bg',
        'upscale',
        'polish',
        'relight',
        'try-on',
        'object-removal',
        'text-removal',
      ];

      for (const task of geminiTasks) {
        const config = getProviderForTask(task);
        expect(config.model).toBe('gemini-2.5-flash-preview-05-20');
      }
    });

    it('should use glm-image for z.ai scene-gen task', () => {
      const config = getProviderForTask('scene-gen');
      expect(config.model).toBe('glm-image');
    });
  });
});
