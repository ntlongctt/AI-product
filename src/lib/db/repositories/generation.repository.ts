/**
 * Generation Repository
 *
 * Handles all database operations for AI generations
 * Tracks AI job history, status, and results
 */

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  db,
  generations,
  type Generation,
  type NewGeneration,
  type GenerationStatus,
  type AITask,
  type AIProvider,
} from '../index';

export interface GenerationFilters {
  status?: GenerationStatus;
  task?: AITask;
  provider?: AIProvider;
  projectId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GenerationStats {
  total: number;
  byStatus: Record<GenerationStatus, number>;
  byTask: Record<string, number>;
  byProvider: Record<string, number>;
  totalCost: number;
}

export class GenerationRepository {
  /**
   * Find generation by ID
   */
  async findById(id: string): Promise<Generation | null> {
    const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find generation by ID and user ID (ensures ownership)
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Generation | null> {
    const result = await db
      .select()
      .from(generations)
      .where(and(eq(generations.id, id), eq(generations.userId, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Find generation by external job ID
   */
  async findByExternalJobId(externalJobId: string): Promise<Generation | null> {
    const result = await db
      .select()
      .from(generations)
      .where(eq(generations.externalJobId, externalJobId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Create a new generation record
   */
  async create(data: NewGeneration): Promise<Generation> {
    const result = await db.insert(generations).values(data).returning();
    return result[0];
  }

  /**
   * Update generation
   */
  async update(id: string, data: Partial<NewGeneration>): Promise<Generation> {
    const result = await db
      .update(generations)
      .set(data)
      .where(eq(generations.id, id))
      .returning();
    return result[0];
  }

  /**
   * Delete generation
   */
  async delete(id: string): Promise<void> {
    await db.delete(generations).where(eq(generations.id, id));
  }

  /**
   * List generations by user ID with pagination
   */
  async listByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: GenerationFilters,
  ): Promise<PaginatedResult<Generation>> {
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(generations.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(generations.status, filters.status));
    }

    if (filters?.task) {
      conditions.push(eq(generations.task, filters.task));
    }

    if (filters?.provider) {
      conditions.push(eq(generations.provider, filters.provider));
    }

    if (filters?.projectId) {
      conditions.push(eq(generations.projectId, filters.projectId));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
    const data = await db
      .select()
      .from(generations)
      .where(and(...conditions))
      .orderBy(desc(generations.createdAt))
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
   * Update generation status
   */
  async updateStatus(
    id: string,
    status: GenerationStatus,
    additionalData?: Partial<NewGeneration>,
  ): Promise<Generation> {
    const updateData: Partial<NewGeneration> = { status, ...additionalData };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    return this.update(id, updateData);
  }

  /**
   * Mark generation as processing
   */
  async markProcessing(id: string): Promise<Generation> {
    return this.updateStatus(id, 'processing');
  }

  /**
   * Mark generation as completed with output
   */
  async markCompleted(
    id: string,
    outputUrl: string,
    outputUrls?: string[],
    cost?: number,
    durationMs?: number,
  ): Promise<Generation> {
    return this.updateStatus(id, 'completed', {
      outputUrl,
      outputUrls,
      cost,
      durationMs,
    });
  }

  /**
   * Mark generation as failed
   */
  async markFailed(id: string, error: string, errorCode?: string): Promise<Generation> {
    return this.updateStatus(id, 'failed', { error, errorCode });
  }

  /**
   * Set external job ID
   */
  async setExternalJobId(id: string, externalJobId: string): Promise<Generation> {
    return this.update(id, { externalJobId });
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(id: string): Promise<Generation> {
    const generation = await this.findById(id);
    if (!generation) {
      throw new Error('Generation not found');
    }

    return this.update(id, {
      retryCount: (generation.retryCount ?? 0) + 1,
    });
  }

  /**
   * Get pending generations (for job queue)
   */
  async getPending(limit: number = 100): Promise<Generation[]> {
    return db
      .select()
      .from(generations)
      .where(eq(generations.status, 'pending'))
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  }

  /**
   * Get stuck generations (processing for too long)
   */
  async getStuck(timeoutMinutes: number = 10): Promise<Generation[]> {
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    return db
      .select()
      .from(generations)
      .where(
        and(
          eq(generations.status, 'processing'),
          sql`${generations.startedAt} < ${timeoutDate}`,
        ),
      );
  }

  /**
   * Get generations by project ID
   */
  async getByProjectId(projectId: string): Promise<Generation[]> {
    return db
      .select()
      .from(generations)
      .where(eq(generations.projectId, projectId))
      .orderBy(desc(generations.createdAt));
  }

  /**
   * Get generation statistics for user
   */
  async getStatsByUserId(userId: string): Promise<GenerationStats> {
    const allGenerations = await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId));

    const stats: GenerationStats = {
      total: allGenerations.length,
      byStatus: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
      byTask: {},
      byProvider: {},
      totalCost: 0,
    };

    for (const gen of allGenerations) {
      // Count by status
      stats.byStatus[gen.status]++;

      // Count by task
      if (!stats.byTask[gen.task]) {
        stats.byTask[gen.task] = 0;
      }
      stats.byTask[gen.task]++;

      // Count by provider
      if (!stats.byProvider[gen.provider]) {
        stats.byProvider[gen.provider] = 0;
      }
      stats.byProvider[gen.provider]++;

      // Sum cost
      if (gen.cost) {
        stats.totalCost += gen.cost;
      }
    }

    return stats;
  }

  /**
   * Count generations by user ID
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(eq(generations.userId, userId));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Count completed generations by user ID in current billing cycle
   */
  async countCompletedByUserIdInCycle(
    userId: string,
    cycleStartDate: Date,
  ): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(
        and(
          eq(generations.userId, userId),
          eq(generations.status, 'completed'),
          sql`${generations.createdAt} >= ${cycleStartDate}`,
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get recent generations
   */
  async getRecent(userId: string, limit: number = 10): Promise<Generation[]> {
    return db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  }
}

// Export singleton instance
export const generationRepository = new GenerationRepository();
