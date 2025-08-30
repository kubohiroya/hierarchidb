import type { EntityId, NodeId, TreeNode, EntityHandler, WorkingCopyProperties } from '@hierarchidb/common-type';
import type { ProjectEntity } from '~/types/project-types';
import { projectDB } from '~/database/project-database';

type ProjectWorkingCopy = ProjectEntity & { isWorkingCopy: boolean; originalId: EntityId; isDirty: boolean; copiedAt: number };

export class ProjectEntityHandler implements EntityHandler<ProjectEntity, ProjectEntity, ProjectWorkingCopy> {
  async createEntity(
    nodeId: NodeId,
    initialData?: Partial<ProjectEntity>
  ): Promise<ProjectEntity> {
    const entityId = crypto.randomUUID() as EntityId;
    const now = Date.now();
    
    const entity: ProjectEntity = {
      id: entityId,
      nodeId: nodeId,
      type: 'project',
      
      // 基本情報
      name: initialData?.name || 'New Project',
      description: initialData?.description || '',
      category: initialData?.category || 'research',
      tags: initialData?.tags || [],
      
      // 期間
      startDate: initialData?.startDate || new Date(),
      endDate: initialData?.endDate,
      milestones: initialData?.milestones || [],
      
      // 地理的範囲
      coverage: initialData?.coverage || {
        type: 'bbox',
        bbox: {
          minLon: 139.0,
          minLat: 35.0,
          maxLon: 140.0,
          maxLat: 36.0
        }
      },
      mapConfig: initialData?.mapConfig || {
        defaultView: {
          center: [139.6917, 35.6895],
          zoom: 10
        },
        baseMap: 'streets'
      },
      
      // データレイヤー
      layers: initialData?.layers || [],
      layerGroups: initialData?.layerGroups || [],
      
      // 解析設定
      spatialAnalyses: initialData?.spatialAnalyses || [],
      temporalAnalyses: initialData?.temporalAnalyses || [],
      
      // 出力設定
      outputConfig: initialData?.outputConfig || {
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
      visibility: initialData?.visibility || 'private',
      permissions: initialData?.permissions || [],
      collaborators: initialData?.collaborators || [],
      
      // メタデータ
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      version: 1
    };

    await projectDB.projects.add(entity);
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    return await projectDB.projects.where('nodeId').equals(nodeId).first();
  }

  async updateEntity(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Project entity not found for node: ${nodeId}`);
    }

    const updatedEntity: ProjectEntity = {
      ...existing,
      ...updates,
      id: existing.id,
      nodeId: existing.nodeId,
      updatedAt: Date.now(),
      updatedBy: 'system',
      version: existing.version + 1
    };

    await projectDB.projects.put(updatedEntity);
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity) {
      // Delete all related data
      await projectDB.clearProjectData(entity.id);
      // Delete the project itself
      await projectDB.projects.delete(entity.id);
    }
  }

  async createWorkingCopy(nodeId: NodeId): Promise<ProjectWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Project entity not found for node: ${nodeId}`);
    }
    
    // Create a working copy
    return {
      ...entity,
      isWorkingCopy: true,
      originalId: entity.id,
      isDirty: false,
      copiedAt: Date.now()
    } as ProjectWorkingCopy;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: ProjectWorkingCopy): Promise<void> {
    // Remove the working copy flag and update
    const { isWorkingCopy, ...entity } = workingCopy;
    await this.updateEntity(nodeId, entity);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // No-op for now - working copy is not persisted separately
  }

  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<void> {
    const source = await this.getEntity(nodeId);
    if (!source) {
      throw new Error(`Source project not found: ${nodeId}`);
    }

    await this.createEntity(newNodeId, {
      ...source,
      name: `${source.name} (Copy)`,
      id: undefined as any,
      nodeId: undefined as any,
      createdAt: undefined as any,
      createdBy: undefined as any,
      updatedAt: undefined as any,
      updatedBy: undefined as any,
      version: undefined as any
    });

    // Clone snapshots if needed
    const snapshots = await projectDB.snapshots
      .where('projectEntityId')
      .equals(source.id)
      .toArray();

    const newEntity = await this.getEntity(newNodeId);
    if (newEntity) {
      for (const snapshot of snapshots) {
        await projectDB.snapshots.add({
          ...snapshot,
          id: crypto.randomUUID() as EntityId,
          projectEntityId: newEntity.id
        });
      }
    }
  }

  async cleanup(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity) {
      // Clean up all project data
      await projectDB.clearProjectData(entity.id);
    }
  }

  // Additional helper methods
  async list(filter?: {
    category?: string;
    tags?: string[];
    visibility?: string;
  }): Promise<ProjectEntity[]> {
    let collection = projectDB.projects.toCollection();

    if (filter?.category) {
      collection = collection.filter(p => p.category === filter.category);
    }

    if (filter?.tags && filter.tags.length > 0) {
      collection = collection.filter(p => 
        filter.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (filter?.visibility) {
      collection = collection.filter(p => p.visibility === filter.visibility);
    }

    return await collection.toArray();
  }

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

  async getStatistics(entityId: EntityId) {
    const projectStats = await projectDB.getProjectStatistics(entityId);
    const entity = await projectDB.projects.get(entityId);
    
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
}