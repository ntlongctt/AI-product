import type { AITask, AIProvider } from '@/types';

/**
 * Job status types for tracking async generation jobs
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Input parameters for a generation job
 */
export interface JobInput {
  task: AITask;
  inputUrl?: string;
  inputUrls?: string[];
  prompt?: string;
  options?: Record<string, unknown>;
}

/**
 * Job result data (populated when job completes)
 */
export interface JobResult {
  outputUrl?: string;
  outputUrls?: string[];
  localPath?: string;        // Absolute path to saved file
  localPaths?: string[];     // For multiple images
  publicUrl?: string;        // URL to serve the image
  publicUrls?: string[];     // For multiple images
  duration?: number;
  cost?: number;
}

/**
 * Job entity representing an async generation task
 */
export interface Job {
  id: string;
  status: JobStatus;
  task: AITask;
  provider?: AIProvider;
  input: JobInput;
  result?: JobResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Interface for job store implementations
 * (In-memory for now, will be replaced with DB later)
 */
export interface JobStore {
  create(job: Omit<Job, 'createdAt' | 'updatedAt'>): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | undefined>;
  delete(id: string): Promise<boolean>;
  list(limit?: number, offset?: number): Promise<Job[]>;
}

/**
 * In-memory implementation of JobStore
 * Used for temporary storage until database is implemented
 */
export class InMemoryJobStore implements JobStore {
  private jobs = new Map<string, Job>();

  /**
   * Create a new job
   */
  async create(job: Omit<Job, 'createdAt' | 'updatedAt'>): Promise<Job> {
    const now = new Date();
    const newJob: Job = {
      ...job,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, newJob);
    return newJob;
  }

  /**
   * Get a job by ID
   */
  async get(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  /**
   * Update a job's fields
   */
  async update(
    id: string,
    updates: Partial<Omit<Job, 'id' | 'createdAt'>>
  ): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) {
      return undefined;
    }

    const updatedJob: Job = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    };

    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  /**
   * Delete a job
   */
  async delete(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  /**
   * List all jobs (optionally paginated)
   */
  async list(limit?: number, offset?: number): Promise<Job[]> {
    const allJobs = Array.from(this.jobs.values());
    // Sort by createdAt descending (newest first)
    allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = offset ?? 0;
    const end = limit !== undefined ? start + limit : undefined;

    return allJobs.slice(start, end);
  }

  /**
   * Get the count of jobs by status
   */
  getCountByStatus(status: JobStatus): number {
    return Array.from(this.jobs.values()).filter((job) => job.status === status).length;
  }

  /**
   * Clear all jobs (useful for testing)
   */
  clear(): void {
    this.jobs.clear();
  }
}

// Singleton instance for application use
let globalJobStore: InMemoryJobStore | null = null;

/**
 * Get the global job store instance
 */
export function getJobStore(): InMemoryJobStore {
  if (!globalJobStore) {
    globalJobStore = new InMemoryJobStore();
  }
  return globalJobStore;
}

/**
 * Set a custom job store (useful for testing)
 */
export function setJobStore(store: InMemoryJobStore): void {
  globalJobStore = store;
}

/**
 * Reset the global job store (useful for testing)
 */
export function resetJobStore(): void {
  globalJobStore = null;
}
