/**
 * Template Repository
 *
 * Handles all database operations for templates
 * Templates are pre-made project configurations
 */

import { eq, and, desc, sql, like, asc } from 'drizzle-orm';
import { db, templates, type Template, type NewTemplate } from '../index';

export interface TemplateFilters {
  category?: string;
  isFree?: boolean;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class TemplateRepository {
  /**
   * Find template by ID
   */
  async findById(id: string): Promise<Template | null> {
    const result = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find template by slug
   */
  async findBySlug(slug: string): Promise<Template | null> {
    const result = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, slug))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Create a new template (admin use)
   */
  async create(data: NewTemplate): Promise<Template> {
    const result = await db.insert(templates).values(data).returning();
    return result[0];
  }

  /**
   * Update template (admin use)
   */
  async update(id: string, data: Partial<NewTemplate>): Promise<Template> {
    const result = await db
      .update(templates)
      .set(data)
      .where(eq(templates.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete template (admin use)
   */
  async delete(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  /**
   * List all active templates with filters
   */
  async list(
    page: number = 1,
    pageSize: number = 20,
    filters?: TemplateFilters,
  ): Promise<PaginatedResult<Template>> {
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(templates.isActive, true)];

    if (filters?.category) {
      conditions.push(eq(templates.category, filters.category));
    }

    if (filters?.isFree !== undefined) {
      conditions.push(eq(templates.isFree, filters.isFree));
    }

    if (filters?.search) {
      conditions.push(like(templates.name, `%${filters.search}%`));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
    const data = await db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(asc(templates.sortOrder), desc(templates.usageCount))
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
   * Get all templates (no pagination, for admin)
   */
  async getAll(): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(asc(templates.sortOrder), asc(templates.name));
  }

  /**
   * Get templates by category
   */
  async getByCategory(category: string): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.category, category), eq(templates.isActive, true)))
      .orderBy(asc(templates.sortOrder), desc(templates.usageCount));
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const result = await db
      .selectDistinct({ category: templates.category })
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(asc(templates.category));

    return result.map((r) => r.category);
  }

  /**
   * Get trending templates (by usage count)
   */
  async getTrending(limit: number = 10): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(desc(templates.usageCount))
      .limit(limit);
  }

  /**
   * Get free templates
   */
  async getFree(): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.isFree, true), eq(templates.isActive, true)))
      .orderBy(asc(templates.sortOrder), desc(templates.usageCount));
  }

  /**
   * Get premium templates (requires Pro plan)
   */
  async getPremium(): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(and(eq(templates.isFree, false), eq(templates.isActive, true)))
      .orderBy(asc(templates.sortOrder), desc(templates.usageCount));
  }

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<void> {
    await db
      .update(templates)
      .set({
        usageCount: sql`${templates.usageCount} + 1`,
      })
      .where(eq(templates.id, id));
  }

  /**
   * Search templates
   */
  async search(query: string, limit: number = 20): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.isActive, true),
          sql`${templates.name} ILIKE ${`%${query}%`} OR ${templates.category} ILIKE ${`%${query}%`}`,
        ),
      )
      .orderBy(desc(templates.usageCount))
      .limit(limit);
  }

  /**
   * Count templates
   */
  async count(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(eq(templates.isActive, true));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Check if template exists and is accessible for user's plan
   */
  async isAccessible(id: string, isPro: boolean): Promise<boolean> {
    const template = await this.findById(id);
    if (!template || !template.isActive) {
      return false;
    }
    return template.isFree || isPro;
  }
}

// Export singleton instance
export const templateRepository = new TemplateRepository();
