// Plugin-specific implementation without direct worker dependency  
import { 
  type NodeId, 
  type EntityHandler,
  type EntityHandlerContext,
  type WorkingCopyProperties,
  generateEntityId 
} from '@hierarchidb/00-core';
import { 
  type ProjectEntity,
  type CreateProjectData,
  type UpdateProjectData,
  DEFAULT_MAP_CONFIG,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_AGGREGATION_METADATA,
  type MapConfiguration,
  type RenderConfiguration,
  type ProjectStatistics,
  type LayerConfiguration
} from '../types/ProjectEntity';
import type { ProjectAPI, AggregationResult, AggregationStatus } from '../types/ProjectAPI';

/**
 * Entity handler for Project entities
 * Implements the standard BaseEntityHandler pattern for simple PeerEntity management
 */
export class ProjectEntityHandler implements EntityHandler<ProjectEntity, never, ProjectEntity & WorkingCopyProperties>, ProjectAPI {
  // Context is injected at runtime by the worker
  private context?: EntityHandlerContext<ProjectEntity, never, ProjectEntity & WorkingCopyProperties>;
  /**
   * Set the context for database operations
   * Called by the worker during plugin registration
   */
  setContext(context: EntityHandlerContext<ProjectEntity, never, ProjectEntity & WorkingCopyProperties>): void {
    this.context = context;
  }

  /**
   * Create a new ProjectEntity
   */
  async createEntity(nodeId: NodeId, data?: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const createData = data as unknown as CreateProjectData;
    
    if (!createData?.name) {
      throw new Error('Project name is required');
    }

    const now = Date.now();
    const entity: ProjectEntity = {
      id: generateEntityId(),
      nodeId,
      name: createData.name,
      description: createData.description || '',
      mapConfig: { 
        ...DEFAULT_MAP_CONFIG, 
        ...(createData.mapConfig || {})
      } as MapConfiguration,
      renderConfig: { 
        ...DEFAULT_RENDER_CONFIG, 
        ...(createData.renderConfig || {})
      } as RenderConfiguration,
      layerConfigurations: {},
      exportConfigurations: [],
      aggregationMetadata: { ...DEFAULT_AGGREGATION_METADATA },
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Use context if available (injected at runtime)
    if (this.context) {
      return await this.context.store.create(entity);
    }
    
    // Fallback for testing
    return entity;
  }

  /**
   * Get a ProjectEntity by nodeId
   */
  async getEntity(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    if (this.context) {
      return await this.context.store.get(nodeId);
    }
    return undefined;
  }

  /**
   * Update a ProjectEntity
   */
  async updateEntity(nodeId: NodeId, data: Partial<ProjectEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Project not found: ${nodeId}`);
    }

    const updateData = data as unknown as UpdateProjectData;
    const updated: ProjectEntity = {
      ...existing,
      ...updateData,
      // Ensure proper type handling for partial configs
      mapConfig: updateData.mapConfig ? {
        ...existing.mapConfig,
        ...updateData.mapConfig
      } : existing.mapConfig,
      renderConfig: updateData.renderConfig ? {
        ...existing.renderConfig,
        ...updateData.renderConfig
      } : existing.renderConfig,
      nodeId, // Ensure nodeId is not overwritten
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    if (this.context) {
      await this.context.store.update(nodeId, updated);
    }
  }

  /**
   * Delete a ProjectEntity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    if (this.context) {
      await this.context.store.delete(nodeId);
    }
  }

  // ==================
  // Working Copy Operations (required by EntityHandler interface)
  // ==================

  async createWorkingCopy(nodeId: NodeId): Promise<ProjectEntity & WorkingCopyProperties> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Project entity not found for node: ${nodeId}`);
    }

    if (this.context) {
      return await this.context.workingCopy.create(entity);
    }

    // Fallback for testing
    return {
      ...entity,
      originalNodeId: nodeId,
      copiedAt: Date.now(),
    };
  }

  async commitWorkingCopy(_nodeId: NodeId, workingCopy: ProjectEntity & WorkingCopyProperties): Promise<void> {
    if (this.context) {
      await this.context.workingCopy.commit(workingCopy);
    }
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    if (this.context) {
      await this.context.workingCopy.discard(nodeId);
    }
  }



  // Project-specific methods

  /**
   * Add a resource reference (updates TreeNode.references)
   */
  addResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
    // Note: This would need to update TreeNode.references through TreeAPI
    // For now, just a placeholder implementation
    console.log(`Adding resource reference: ${resourceNodeId} to project: ${projectNodeId}`);
    return Promise.resolve();
  }

  /**
   * Remove a resource reference
   */
  async removeResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
    // Remove layer configuration for this resource
    const project = await this.getEntity(projectNodeId);
    if (project.layerConfigurations[resourceNodeId]) {
      delete project.layerConfigurations[resourceNodeId];
      await this.updateEntity(projectNodeId, project);
    }
    
    // Note: This would need to update TreeNode.references through TreeAPI
    console.log(`Removing resource reference: ${resourceNodeId} from project: ${projectNodeId}`);
  }

  /**
   * Configure layer for a resource reference
   */
  async configureLayer(
    projectNodeId: NodeId, 
    resourceNodeId: NodeId, 
    layerConfig: LayerConfiguration
  ): Promise<void> {
    const project = await this.getEntity(projectNodeId);
    if (!project) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    project.layerConfigurations[resourceNodeId] = layerConfig;
    await this.updateEntity(projectNodeId, project);
  }

  /**
   * Update aggregation metadata
   */
  async updateAggregationMetadata(
    projectNodeId: NodeId, 
    metadata: Partial<ProjectEntity['aggregationMetadata']>
  ): Promise<void> {
    const project = await this.getEntity(projectNodeId);
    if (!project) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    project.aggregationMetadata = {
      ...project.aggregationMetadata,
      ...metadata,
    };

    await this.updateEntity(projectNodeId, project);
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(projectNodeId: NodeId): Promise<ProjectStatistics> {
    const project = await this.getEntity(projectNodeId);
    if (!project) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    return {
      totalReferences: Object.keys(project.layerConfigurations).length,
      validReferences: Object.keys(project.layerConfigurations).length,
      totalLayers: Object.keys(project.layerConfigurations).length,
      visibleLayers: Object.values(project.layerConfigurations).filter(
        (layer: LayerConfiguration) => layer.isVisible
      ).length,
      lastAggregated: project.aggregationMetadata.lastAggregated,
      exportCount: project.exportConfigurations.length,
    };
  }

  // ==================
  // ProjectAPI Implementation
  // ==================

  /**
   * Create project (ProjectAPI implementation)
   */
  createProject(nodeId: NodeId, data: ProjectEntity): Promise<ProjectEntity> {
    return this.createEntity(nodeId, data);
  }

  /**
   * Get project (ProjectAPI implementation)
   */
  getProject(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    return this.getEntity(nodeId);
  }

  /**
   * Update project (ProjectAPI implementation)
   */
  updateProject(nodeId: NodeId, data: Partial<ProjectEntity>): Promise<void> {
    return this.updateEntity(nodeId, data);
  }

  /**
   * Delete project (ProjectAPI implementation)
   */
  deleteProject(nodeId: NodeId): Promise<void> {
    return this.deleteEntity(nodeId);
  }

  /**
   * Get resource references (ProjectAPI implementation)
   */
  async getResourceReferences(projectNodeId: NodeId): Promise<NodeId[]> {
    // TODO: Get from TreeNode.references through TreeAPI
    // For now, return from layer configurations
    const project = await this.getProject(projectNodeId);
    if (!project) return [];
    
    return Object.keys(project.layerConfigurations) as NodeId[];
  }

  /**
   * Get layer configuration (ProjectAPI implementation)
   */
  async getLayerConfiguration(
    projectNodeId: NodeId, 
    resourceNodeId: NodeId
  ): Promise<LayerConfiguration | undefined> {
    const project = await this.getProject(projectNodeId);
    return project?.layerConfigurations[resourceNodeId];
  }

  /**
   * Remove layer configuration (ProjectAPI implementation)
   */
  async removeLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
    const project = await this.getProject(projectNodeId);
    if (project?.layerConfigurations[resourceNodeId]) {
      delete project.layerConfigurations[resourceNodeId];
      await this.updateProject(projectNodeId, project);
    }
  }

  /**
   * Aggregate project (ProjectAPI implementation)
   */
  async aggregateProject(projectNodeId: NodeId): Promise<AggregationResult> {
    const project = await this.getProject(projectNodeId);
    if (!project) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    const references = await this.getResourceReferences(projectNodeId);
    const layers = Object.values(project.layerConfigurations);

    // Simple aggregation result
    const result = {
      projectNodeId,
      layers: layers.map((layer: LayerConfiguration) => ({
        id: layer.layerId,
        type: layer.layerType,
        source: layer.styleConfig.source,
        paint: layer.styleConfig.paint,
        layout: layer.styleConfig.layout,
        filter: layer.styleConfig.filter,
      })),
      metadata: {
        aggregationId: `agg_${Date.now()}`,
        totalResources: references.length,
        totalLayers: layers.length,
        aggregationTime: Date.now(),
      },
      statistics: {
        resourcesLoaded: references.length,
        layersComposed: layers.length,
        totalDataSize: 0, // Placeholder
      },
    };

    // Update aggregation metadata
    await this.updateAggregationMetadata(projectNodeId, {
      lastAggregated: Date.now(),
      resourceCount: references.length,
      layerCount: layers.length,
      hasErrors: false,
    });

    return result;
  }

  /**
   * Get aggregation status (ProjectAPI implementation)
   */
  async getAggregationStatus(projectNodeId: NodeId): Promise<AggregationStatus> {
    const project = await this.getProject(projectNodeId);
    if (!project) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    return {
      status: project.aggregationMetadata.hasErrors ? 'error' : 'completed',
      lastAggregated: project.aggregationMetadata.lastAggregated,
      resourceCount: project.aggregationMetadata.resourceCount,
      layerCount: project.aggregationMetadata.layerCount,
      hasErrors: project.aggregationMetadata.hasErrors,
      errorMessages: project.aggregationMetadata.errorMessages || [],
    };
  }
}