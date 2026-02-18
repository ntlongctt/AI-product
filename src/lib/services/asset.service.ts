/**
 * Asset Service
 *
 * High-level business logic for asset management
 * Handles CRUD operations, bulk operations, tagging, and model library
 */

import { assetRepository, type AssetFilters } from '@/lib/db/repositories/asset.repository';
import { getStorageService } from '@/lib/storage';
import type { Asset, NewAsset, AssetType } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface CreateAssetInput {
  userId: string;
  type: AssetType;
  name: string;
  url: string;
  thumbnailUrl?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  tags?: string[];
  metadata?: {
    originalFilename?: string;
    description?: string;
  };
}

export interface UpdateAssetInput {
  name?: string;
  tags?: string[];
  metadata?: {
    originalFilename?: string;
    description?: string;
  };
}

export interface AssetListResult {
  assets: Asset[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: Date;
}

// =============================================================================
// Default Model Library
// =============================================================================

const DEFAULT_MODELS: Array<{
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  category: string;
  gender: 'male' | 'female';
  pose: string;
}> = [
  {
    id: 'model-1',
    name: 'Female Casual Pose 1',
    url: 'https://example.com/models/female-casual-1.png',
    thumbnailUrl: 'https://example.com/models/female-casual-1-thumb.jpg',
    category: 'casual',
    gender: 'female',
    pose: 'standing',
  },
  {
    id: 'model-2',
    name: 'Female Casual Pose 2',
    url: 'https://example.com/models/female-casual-2.png',
    thumbnailUrl: 'https://example.com/models/female-casual-2-thumb.jpg',
    category: 'casual',
    gender: 'female',
    pose: 'sitting',
  },
  {
    id: 'model-3',
    name: 'Male Casual Pose 1',
    url: 'https://example.com/models/male-casual-1.png',
    thumbnailUrl: 'https://example.com/models/male-casual-1-thumb.jpg',
    category: 'casual',
    gender: 'male',
    pose: 'standing',
  },
];

// =============================================================================
// Asset Service Class
// =============================================================================

export class AssetService {
  /**
   * Get presigned URL for uploading an asset
   */
  async getPresignedUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    type: AssetType,
  ): Promise<PresignedUploadResult> {
    const storage = getStorageService();
    const result = await storage.getPresignedUploadUrl(
      userId,
      filename,
      contentType,
      'assets',
    );

    return result;
  }

  /**
   * Create asset after upload
   */
  async create(input: CreateAssetInput): Promise<Asset> {
    const { userId, type, name, url, thumbnailUrl, fileSize, width, height, mimeType, tags, metadata } = input;

    // Generate thumbnail if not provided and it's an image
    let finalThumbnailUrl = thumbnailUrl;
    if (!finalThumbnailUrl && mimeType?.startsWith('image/')) {
      const storage = getStorageService();
      // Extract key from URL to generate thumbnail path
      finalThumbnailUrl = storage.getThumbnailUrl(url, 200);
    }

    return assetRepository.create({
      userId,
      type,
      name,
      url,
      thumbnailUrl: finalThumbnailUrl,
      fileSize,
      width,
      height,
      mimeType,
      tags: tags ?? [],
      metadata: metadata ?? {},
    });
  }

  /**
   * Get asset by ID
   * Ensures user owns the asset
   */
  async getById(assetId: string, userId: string): Promise<Asset | null> {
    return assetRepository.findByIdAndUserId(assetId, userId);
  }

  /**
   * List assets for a user
   */
  async list(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: AssetFilters,
  ): Promise<AssetListResult> {
    const result = await assetRepository.listByUserId(userId, page, pageSize, filters);

    return {
      assets: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  /**
   * Update asset
   */
  async update(assetId: string, userId: string, input: UpdateAssetInput): Promise<Asset> {
    // Verify ownership
    const asset = await this.getById(assetId, userId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    return assetRepository.update(assetId, input);
  }

  /**
   * Delete asset
   * Also deletes from storage
   */
  async delete(assetId: string, userId: string): Promise<void> {
    // Verify ownership
    const asset = await this.getById(assetId, userId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Delete from storage
    const storage = getStorageService();
    const key = this.extractKeyFromUrl(asset.url);
    if (key) {
      await storage.delete(key);
    }

    // Delete from database
    await assetRepository.delete(assetId);
  }

  /**
   * Delete multiple assets
   */
  async deleteMany(assetIds: string[], userId: string): Promise<{ deleted: number }> {
    const deletedIds: string[] = [];

    for (const assetId of assetIds) {
      try {
        await this.delete(assetId, userId);
        deletedIds.push(assetId);
      } catch (error) {
        console.error(`Failed to delete asset ${assetId}:`, error);
      }
    }

    return { deleted: deletedIds.length };
  }

  // ==========================================================================
  // Tag Management
  // ==========================================================================

  /**
   * Add tags to asset
   */
  async addTags(assetId: string, userId: string, tags: string[]): Promise<Asset> {
    const asset = await this.getById(assetId, userId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    return assetRepository.addTags(assetId, tags);
  }

  /**
   * Remove tags from asset
   */
  async removeTags(assetId: string, userId: string, tags: string[]): Promise<Asset> {
    const asset = await this.getById(assetId, userId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    return assetRepository.removeTags(assetId, tags);
  }

  /**
   * Add tags to multiple assets
   */
  async addTagsToMany(assetIds: string[], userId: string, tags: string[]): Promise<{ updated: number }> {
    await assetRepository.addTagsToMany(assetIds, userId, tags);
    return { updated: assetIds.length };
  }

  // ==========================================================================
  // Asset Type Helpers
  // ==========================================================================

  /**
   * Get models (for virtual try-on)
   */
  async getModels(userId: string): Promise<Asset[]> {
    return assetRepository.getModels(userId);
  }

  /**
   * Get products
   */
  async getProducts(userId: string): Promise<Asset[]> {
    return assetRepository.getProducts(userId);
  }

  /**
   * Get backgrounds
   */
  async getBackgrounds(userId: string): Promise<Asset[]> {
    return assetRepository.getBackgrounds(userId);
  }

  /**
   * Get brand assets
   */
  async getBrandAssets(userId: string): Promise<Asset[]> {
    return assetRepository.getBrandAssets(userId);
  }

  // ==========================================================================
  // Model Library
  // ==========================================================================

  /**
   * Get default model library
   * These are available to all users for virtual try-on
   */
  getModelLibrary(): typeof DEFAULT_MODELS {
    return DEFAULT_MODELS;
  }

  /**
   * Get model library by category
   */
  getModelLibraryByCategory(category: string): typeof DEFAULT_MODELS {
    return DEFAULT_MODELS.filter((model) => model.category === category);
  }

  /**
   * Get model library by gender
   */
  getModelLibraryByGender(gender: 'male' | 'female'): typeof DEFAULT_MODELS {
    return DEFAULT_MODELS.filter((model) => model.gender === gender);
  }

  /**
   * Get model categories
   */
  getModelCategories(): string[] {
    const categories = new Set(DEFAULT_MODELS.map((m) => m.category));
    return Array.from(categories);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get recent assets
   */
  async getRecent(userId: string, limit: number = 10): Promise<Asset[]> {
    return assetRepository.getRecent(userId, limit);
  }

  /**
   * Count assets for user
   */
  async count(userId: string): Promise<number> {
    return assetRepository.countByUserId(userId);
  }

  /**
   * Extract storage key from URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.slice(1);
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let assetService: AssetService | null = null;

export function getAssetService(): AssetService {
  if (!assetService) {
    assetService = new AssetService();
  }
  return assetService;
}

export function resetAssetService(): void {
  assetService = null;
}
