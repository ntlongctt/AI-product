/**
 * Project Service
 *
 * High-level business logic for project management
 * Handles CRUD operations, duplication, archiving, and layer management
 */

import { projectRepository, type ProjectFilters } from '@/lib/db/repositories/project.repository';
import { templateRepository } from '@/lib/db/repositories/template.repository';
import { getStorageService } from '@/lib/storage';
import { canCreateProject } from '@/lib/auth';
import type { Project, NewProject, Layer, ProjectSettings } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface CreateProjectInput {
  userId: string;
  name: string;
  sku?: string;
  templateId?: string;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectInput {
  name?: string;
  sku?: string;
  layers?: Layer[];
  settings?: Partial<ProjectSettings>;
  thumbnailUrl?: string;
}

export interface AddLayerInput {
  type: Layer['type'];
  name: string;
  url?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

export interface UpdateLayerInput extends Partial<Omit<Layer, 'id'>> {
  id: string;
}

export interface ProjectListResult {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =============================================================================
// Project Service Class
// =============================================================================

export class ProjectService {
  /**
   * Create a new project
   * Optionally based on a template
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const { userId, name, sku, templateId, settings } = input;

    // Check if user can create more projects
    const currentCount = await projectRepository.countByUserId(userId);
    const canCreate = await canCreateProject(currentCount);

    if (!canCreate) {
      throw new Error('Project limit reached. Upgrade to Pro for unlimited projects.');
    }

    // Get template if specified
    let templateLayers: Layer[] = [];
    let templateSettings: ProjectSettings | undefined;

    if (templateId) {
      const template = await templateRepository.findById(templateId);
      if (template) {
        templateLayers = template.layers as Layer[] ?? [];
        templateSettings = template.layers ? undefined : undefined;
        // Increment template usage
        await templateRepository.incrementUsage(templateId);
      }
    }

    // Create project
    const project = await projectRepository.create({
      userId,
      name,
      sku,
      layers: templateLayers,
      settings: {
        width: settings?.width ?? 1200,
        height: settings?.height ?? 1200,
        backgroundColor: settings?.backgroundColor,
      },
      status: 'active',
    });

    return project;
  }

  /**
   * Get project by ID
   * Ensures user owns the project
   */
  async getById(projectId: string, userId: string): Promise<Project | null> {
    return projectRepository.findByIdAndUserId(projectId, userId);
  }

  /**
   * List projects for a user
   */
  async list(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: ProjectFilters,
  ): Promise<ProjectListResult> {
    const result = await projectRepository.listByUserId(userId, page, pageSize, filters);

    return {
      projects: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  /**
   * Update project
   */
  async update(projectId: string, userId: string, input: UpdateProjectInput): Promise<Project> {
    // Verify ownership
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    return projectRepository.update(projectId, input as Partial<NewProject>);
  }

  /**
   * Delete project (soft delete)
   */
  async delete(projectId: string, userId: string): Promise<void> {
    // Verify ownership
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    await projectRepository.delete(projectId);
  }

  /**
   * Duplicate project
   */
  async duplicate(projectId: string, userId: string, newName?: string): Promise<Project> {
    // Verify ownership
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Check project limit
    const currentCount = await projectRepository.countByUserId(userId);
    const canCreate = await canCreateProject(currentCount);

    if (!canCreate) {
      throw new Error('Project limit reached. Upgrade to Pro for unlimited projects.');
    }

    return projectRepository.duplicate(projectId, newName);
  }

  /**
   * Archive project
   */
  async archive(projectId: string, userId: string): Promise<Project> {
    // Verify ownership
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    return projectRepository.archive(projectId);
  }

  /**
   * Restore archived project
   */
  async restore(projectId: string, userId: string): Promise<Project> {
    // Verify ownership
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Project not found');
    }

    if (project.status !== 'archived') {
      throw new Error('Project is not archived');
    }

    return projectRepository.restore(projectId);
  }

  // ==========================================================================
  // Layer Management
  // ==========================================================================

  /**
   * Get all layers for a project
   */
  async getLayers(projectId: string, userId: string): Promise<Layer[]> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    return (project.layers as Layer[]) ?? [];
  }

  /**
   * Add a layer to project
   */
  async addLayer(projectId: string, userId: string, input: AddLayerInput): Promise<Layer> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const layers = (project.layers as Layer[]) ?? [];
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: input.type,
      name: input.name,
      url: input.url,
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? 100,
      height: input.height ?? 100,
      rotation: input.rotation ?? 0,
      scale: input.scale ?? 1,
      opacity: input.opacity ?? 1,
      zIndex: layers.length,
      visible: input.visible ?? true,
      locked: input.locked ?? false,
    };

    await projectRepository.update(projectId, {
      layers: [...layers, newLayer],
    });

    return newLayer;
  }

  /**
   * Update a layer
   */
  async updateLayer(
    projectId: string,
    userId: string,
    layerId: string,
    input: Partial<Omit<Layer, 'id'>>,
  ): Promise<Layer> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const layers = (project.layers as Layer[]) ?? [];
    const layerIndex = layers.findIndex((l) => l.id === layerId);

    if (layerIndex === -1) {
      throw new Error('Layer not found');
    }

    const updatedLayer: Layer = {
      ...layers[layerIndex],
      ...input,
      id: layerId, // Ensure ID doesn't change
    };

    layers[layerIndex] = updatedLayer;

    await projectRepository.update(projectId, { layers });

    return updatedLayer;
  }

  /**
   * Update multiple layers at once
   */
  async updateLayers(
    projectId: string,
    userId: string,
    updates: UpdateLayerInput[],
  ): Promise<Layer[]> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const layers = (project.layers as Layer[]) ?? [];

    for (const update of updates) {
      const layerIndex = layers.findIndex((l) => l.id === update.id);
      if (layerIndex !== -1) {
        layers[layerIndex] = {
          ...layers[layerIndex],
          ...update,
          id: update.id,
        };
      }
    }

    await projectRepository.update(projectId, { layers });

    return layers;
  }

  /**
   * Delete a layer
   */
  async deleteLayer(projectId: string, userId: string, layerId: string): Promise<Layer[]> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const layers = (project.layers as Layer[]) ?? [];
    const filteredLayers = layers.filter((l) => l.id !== layerId);

    if (filteredLayers.length === layers.length) {
      throw new Error('Layer not found');
    }

    // Re-index z-order
    const reindexedLayers = filteredLayers.map((layer, index) => ({
      ...layer,
      zIndex: index,
    }));

    await projectRepository.update(projectId, { layers: reindexedLayers });

    return reindexedLayers;
  }

  /**
   * Reorder layers
   */
  async reorderLayers(
    projectId: string,
    userId: string,
    layerIds: string[],
  ): Promise<Layer[]> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const layers = (project.layers as Layer[]) ?? [];

    // Create a map for quick lookup
    const layerMap = new Map(layers.map((l) => [l.id, l]));

    // Reorder based on provided IDs
    const reorderedLayers: Layer[] = [];
    for (let i = 0; i < layerIds.length; i++) {
      const layer = layerMap.get(layerIds[i]);
      if (layer) {
        reorderedLayers.push({
          ...layer,
          zIndex: i,
        });
      }
    }

    // Add any layers not in the reorder list (append at end)
    const reorderedIds = new Set(layerIds);
    let nextIndex = reorderedLayers.length;
    for (const layer of layers) {
      if (!reorderedIds.has(layer.id)) {
        reorderedLayers.push({
          ...layer,
          zIndex: nextIndex++,
        });
      }
    }

    await projectRepository.update(projectId, { layers: reorderedLayers });

    return reorderedLayers;
  }

  // ==========================================================================
  // Thumbnail Management
  // ==========================================================================

  /**
   * Update project thumbnail
   */
  async updateThumbnail(
    projectId: string,
    userId: string,
    imageUrl: string,
  ): Promise<Project> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Upload to storage
    const storage = getStorageService();
    const key = storage.generateKey('thumbnails', userId, `project-${projectId}`);

    const result = await storage.uploadFromUrl(imageUrl, key, {
      contentType: 'image/jpeg',
    });

    return projectRepository.update(projectId, {
      thumbnailUrl: result.url,
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get recent projects
   */
  async getRecent(userId: string, limit: number = 5): Promise<Project[]> {
    return projectRepository.getRecent(userId, limit);
  }

  /**
   * Count projects for user
   */
  async count(userId: string): Promise<number> {
    return projectRepository.countByUserId(userId);
  }

  /**
   * Update project settings
   */
  async updateSettings(
    projectId: string,
    userId: string,
    settings: Partial<ProjectSettings>,
  ): Promise<Project> {
    const project = await this.getById(projectId, userId);
    if (!project) {
      throw new Error('Project not found');
    }

    const currentSettings = (project.settings as ProjectSettings) ?? {
      width: 1200,
      height: 1200,
    };

    return projectRepository.update(projectId, {
      settings: { ...currentSettings, ...settings },
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let projectService: ProjectService | null = null;

export function getProjectService(): ProjectService {
  if (!projectService) {
    projectService = new ProjectService();
  }
  return projectService;
}

export function resetProjectService(): void {
  projectService = null;
}
