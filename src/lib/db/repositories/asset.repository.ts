/**
 * Asset Repository
 *
 * Handles all database operations for assets
 */

import { eq, and, desc, sql, inArray, or, like } from 'drizzle-orm';
import { db, assets, type Asset, type NewAsset, type AssetType } from '../index';

export interface AssetFilters {
  type?: AssetType;
  search?: string;
  tags?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ModelCategory {
  gender: 'male' | 'female';
  pose: string;
}

export class AssetRepository {
  /**
   * Find asset by ID
   */
  async findById(id: string): Promise<Asset | null> {
    const result = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find asset by ID and user ID (ensures ownership)
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Asset | null> {
    const result = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Create a new asset
   */
  async create(data: NewAsset): Promise<Asset> {
    const result = await db.insert(assets).values(data).returning();
    return result[0];
  }

  /**
   * Update asset
   */
  async update(id: string, data: Partial<NewAsset>): Promise<Asset> {
    const result = await db
      .update(assets)
      .set(data)
      .where(eq(assets.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete asset
   */
  async delete(id: string): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  /**
   * Delete multiple assets
   */
  async deleteMany(ids: string[], userId: string): Promise<void> {
    await db
      .delete(assets)
      .where(and(inArray(assets.id, ids), eq(assets.userId, userId)));
  }

  /**
   * List assets by user ID with pagination
   */
  async listByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: AssetFilters,
  ): Promise<PaginatedResult<Asset>> {
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(assets.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(assets.type, filters.type));
    }

    if (filters?.search) {
      conditions.push(like(assets.name, `%${filters.search}%`));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
    const data = await db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Add tags to asset
   */
  async addTags(id: string, tags: string[]): Promise<Asset> {
    const asset = await this.findById(id);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const currentTags = asset.tags ?? [];
    const newTags = [...new Set([...currentTags, ...tags])];

    return this.update(id, { tags: newTags });
  }

  /**
   * Remove tags from asset
   */
  async removeTags(id: string, tags: string[]): Promise<Asset> {
    const asset = await this.findById(id);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const currentTags = asset.tags ?? [];
    const newTags = currentTags.filter((tag) => !tags.includes(tag));

    return this.update(id, { tags: newTags });
  }

  /**
   * Add tags to multiple assets
   */
  async addTagsToMany(ids: string[], userId: string, tags: string[]): Promise<void> {
    for (const id of ids) {
      const asset = await this.findByIdAndUserId(id, userId);
      if (asset) {
        await this.addTags(id, tags);
      }
    }
  }

  /**
   * Search assets by tags
   */
  async searchByTags(userId: string, tags: string[]): Promise<Asset[]> {
    // Note: This is a simple implementation. For production, consider using
    // PostgreSQL array operators or a full-text search solution
    const allAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId));

    return allAssets.filter((asset) => {
      const assetTags = asset.tags ?? [];
      return tags.some((tag) => assetTags.includes(tag));
    });
  }

  /**
   * Get assets by type
   */
  async getByType(userId: string, type: AssetType): Promise<Asset[]> {
    return db
      .select()
      .from(assets)
      .where(and(eq(assets.userId, userId), eq(assets.type, type)))
      .orderBy(desc(assets.createdAt));
  }

  /**
   * Get model assets (for virtual try-on)
   */
  async getModels(userId: string): Promise<Asset[]> {
    return this.getByType(userId, 'model');
  }

  /**
   * Get product assets
   */
  async getProducts(userId: string): Promise<Asset[]> {
    return this.getByType(userId, 'product');
  }

  /**
   * Get background assets
   */
  async getBackgrounds(userId: string): Promise<Asset[]> {
    return this.getByType(userId, 'background');
  }

  /**
   * Get brand assets
   */
  async getBrandAssets(userId: string): Promise<Asset[]> {
    return this.getByType(userId, 'brand');
  }

  /**
   * Count assets by user ID
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.userId, userId));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get recent assets
   */
  async getRecent(userId: string, limit: number = 10): Promise<Asset[]> {
    return db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId))
      .orderBy(desc(assets.createdAt))
      .limit(limit);
  }
}

// Export singleton instance
export const assetRepository = new AssetRepository();
