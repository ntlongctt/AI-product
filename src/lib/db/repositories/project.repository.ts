/**
 * Project Repository
 *
 * Handles all database operations for projects
 */

import { eq, and, desc, sql, like } from 'drizzle-orm';
import { db, projects, users, type Project, type NewProject, type Layer } from '../index';

export interface ProjectFilters {
  status?: 'active' | 'archived' | 'deleted';
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ProjectRepository {
  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find project by ID and user ID (ensures ownership)
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Project | null> {
    const result = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Create a new project
   */
  async create(data: NewProject): Promise<Project> {
    const result = await db.insert(projects).values(data).returning();
    return result[0];
  }

  /**
   * Update project
   */
  async update(id: string, data: Partial<NewProject>): Promise<Project> {
    const result = await db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete project (soft delete by setting status to 'deleted')
   */
  async delete(id: string): Promise<void> {
    await this.update(id, { status: 'deleted' });
  }

  /**
   * Hard delete project
   */
  async hardDelete(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  /**
   * List projects by user ID with pagination
   */
  async listByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: ProjectFilters,
  ): Promise<PaginatedResult<Project>> {
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(projects.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    } else {
      // Default: exclude deleted projects
      conditions.push(sql`${projects.status} != 'deleted'`);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
    let query = db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const data = await query;

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update project layers
   */
  async updateLayers(id: string, layers: Layer[]): Promise<Project> {
    return this.update(id, { layers });
  }

  /**
   * Add a layer to project
   */
  async addLayer(id: string, layer: Omit<Layer, 'id' | 'zIndex'>): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    const currentLayers = project.layers ?? [];
    const newLayer: Layer = {
      ...layer,
      id: crypto.randomUUID(),
      zIndex: currentLayers.length,
    };

    return this.update(id, {
      layers: [...currentLayers, newLayer],
    });
  }

  /**
   * Update project thumbnail
   */
  async updateThumbnail(id: string, thumbnailUrl: string): Promise<Project> {
    return this.update(id, { thumbnailUrl });
  }

  /**
   * Archive project
   */
  async archive(id: string): Promise<Project> {
    return this.update(id, { status: 'archived' });
  }

  /**
   * Restore archived project
   */
  async restore(id: string): Promise<Project> {
    return this.update(id, { status: 'active' });
  }

  /**
   * Duplicate project
   */
  async duplicate(id: string, newName?: string): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    return this.create({
      userId: project.userId,
      name: newName ?? `${project.name} (Copy)`,
      sku: project.sku,
      layers: project.layers,
      settings: project.settings,
      status: 'active',
    });
  }

  /**
   * Count projects by user ID
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.status, 'active')));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get recent projects
   */
  async getRecent(userId: string, limit: number = 5): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.status, 'active')))
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
  }
}

// Export singleton instance
export const projectRepository = new ProjectRepository();
