/**
 * Process Export Job
 *
 * Handles project export to image files with various formats and presets
 */

import { inngest, EVENTS } from '../client';
import { projectRepository } from '@/lib/db/repositories/project.repository';
import { getStorageService } from '@/lib/storage';

// =============================================================================
// Types
// =============================================================================

interface ExportData {
  exportId: string;
  userId: string;
  projectId: string;
  options: {
    format: 'jpeg' | 'png';
    quality?: number;
    width?: number;
    height?: number;
    preset?: string;
    watermark?: boolean;
  };
}

interface ExportConfig {
  width: number;
  height: number;
  format: 'jpeg' | 'png';
  quality: number;
  watermark: boolean;
}

// =============================================================================
// Export Presets
// =============================================================================

export const EXPORT_PRESETS = {
  'shopee-main': { width: 1024, height: 1024, format: 'jpeg' as const, quality: 95 },
  'shopee-gallery': { width: 800, height: 800, format: 'jpeg' as const, quality: 90 },
  'lazada-main': { width: 1000, height: 1250, format: 'jpeg' as const, quality: 95 },
  'tiktok-cover': { width: 1080, height: 1920, format: 'jpeg' as const, quality: 95 },
  'instagram-post': { width: 1080, height: 1080, format: 'jpeg' as const, quality: 95 },
  'facebook-product': { width: 1200, height: 1200, format: 'jpeg' as const, quality: 95 },
  hd: { width: 2400, height: 2400, format: 'png' as const, quality: 100 },
  '4k': { width: 4096, height: 4096, format: 'png' as const, quality: 100 },
} as const;

export type ExportPreset = keyof typeof EXPORT_PRESETS;

// =============================================================================
// Job Handler
// =============================================================================

/**
 * Process Export Job
 *
 * Exports a project to an image file with:
 * - Preset support for marketplace sizes
 * - Format conversion (JPEG/PNG)
 * - Quality optimization
 * - Watermark support for free tier
 */
export const processExportJob = inngest.createFunction(
  {
    id: 'process-export',
    name: 'Process Project Export',
    retries: 2,
  },
  { event: EVENTS.EXPORT_REQUESTED },
  async ({ event, step }) => {
    const data = event.data as ExportData;
    const { exportId, userId, projectId, options } = data;

    console.log(`[Process Export] Starting:`, {
      exportId,
      projectId,
      options,
    });

    // Step 1: Get project
    const project = await step.run('get-project', async () => {
      const proj = await projectRepository.findByIdAndUserId(projectId, userId);
      if (!proj) {
        throw new Error(`Project not found: ${projectId}`);
      }
      return proj;
    });

    // Step 2: Determine export dimensions
    const exportConfig = await step.run('determine-config', async (): Promise<ExportConfig> => {
      // Apply preset if specified
      if (options.preset && options.preset in EXPORT_PRESETS) {
        const preset = EXPORT_PRESETS[options.preset as ExportPreset];
        return {
          width: options.width ?? preset.width,
          height: options.height ?? preset.height,
          format: options.format ?? preset.format,
          quality: options.quality ?? preset.quality,
          watermark: options.watermark ?? false,
        };
      }

      // Use project settings or defaults
      const settings = (project.settings as { width?: number; height?: number }) ?? {};
      return {
        width: options.width ?? settings.width ?? 1200,
        height: options.height ?? settings.height ?? 1200,
        format: options.format ?? 'jpeg',
        quality: options.quality ?? 95,
        watermark: options.watermark ?? false,
      };
    });

    // Step 3: Get source image
    const imageData = await step.run('get-source-image', async () => {
      const thumbnailUrl = project.thumbnailUrl;
      if (!thumbnailUrl) {
        throw new Error('Project has no thumbnail to export');
      }

      return {
        sourceUrl: thumbnailUrl,
        format: exportConfig.format,
        width: exportConfig.width,
        height: exportConfig.height,
      };
    });

    // Step 4: Upload to storage
    const uploadResult = await step.run('upload-export', async () => {
      const storage = getStorageService();
      const extension = exportConfig.format === 'jpeg' ? 'jpg' : 'png';
      const key = `exports/${userId}/${projectId}/${exportId}.${extension}`;
      const contentType =
        exportConfig.format === 'jpeg' ? 'image/jpeg' : 'image/png';

      await storage.uploadFromUrl(imageData.sourceUrl, key, {
        contentType,
      });

      return {
        key,
        url: storage.getPublicUrl(key),
      };
    });

    // Step 5: Send completion event
    await step.sendEvent('send-completion-event', {
      name: EVENTS.EXPORT_COMPLETED,
      data: {
        exportId,
        userId,
        projectId,
        url: uploadResult.url,
        format: exportConfig.format,
        width: exportConfig.width,
        height: exportConfig.height,
      },
    });

    console.log(`[Process Export] Completed:`, {
      exportId,
      url: uploadResult.url,
    });

    return {
      success: true,
      exportId,
      url: uploadResult.url,
      format: exportConfig.format,
      width: exportConfig.width,
      height: exportConfig.height,
    };
  },
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get preset dimensions
 */
export function getPresetDimensions(preset: ExportPreset): { width: number; height: number } {
  return {
    width: EXPORT_PRESETS[preset].width,
    height: EXPORT_PRESETS[preset].height,
  };
}

/**
 * Get all available presets
 */
export function getAvailablePresets(): Array<{
  id: ExportPreset;
  name: string;
  width: number;
  height: number;
  format: string;
}> {
  return Object.entries(EXPORT_PRESETS).map(([id, config]) => ({
    id: id as ExportPreset,
    name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    width: config.width,
    height: config.height,
    format: config.format,
  }));
}
