/**
 * Project Entity Handler
 * Manages CRUD operations for Project entities
 */

import type { Table } from 'dexie';
import type { EntityId, NodeId } from '@hierarchidb/common-type';
import { BaseEntityHandler } from '@hierarchidb/node-type-base-plugin';
import type { ProjectEntity } from '~/types/project-types';
import { projectDB } from '~/database/project-database';

/**
 * Working copy for Project entities
 */
export interface ProjectWorkingCopy extends ProjectEntity {
  isWorkingCopy: boolean;
  originalId: EntityId;
  isDirty: boolean;
  copiedAt: number;
}

/**
 * Create project data interface
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  category?: 'research' | 'development' | 'production' | 'other';
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  coverage?: any;
  mapConfig?: any;
  visibility?: 'private' | 'public' | 'shared';
}

/**
 * Project filter criteria
 */
export interface ProjectFilterCriteria {
  category?: string;
  tags?: string[];
  visibility?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Project entity handler extending BaseEntityHandler
 */
export class ProjectEntityHandler extends BaseEntityHandler<
  ProjectEntity,
  ProjectWorkingCopy,
  CreateProjectData,
  ProjectFilterCriteria
> {
  protected table: Table<ProjectEntity, EntityId>;

  constructor() {
    super();
    this.table = projectDB.projects;
  }

  /**
   * Build project entity from creation data
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: CreateProjectData
  ): ProjectEntity {
    const now = Date.now();
    
    return {
      id: entityId,
      nodeId: nodeId,
      type: 'project',
      
      // 基本情報
      name: data.name,
      description: data.description || '',
      category: data.category || 'research',
      tags: data.tags || [],
      
      // 期間
      startDate: data.startDate || new Date(),
      endDate: data.endDate,
      milestones: [],
      
      // 地理的範囲
      coverage: data.coverage || {
        type: 'bbox',
        bbox: {
          minLon: 139.0,
          minLat: 35.0,
          maxLon: 140.0,
          maxLat: 36.0
        }
      },
      mapConfig: data.mapConfig || {
        defaultView: {
          center: [139.6917, 35.6895],
          zoom: 10
        },
        baseMap: 'streets'
      },
      
      // データレイヤー
      layers: [],
      layerGroups: [],
      
      // 解析設定
      spatialAnalyses: [],
      temporalAnalyses: [],
      
      // 出力設定
      outputConfig: {
        report: {
          enabled: false,
          format: 'pdf',
          sections: []
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
              tileSize: 512
            }
          }
        },
        export: {
          formats: [],
          packaging: 'zip'
        },
        sharing: {
          permissions: {
            download: true,
            print: true,
            edit: false
          }
        }
      },
      
      // 共有設定
      visibility: data.visibility || 'private',
      permissions: [],
      collaborators: [],
      
      // メタデータ
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      version: 1
    };
  }

  /**
   * Get entity by node ID
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    return await this.table.where('nodeId').equals(nodeId).first();
  }

  /**
   * Override delete to handle related data cleanup
   */
  async deleteEntity(entityId: EntityId): Promise<void> {
    const entity = await this.table.get(entityId);
    if (entity) {
      // Delete all related data
      await projectDB.clearProjectData(entityId);
      // Call parent delete
      await super.deleteEntity(entityId);
    }
  }

  /**
   * Create working copy from entity
   */
  async createWorkingCopy(entity: ProjectEntity): Promise<ProjectWorkingCopy> {
    return {
      ...entity,
      isWorkingCopy: true,
      originalId: entity.id,
      isDirty: false,
      copiedAt: Date.now()
    };
  }

  /**
   * Commit working copy back to entity
   */
  async commitWorkingCopy(workingCopy: ProjectWorkingCopy): Promise<NodeId> {
    const { isWorkingCopy, originalId, isDirty, copiedAt, ...entityData } = workingCopy;
    
    if (originalId) {
      // Update existing entity
      await this.updateEntity(originalId, entityData);
      return entityData.nodeId;
    } else {
      // Create new entity
      const entity = await this.createEntity(entityData.nodeId, entityData);
      return entity.nodeId;
    }
  }

  /**
   * Duplicate a project entity
   */
  async duplicate(sourceNodeId: NodeId, newNodeId: NodeId): Promise<ProjectEntity> {
    const source = await this.getEntityByNodeId(sourceNodeId);
    if (!source) {
      throw new Error(`Source project not found: ${sourceNodeId}`);
    }

    const newEntity = await this.createEntity(newNodeId, {
      name: `${source.name} (Copy)`,
      description: source.description,
      category: source.category,
      tags: [...source.tags],
      startDate: source.startDate,
      endDate: source.endDate,
      coverage: source.coverage,
      mapConfig: source.mapConfig,
      visibility: source.visibility
    });

    // Clone snapshots if needed
    const snapshots = await projectDB.snapshots
      .where('projectEntityId')
      .equals(source.id)
      .toArray();

    for (const snapshot of snapshots) {
      await projectDB.snapshots.add({
        ...snapshot,
        id: crypto.randomUUID() as EntityId,
        projectEntityId: newEntity.id
      });
    }

    return newEntity;
  }

  /**
   * Search projects by filter criteria
   */
  async searchEntities(criteria: ProjectFilterCriteria): Promise<ProjectEntity[]> {
    let collection = this.table.toCollection();

    if (criteria.category) {
      collection = collection.filter(p => p.category === criteria.category);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      collection = collection.filter(p => 
        criteria.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (criteria.visibility) {
      collection = collection.filter(p => p.visibility === criteria.visibility);
    }

    if (criteria.startDate) {
      collection = collection.filter(p => 
        new Date(p.startDate) >= criteria.startDate!
      );
    }

    if (criteria.endDate) {
      collection = collection.filter(p => 
        p.endDate ? new Date(p.endDate) <= criteria.endDate! : false
      );
    }

    return await collection.toArray();
  }

  /**
   * Validate project entity data
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
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get project statistics
   */
  async getStatistics(entityId: EntityId) {
    const projectStats = await projectDB.getProjectStatistics(entityId);
    const entity = await this.table.get(entityId);
    
    if (!entity) {
      throw new Error(`Project not found: ${entityId}`);
    }
    
    return {
      ...projectStats,
      layerCount: entity.layers.length,
      analysisCount: entity.spatialAnalyses.length + entity.temporalAnalyses.length,
      collaboratorCount: entity.collaborators?.length || 0
    };
  }

  /**
   * Export project to various formats
   */
  async exportProject(entityId: EntityId, format: 'json' | 'pmtiles' | 'pdf'): Promise<Blob> {
    const entity = await this.table.get(entityId);
    if (!entity) {
      throw new Error(`Project not found: ${entityId}`);
    }

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(entity, null, 2)], { type: 'application/json' });
      
      case 'pmtiles':
        // TODO: Implement PMTiles export
        throw new Error('PMTiles export not yet implemented');
      
      case 'pdf':
        // TODO: Implement PDF export
        throw new Error('PDF export not yet implemented');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import project from file
   */
  async importProject(nodeId: NodeId, file: File): Promise<ProjectEntity> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate imported data
    const validation = await this.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid project data: ${validation.errors?.join(', ')}`);
    }

    // Create new project from imported data
    return await this.createEntity(nodeId, data);
  }
}