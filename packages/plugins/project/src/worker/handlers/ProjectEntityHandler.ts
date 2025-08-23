/**
 * ProjectEntityHandler - Worker側のデータベース操作実装
 */

import { type NodeId, generateEntityId } from '@hierarchidb/00-core';

import { 
  type ProjectEntity,
  type CreateProjectData,
  type UpdateProjectData,
  type ProjectStatistics,
  type LayerConfiguration,
  DEFAULT_MAP_CONFIG,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_AGGREGATION_METADATA
} from '../../shared';
import type { 
  AggregationResult, 
  AggregationStatus,
  ComposedMapLayer 
} from '../../shared';

/**
 * Entity handler for Project entities - Worker専用実装
 */
export class ProjectEntityHandler {
  protected table: any; // TODO: Replace with proper Dexie table type when integrated
  
  constructor() {
    // Mock table for now - will be replaced with proper DB integration
    this.table = {
      add: async (entity: any): Promise<any> => entity,
      where: (_field: string) => ({
        equals: (_value: any) => ({
          first: async (): Promise<any> => undefined,
          modify: async (_updates: any): Promise<void> => {},
          delete: async (): Promise<void> => {}
        })
      })
    };
  }

  /**
   * Create a new ProjectEntity
   */
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    if (!data.name) {
      throw new Error('Project name is required');
    }

    const now = Date.now();
    const entity: ProjectEntity = {
      id: generateEntityId(),
      nodeId,
      name: data.name,
      description: data.description || '',
      mapConfig: { 
        ...DEFAULT_MAP_CONFIG, 
        ...data.mapConfig 
      },
      renderConfig: { 
        ...DEFAULT_RENDER_CONFIG, 
        ...data.renderConfig 
      },
      layerConfigurations: data.layerConfigurations || {},
      exportConfigurations: [],
      aggregationMetadata: DEFAULT_AGGREGATION_METADATA,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.table.add(entity);
    return entity;
  }

  /**
   * Get ProjectEntity by nodeId
   */
  async getEntity(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    return await this.table.where('nodeId').equals(nodeId).first();
  }

  /**
   * Update ProjectEntity
   */
  async updateEntity(nodeId: NodeId, data: UpdateProjectData): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Project not found: ${nodeId}`);
    }

    const updates: any = {
      ...data,
      updatedAt: Date.now(),
      version: entity.version + 1,
    };

    // Merge map config if provided
    if (data.mapConfig) {
      updates.mapConfig = { ...entity.mapConfig, ...data.mapConfig };
    }

    // Merge render config if provided
    if (data.renderConfig) {
      updates.renderConfig = { ...entity.renderConfig, ...data.renderConfig };
    }

    await this.table.where('nodeId').equals(nodeId).modify(updates);
  }

  /**
   * Delete ProjectEntity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    await this.table.where('nodeId').equals(nodeId).delete();
  }

  // Resource reference operations (using TreeNode.references)
  async addResourceReference(_projectNodeId: NodeId, _resourceNodeId: NodeId): Promise<void> {
    // This would be implemented by calling TreeNodeAPI to add reference
    // For now, placeholder implementation
    console.log('Adding resource reference:', _projectNodeId, _resourceNodeId);
  }

  async removeResourceReference(_projectNodeId: NodeId, _resourceNodeId: NodeId): Promise<void> {
    // This would be implemented by calling TreeNodeAPI to remove reference
    console.log('Removing resource reference:', _projectNodeId, _resourceNodeId);
  }

  async getResourceReferences(_projectNodeId: NodeId): Promise<NodeId[]> {
    // This would be implemented by calling TreeNodeAPI to get references
    // For now, return empty array
    return [];
  }

  // Layer configuration operations
  async configureLayer(projectNodeId: NodeId, resourceNodeId: NodeId, config: LayerConfiguration): Promise<void> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    entity.layerConfigurations[resourceNodeId] = config;
    entity.updatedAt = Date.now();
    entity.version += 1;

    await this.table.where('nodeId').equals(projectNodeId).modify({
      layerConfigurations: entity.layerConfigurations,
      updatedAt: entity.updatedAt,
      version: entity.version
    });
  }

  async getLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<LayerConfiguration | undefined> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) return undefined;

    return entity.layerConfigurations[resourceNodeId];
  }

  async removeLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    delete entity.layerConfigurations[resourceNodeId];
    entity.updatedAt = Date.now();
    entity.version += 1;

    await this.table.where('nodeId').equals(projectNodeId).modify({
      layerConfigurations: entity.layerConfigurations,
      updatedAt: entity.updatedAt,
      version: entity.version
    });
  }

  // Project aggregation
  async aggregateProject(projectNodeId: NodeId): Promise<AggregationResult> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    // Get resource references
    const resourceRefs = await this.getResourceReferences(projectNodeId);
    
    // Compose layers from configurations
    const layers: ComposedMapLayer[] = [];
    
    for (const resourceNodeId of resourceRefs) {
      const config = entity.layerConfigurations[resourceNodeId];
      if (config && config.isVisible) {
        layers.push({
          id: config.layerId,
          type: config.layerType,
          source: config.styleConfig.source,
          paint: config.styleConfig.paint,
          layout: config.styleConfig.layout,
          filter: config.styleConfig.filter
        });
      }
    }

    // Sort layers by order
    layers.sort((a, b) => {
      const configA = Object.values(entity.layerConfigurations).find(c => c.layerId === a.id);
      const configB = Object.values(entity.layerConfigurations).find(c => c.layerId === b.id);
      return (configA?.layerOrder || 0) - (configB?.layerOrder || 0);
    });

    const aggregationTime = Date.now();
    
    // Update aggregation metadata
    entity.aggregationMetadata = {
      lastAggregated: aggregationTime,
      resourceCount: resourceRefs.length,
      layerCount: layers.length,
      hasErrors: false,
      aggregationTime: aggregationTime - entity.aggregationMetadata.lastAggregated
    };

    await this.table.where('nodeId').equals(projectNodeId).modify({
      aggregationMetadata: entity.aggregationMetadata,
      updatedAt: Date.now(),
      version: entity.version + 1
    });

    return {
      projectNodeId,
      layers,
      metadata: {
        aggregationId: `${projectNodeId}_${aggregationTime}`,
        totalResources: resourceRefs.length,
        totalLayers: layers.length,
        aggregationTime: entity.aggregationMetadata.aggregationTime || 0
      },
      statistics: {
        resourcesLoaded: resourceRefs.length,
        layersComposed: layers.length,
        totalDataSize: layers.length * 1024 // Placeholder calculation
      }
    };
  }

  async getAggregationStatus(projectNodeId: NodeId): Promise<AggregationStatus> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    const resourceCount = await this.getResourceReferences(projectNodeId);
    
    return {
      status: entity.aggregationMetadata.hasErrors ? 'error' : 'completed',
      lastAggregated: entity.aggregationMetadata.lastAggregated,
      resourceCount: resourceCount.length,
      layerCount: entity.aggregationMetadata.layerCount,
      hasErrors: entity.aggregationMetadata.hasErrors,
      errorMessages: entity.aggregationMetadata.errorMessages || []
    };
  }

  async getProjectStatistics(projectNodeId: NodeId): Promise<ProjectStatistics> {
    const entity = await this.getEntity(projectNodeId);
    if (!entity) {
      throw new Error(`Project not found: ${projectNodeId}`);
    }

    const resourceRefs = await this.getResourceReferences(projectNodeId);
    const visibleLayers = Object.values(entity.layerConfigurations).filter(c => c.isVisible).length;

    return {
      totalReferences: resourceRefs.length,
      validReferences: resourceRefs.length, // Placeholder - would check validity
      totalLayers: Object.keys(entity.layerConfigurations).length,
      visibleLayers,
      lastAggregated: entity.aggregationMetadata.lastAggregated,
      exportCount: entity.exportConfigurations.length
    };
  }
}