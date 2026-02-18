/**
 * Export Service
 *
 * High-level business logic for project export
 * Handles image rendering, watermarking, and marketplace presets
 */

import { getProjectService } from './project.service';
import { getUserService, PLAN_LIMITS } from './user.service';
import { getStorageService } from '@/lib/storage';
import type { Layer, ProjectSettings, Plan } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface ExportOptions {
  format: 'jpeg' | 'png';
  quality?: number;
  width?: number;
  height?: number;
  preset?: ExportPreset;
  watermark?: boolean;
}

export interface ExportResult {
  url: string;
  key: string;
  format: 'jpeg' | 'png';
  width: number;
  height: number;
  size: number;
}

export interface BatchExportResult {
  exports: ExportResult[];
  totalSize: number;
}

export type ExportPreset =
  | 'shopee-main'
  | 'shopee-gallery'
  | 'lazada-main'
  | 'tiktok-cover'
  | 'instagram-post'
  | 'facebook-product'
  | 'hd'
  | '4k';

// =============================================================================
// Export Presets
// =============================================================================

export const EXPORT_PRESETS: Record<ExportPreset, {
  width: number;
  height: number;
  format: 'jpeg' | 'png';
  quality: number;
  description: string;
}> = {
  'shopee-main': {
    width: 1024,
    height: 1024,
    format: 'jpeg',
    quality: 95,
    description: 'Shopee main product image (1024x1024)',
  },
  'shopee-gallery': {
    width: 800,
    height: 800,
    format: 'jpeg',
    quality: 90,
    description: 'Shopee gallery image (800x800)',
  },
  'lazada-main': {
    width: 1000,
    height: 1250,
    format: 'jpeg',
    quality: 95,
    description: 'Lazada main product image (1000x1250)',
  },
  'tiktok-cover': {
    width: 1080,
    height: 1920,
    format: 'jpeg',
    quality: 95,
    description: 'TikTok video cover (1080x1920)',
  },
  'instagram-post': {
    width: 1080,
    height: 1080,
    format: 'jpeg',
    quality: 95,
    description: 'Instagram square post (1080x1080)',
  },
  'facebook-product': {
    width: 1200,
    height: 1200,
    format: 'jpeg',
    quality: 95,
    description: 'Facebook product image (1200x1200)',
  },
  hd: {
    width: 2400,
    height: 2400,
    format: 'png',
    quality: 100,
    description: 'High definition export (2400x2400)',
  },
  '4k': {
    width: 4096,
    height: 4096,
    format: 'png',
    quality: 100,
    description: '4K export (4096x4096)',
  },
};

// =============================================================================
// Export Service Class
// =============================================================================

export class ExportService {
  /**
   * Export project to image
   */
  async exportProject(
    projectId: string,
    userId: string,
    options: ExportOptions,
  ): Promise<ExportResult> {
    // Get project
    const projectService = getProjectService();
    const project = await projectService.getById(projectId, userId);

    if (!project) {
      throw new Error('Project not found');
    }

    // Check if user needs watermark
    const userService = getUserService();
    const user = await userService.getById(userId);
    const needsWatermark = options.watermark ?? (user ? PLAN_LIMITS[user.plan].watermark : true);

    // Determine export config
    const config = this.resolveConfig(options, project.settings as ProjectSettings);

    // Render project to image
    const imageData = await this.renderProject(
      (project.layers as Layer[]) ?? [],
      config,
      needsWatermark,
    );

    // Upload to storage
    const storage = getStorageService();
    const extension = config.format === 'jpeg' ? 'jpg' : 'png';
    const key = `exports/${userId}/${projectId}/${Date.now()}.${extension}`;
    const contentType = config.format === 'jpeg' ? 'image/jpeg' : 'image/png';

    const uploadResult = await storage.uploadBuffer(
      imageData,
      key,
      contentType,
    );

    return {
      url: uploadResult.url,
      key: uploadResult.key,
      format: config.format,
      width: config.width,
      height: config.height,
      size: uploadResult.size,
    };
  }

  /**
   * Batch export multiple projects
   */
  async batchExport(
    projectIds: string[],
    userId: string,
    options: ExportOptions,
  ): Promise<BatchExportResult> {
    const exports: ExportResult[] = [];
    let totalSize = 0;

    for (const projectId of projectIds) {
      try {
        const result = await this.exportProject(projectId, userId, options);
        exports.push(result);
        totalSize += result.size;
      } catch (error) {
        console.error(`Failed to export project ${projectId}:`, error);
      }
    }

    return { exports, totalSize };
  }

  /**
   * Render project layers to image buffer
   * Note: This is a placeholder. In production, use Sharp or Canvas
   */
  private async renderProject(
    layers: Layer[],
    config: { width: number; height: number; format: 'jpeg' | 'png'; quality: number },
    watermark: boolean,
  ): Promise<Buffer> {
    // In production, this would:
    // 1. Create a canvas with the target dimensions
    // 2. Load all layer images
    // 3. Composite layers in z-order
    // 4. Apply watermark if needed
    // 5. Encode to target format with quality

    console.log('[Export] Rendering project:', {
      layerCount: layers.length,
      width: config.width,
      height: config.height,
      format: config.format,
      watermark,
    });

    // Placeholder: Return empty buffer
    // In production, this would be the actual rendered image
    return Buffer.from('');
  }

  /**
   * Resolve export configuration from options and preset
   */
  private resolveConfig(
    options: ExportOptions,
    projectSettings?: ProjectSettings,
  ): { width: number; height: number; format: 'jpeg' | 'png'; quality: number } {
    // Apply preset if specified
    if (options.preset && options.preset in EXPORT_PRESETS) {
      const preset = EXPORT_PRESETS[options.preset];
      return {
        width: options.width ?? preset.width,
        height: options.height ?? preset.height,
        format: options.format ?? preset.format,
        quality: options.quality ?? preset.quality,
      };
    }

    // Use project settings or defaults
    return {
      width: options.width ?? projectSettings?.width ?? 1200,
      height: options.height ?? projectSettings?.height ?? 1200,
      format: options.format ?? 'jpeg',
      quality: options.quality ?? 95,
    };
  }

  // ==========================================================================
  // Preset Helpers
  // ==========================================================================

  /**
   * Get all available presets
   */
  getPresets(): Array<{
    id: ExportPreset;
    name: string;
    width: number;
    height: number;
    format: 'jpeg' | 'png';
    description: string;
  }> {
    return Object.entries(EXPORT_PRESETS).map(([id, config]) => ({
      id: id as ExportPreset,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      width: config.width,
      height: config.height,
      format: config.format,
      description: config.description,
    }));
  }

  /**
   * Get preset by ID
   */
  getPreset(presetId: ExportPreset): (typeof EXPORT_PRESETS)[ExportPreset] | undefined {
    return EXPORT_PRESETS[presetId];
  }

  /**
   * Get presets by marketplace
   */
  getPresetsByMarketplace(marketplace: 'shopee' | 'lazada' | 'tiktok' | 'social'): ExportPreset[] {
    const marketplaceMap: Record<string, ExportPreset[]> = {
      shopee: ['shopee-main', 'shopee-gallery'],
      lazada: ['lazada-main'],
      tiktok: ['tiktok-cover'],
      social: ['instagram-post', 'facebook-product'],
    };

    return marketplaceMap[marketplace] ?? [];
  }

  // ==========================================================================
  // Watermark
  // ==========================================================================

  /**
   * Check if watermark is required for user's plan
   */
  requiresWatermark(plan: Plan): boolean {
    return PLAN_LIMITS[plan].watermark;
  }

  /**
   * Apply watermark to image
   * Note: Placeholder for watermark logic
   */
  private applyWatermark(imageBuffer: Buffer): Buffer {
    // In production, this would overlay a watermark image
    // at a specified position with opacity
    return imageBuffer;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let exportService: ExportService | null = null;

export function getExportService(): ExportService {
  if (!exportService) {
    exportService = new ExportService();
  }
  return exportService;
}

export function resetExportService(): void {
  exportService = null;
}
