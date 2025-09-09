/**
 * Project Entity Handler
 * Manages CRUD operations for Project entities
 */

import type { NodeId } from '@hierarchidb/common-type';
import { BaseEntityHandler } from '@hierarchidb/base-plugin';
import type { ProjectCategory, ProjectEntity, ProjectWorkingCopy } from '~/types/project-types';
import { projectPluginAPI } from '~/api/ProjectPluginAPI';
import { createWorkingCopyFromEntity, mapWorkingCopyToUpdates } from '../shared/utils';
import { ProjectEntitySerializer } from '../shared/serialization';

/**
 * Create project data interface
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  category?: ProjectCategory;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  coverage?: any;
  mapConfig?: any;
  visibility?: string;
  layers?: any[];
  layerGroups?: any[];
  spatialAnalyses?: any[];
  temporalAnalyses?: any[];
  outputConfig?: any;
  permissions?: any[];
  collaborators?: any[];
  milestones?: any[];
}

/**
 * Project filter criteria
 */
export interface ProjectFilterCriteria {
  name?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Project Entity Handler extending BaseEntityHandler
 */
export class ProjectEntityHandler extends BaseEntityHandler<ProjectEntity, CreateProjectData, ProjectFilterCriteria> {
  protected table: any; // Mock table interface

  constructor() {
    super();
    // Initialize with plugin-specific database interface
    // This would typically connect to the Project plugin API via Comlink
    this.table = {
      add: async (_entity: any): Promise<any> => _entity,
      get: async (_id: any): Promise<any> => null,
      put: async (_entity: any): Promise<any> => _entity,
      delete: async (_id: any): Promise<void> => {
      },
      where: (_field: string) => ({
        equals: (_value: any) => ({
          first: async (): Promise<any> => null,
          toArray: async (): Promise<any[]> => [],
        }),
      }),
      orderBy: (_field: string) => ({
        reverse: () => ({
          offset: (_n: number) => ({
            limit: (_n: number) => ({
              toArray: async (): Promise<any[]> => [],
            }),
            toArray: async (): Promise<any[]> => [],
          }),
          limit: (_n: number) => ({
            toArray: async (): Promise<any[]> => [],
          }),
          toArray: async (): Promise<any[]> => [],
        }),
        offset: (_n: number) => ({
          limit: (_n: number) => ({
            toArray: async (): Promise<any[]> => [],
          }),
          toArray: async (): Promise<any[]> => [],
        }),
        limit: (_n: number) => ({
          toArray: async (): Promise<any[]> => [],
        }),
        toArray: async (): Promise<any[]> => [],
      }),
      toCollection: () => ({
        filter: (_predicate: any) => ({
          toArray: async (): Promise<any[]> => [],
        }),
      }),
    };
  }

  /**
   * Build project entity from creation data
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: NodeId,
    data: CreateProjectData,
  ): ProjectEntity {
    const now = Date.now();

    return {
      id: entityId,
      nodeId: nodeId,
      type: 'project',

      name: data.name,
      description: data.description || '',
      category: (data.category || 'research') as ProjectCategory,
      tags: data.tags || [],

      startDate: data.startDate || new Date(),
      endDate: data.endDate,
      milestones: data.milestones || [],

      coverage: data.coverage || {
        type: 'bbox',
        bbox: {
          minLon: 139.0,
          minLat: 35.0,
          maxLon: 140.0,
          maxLat: 36.0,
        },
      },
      mapConfig: data.mapConfig || {
        defaultView: {
          center: [139.6917, 35.6895],
          zoom: 10,
        },
        baseMap: 'streets',
      },

      layers: data.layers || [],
      layerGroups: data.layerGroups || [],

      spatialAnalyses: data.spatialAnalyses || [],
      temporalAnalyses: data.temporalAnalyses || [],

      outputConfig: data.outputConfig || {
        report: {
          enabled: false,
          format: 'pdf',
          sections: [],
        },
        tiles: {
          enabled: false,
          format: 'pmtiles',
          config: {
            minZoom: 0,
            maxZoom: 14,
            layers: [],
            optimization: {
              simplification: true,
              compression: 'gzip',
              tileSize: 512,
            },
          },
        },
        export: {
          formats: [],
          packaging: 'zip',
        },
        sharing: {
          permissions: {
            download: true,
            print: true,
            edit: false,
          },
        },
      },

      visibility: data.visibility || 'private',
      permissions: data.permissions || [],
      collaborators: data.collaborators || [],

      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      version: 1,
    };
  }

  /**
   * Override create to use API
   */
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    const entityId = crypto.randomUUID() as unknown as NodeId;
    const entity = this.buildEntity(nodeId, entityId, data);

    // Store in database via the project plugin API
    try {
      // Initialize plugin API if needed
      await this.ensurePluginInitialized();

      // Store entity in database
      await this.table.add(entity);

      console.log(`Created Project entity: ${entityId} for node: ${nodeId}`);
      return entity;
    } catch (error) {
      console.error('Failed to create Project entity:', error);
      throw error;
    }
  }

  /**
   * Get Project entity by node ID
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<ProjectEntity | null> {
    try {
      const entity = await this.table.where('nodeId').equals(nodeId).first();
      return entity || null;
    } catch (error) {
      console.error('Failed to get Project entity by node ID:', error);
      throw error;
    }
  }

  /**
   * Get Project entity by ID
   */
  async getEntity(entityId: NodeId): Promise<ProjectEntity | null> {
    try {
      const entity = await this.table.get(entityId);
      return entity || null;
    } catch (error) {
      console.error('Failed to get Project entity:', error);
      throw error;
    }
  }

  /**
   * Update an existing Project entity
   */
  async updateEntity(entityId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity> {
    try {
      const existing = await this.table.get(entityId);
      if (!existing) {
        throw new Error(`Project entity not found: ${entityId}`);
      }

      const updatedEntity: ProjectEntity = {
        ...existing,
        ...updates,
        id: entityId,
        nodeId: existing.nodeId,
        updatedAt: Date.now(),
        updatedBy: 'system',
        version: existing.version + 1,
      };

      await this.table.put(updatedEntity);

      console.log(`Updated Project entity: ${entityId}`);
      return updatedEntity;
    } catch (error) {
      console.error('Failed to update Project entity:', error);
      throw error;
    }
  }

  /**
   * Delete a Project entity
   */
  async deleteEntity(entityId: NodeId): Promise<void> {
    try {
      const entity = await this.table.get(entityId);
      if (!entity) {
        throw new Error(`Project entity not found: ${entityId}`);
      }

      // Cleanup related data
      await this.cleanupEntityData(entity);

      // Delete from database
      await this.table.delete(entityId);

      console.log(`Deleted Project entity: ${entityId}`);
    } catch (error) {
      console.error('Failed to delete Project entity:', error);
      throw error;
    }
  }

  /**
   * Create working copy from entity
   */
  async createWorkingCopy(entity: ProjectEntity): Promise<ProjectWorkingCopy> {
    return createWorkingCopyFromEntity(entity) as ProjectWorkingCopy;
  }

  /**
   * Apply working copy changes to entity
   */
  async applyWorkingCopy(entityId: NodeId, workingCopy: ProjectWorkingCopy): Promise<ProjectEntity> {
    const updates: Partial<ProjectEntity> = mapWorkingCopyToUpdates(
      workingCopy,
    ) as Partial<ProjectEntity>;
    return this.updateEntity(entityId, updates);
  }

  /**
   * List all Project entities
   */
  async listEntities(limit?: number, offset?: number): Promise<ProjectEntity[]> {
    try {
      let query = this.table.orderBy('updatedAt').reverse();

      if (offset) {
        query = query.offset(offset);
      }

      if (limit) {
        query = query.limit(limit);
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to list Project entities:', error);
      throw error;
    }
  }

  /**
   * Search Project entities by criteria
   */
  async searchEntities(criteria: ProjectFilterCriteria): Promise<ProjectEntity[]> {
    try {
      let query = this.table.toCollection();

      if (criteria.name) {
        query = query.filter((_entity: any) =>
          _entity.name.toLowerCase().includes(criteria.name!.toLowerCase()),
        );
      }

      if (criteria.category) {
        query = query.filter((_entity: any) => _entity.category === criteria.category);
      }

      if (criteria.visibility) {
        query = query.filter((_entity: any) => _entity.visibility === criteria.visibility);
      }

      if (criteria.tags && criteria.tags.length > 0) {
        query = query.filter((_entity: any) =>
          criteria.tags!.some(tag => _entity.tags.includes(tag)),
        );
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to search Project entities:', error);
      throw error;
    }
  }

  /**
   * Start analysis processing for an entity
   */
  async startAnalysisProcessing(entityId: NodeId, analysisId: string): Promise<string> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Project entity not found: ${entityId}`);
      }

      await this.ensurePluginInitialized();

      // Find the analysis configuration
      const spatialAnalysis = entity.spatialAnalyses.find(a => a.id === analysisId);
      const temporalAnalysis = entity.temporalAnalyses.find(a => a.id === analysisId);

      if (!spatialAnalysis && !temporalAnalysis) {
        throw new Error(`Analysis not found: ${analysisId}`);
      }

      // Start analysis process
      const analysisConfig = spatialAnalysis || temporalAnalysis;
      if (!analysisConfig) {
        throw new Error(`Analysis configuration not found: ${analysisId}`);
      }

      const sessionId = await projectPluginAPI.startAnalysis(
        entity.nodeId,
        analysisId,
        analysisConfig,
      );

      return sessionId;
    } catch (error) {
      console.error('Failed to start analysis processing:', error);
      throw error;
    }
  }

  /**
   * Get analysis status for an entity
   */
  async getAnalysisStatus(entityId: NodeId, sessionId: string): Promise<any> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        return null;
      }

      return await projectPluginAPI.getAnalysisStatus(sessionId);
    } catch (error) {
      console.error('Failed to get analysis status:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async ensurePluginInitialized(): Promise<void> {
    // The plugin API should be initialized by the plugin system
    // This is a safety check
    try {
      await projectPluginAPI.getHealthStatus();
    } catch (error) {
      console.warn('Project plugin API not ready, initializing...');
      await projectPluginAPI.initialize();
    }
  }

  protected async cleanupEntityData(entity: ProjectEntity): Promise<void> {
    try {
      await this.ensurePluginInitialized();

      // Clear cached data for this node
      try {
        await projectPluginAPI.clearCache(entity.nodeId);
      } catch (error) {
        console.warn('Failed to clear cache during cleanup:', error);
      }

      // Clear any ongoing analyses
      try {
        await projectPluginAPI.cancelAllAnalyses(entity.nodeId);
      } catch (error) {
        console.warn('Failed to cancel analyses during cleanup:', error);
      }

      console.log(`Cleaned up data for Project entity: ${entity.id}`);
    } catch (error) {
      console.error('Error during entity cleanup:', error);
      // Don't throw - cleanup is best effort
    }
  }

  // ==========================================
  // Validation methods
  // ==========================================

  /**
   * Validate Project entity
   */
  async validate(entity: Partial<ProjectEntity>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!entity.name || entity.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (entity.coverage) {
      if (entity.coverage.type === 'bbox' && entity.coverage.bbox) {
        const { minLon, maxLon, minLat, maxLat } = entity.coverage.bbox;
        if (minLon >= maxLon) {
          errors.push('Invalid bounding box: minLon must be less than maxLon');
        }
        if (minLat >= maxLat) {
          errors.push('Invalid bounding box: minLat must be less than maxLat');
        }
      }
    }

    if (entity.startDate && entity.endDate) {
      if (new Date(entity.startDate) > new Date(entity.endDate)) {
        errors.push('End date must be after start date');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ==========================================
  // Serialization methods
  // ==========================================

  /**
   * Serialize Project entity with Uint8Array handling
   */
  async serialize(entity: ProjectEntity): Promise<{
    jsonData: any;
    binaryData: Map<string, Uint8Array>;
    binaryFilenames: Map<string, string>;
  }> {
    const { jsonData, binaryData, binaryFilenames } = ProjectEntitySerializer.serialize(entity);
    return { jsonData, binaryData, binaryFilenames };
  }

  /**
   * Deserialize Project entity with binary data restoration
   */
  async deserialize(jsonData: any, _binaryData: Map<string, Uint8Array>): Promise<ProjectEntity> {
    const restored = ProjectEntitySerializer.deserialize({ jsonData, binaryData: _binaryData });
    return restored as ProjectEntity;
  }

  /**
   * Serialize array of Project entities
   */
  async serializeEntityArray(entities: ProjectEntity[]): Promise<{
    jsonArray: any[];
    binaryData: Map<string, Uint8Array>;
    binaryFilenames: Map<string, string>;
  }> {
    const { jsonArray, binaryData, binaryFilenames } = ProjectEntitySerializer.serializeEntityArray(entities);
    return { jsonArray, binaryData, binaryFilenames };
  }

  /**
   * Deserialize array of Project entities
   */
  async deserializeEntityArray(
    jsonArray: any[],
    _binaryData: Map<string, Uint8Array>,
  ): Promise<ProjectEntity[]> {
    const restored = ProjectEntitySerializer.deserializeEntityArray(jsonArray, _binaryData);
    return restored as ProjectEntity[];
  }
}
