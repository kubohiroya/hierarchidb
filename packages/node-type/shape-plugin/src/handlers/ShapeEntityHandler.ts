/**
 * Shape Entity Handler - UI Layer (self-contained)
 * In-memory implementation used by UI tests and plugin definition.
 * Avoids direct coupling to worker/services APIs to keep types consistent.
 */

import type { NodeId, EntityId, ShapeEntity, ShapeWorkingCopy, ProcessingConfig, NodeType } from '~/shared';

/**
 * Create shape data interface (UI layer)
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: string;
  processingConfig?: Partial<ProcessingConfig>;
  selectedCountries?: string[];
  adminLevels?: number[];
  licenseAgreement?: boolean;
}

/**
 * Shape filter criteria for searching
 */
export interface ShapeFilterCriteria {
  name?: string;
  dataSource?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  hasActiveBatch?: boolean;
}

export class ShapeEntityHandler {
  private entitiesById: Map<EntityId, ShapeEntity> = new Map();
  private entityIdByNodeId: Map<NodeId, EntityId> = new Map();

  private buildDefaultProcessingConfig(overrides?: Partial<ProcessingConfig>): ProcessingConfig {
    return {
      concurrentDownloads: 2,
      enableFeatureFiltering: true,
      featureFilterMethod: 'hybrid',
      featureAreaThreshold: 0.1,
      concurrentProcesses: 2,
      maxZoomLevel: 12,
      tileBufferSize: 256,
      simplificationTolerance: 0.01,
      ...overrides,
    };
  }

  async createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    const entityId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as EntityId;
    const now = Date.now();

    const entity: ShapeEntity = {
      id: entityId,
      nodeId,
      name: data.name,
      description: data.description,
      dataSourceName: data.dataSourceName as any,
      licenseAgreement: !!data.licenseAgreement,
      processingConfig: this.buildDefaultProcessingConfig(data.processingConfig),
      checkboxState: '',
      selectedCountries: data.selectedCountries ?? [],
      adminLevels: data.adminLevels ?? [],
      urlMetadata: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.entitiesById.set(entityId, entity);
    this.entityIdByNodeId.set(nodeId, entityId);
    return entity;
  }

  async updateEntity(entityId: EntityId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const existing = this.entitiesById.get(entityId);
    if (!existing) {
      throw new Error('Shape entity not found');
    }
    const updated: ShapeEntity = {
      ...existing,
      ...updates,
      id: existing.id,
      nodeId: existing.nodeId,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };
    this.entitiesById.set(entityId, updated);
    return updated;
  }

  async deleteEntity(entityId: EntityId): Promise<void> {
    const existing = this.entitiesById.get(entityId);
    if (!existing) {
      throw new Error('Shape entity not found');
    }
    this.entitiesById.delete(entityId);
    this.entityIdByNodeId.delete(existing.nodeId);
  }

  async getEntity(entityId: EntityId): Promise<ShapeEntity | null> {
    return this.entitiesById.get(entityId) ?? null;
  }

  async getEntityByNodeId(nodeId: NodeId): Promise<ShapeEntity | null> {
    const entityId = this.entityIdByNodeId.get(nodeId);
    return entityId ? this.entitiesById.get(entityId) ?? null : null;
  }

  async listEntities(limit?: number, offset?: number): Promise<ShapeEntity[]> {
    const all = Array.from(this.entitiesById.values());
    const start = offset ?? 0;
    const end = limit ? start + limit : undefined;
    return all.slice(start, end);
  }

  async searchEntities(criteria: ShapeFilterCriteria): Promise<ShapeEntity[]> {
    let results = Array.from(this.entitiesById.values());
    if (criteria.name) {
      const q = criteria.name.toLowerCase();
      results = results.filter(e => e.name?.toLowerCase().includes(q));
    }
    if (criteria.dataSource) {
      results = results.filter(e => e.dataSourceName === criteria.dataSource);
    }
    if (criteria.processingStatus) {
      results = results.filter(e => e.processingStatus === criteria.processingStatus);
    }
    if (criteria.hasActiveBatch !== undefined) {
      results = results.filter(e => (criteria.hasActiveBatch ? !!e.batchSessionId : !e.batchSessionId));
    }
    return results;
  }

  createWorkingCopy(entity: ShapeEntity): ShapeWorkingCopy {
    const workingCopy: ShapeWorkingCopy = {
      // TreeNode props
      id: entity.nodeId as NodeId,
      parentId: entity.nodeId as NodeId,
      nodeType: 'shape' as NodeType,
      nodeId: entity.nodeId,
      name: entity.name,
      depth: 0,
      // Working copy props
      originalNodeId: entity.nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true,
      entityWorkingCopyId: entity.id,
      originalVersion: entity.version,
      // Shape fields
      description: entity.description,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: false,
      processingConfig: entity.processingConfig,
      checkboxState: entity.checkboxState,
      selectedCountries: [...entity.selectedCountries],
      adminLevels: [...entity.adminLevels],
      urlMetadata: [...entity.urlMetadata],
      isDraft: false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };
    return workingCopy;
  }

  createNewDraftWorkingCopy(parentId: NodeId): ShapeWorkingCopy {
    const workingCopyId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as unknown as NodeId;
    const now = Date.now();
    const workingCopy: ShapeWorkingCopy = {
      // TreeNode props
      id: workingCopyId,
      parentId,
      nodeType: 'shape' as NodeType,
      nodeId: '' as NodeId,
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: this.buildDefaultProcessingConfig(),
      checkboxState: '',
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      depth: 0,
      // Working copy props
      copiedAt: now,
      isDraft: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    return workingCopy;
  }

  async applyWorkingCopy(entityId: EntityId, workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
    const updates: Partial<ShapeEntity> = {
      name: workingCopy.name,
      description: workingCopy.description,
      dataSourceName: workingCopy.dataSourceName,
      licenseAgreement: workingCopy.licenseAgreement,
      processingConfig: workingCopy.processingConfig,
      checkboxState: workingCopy.checkboxState,
      selectedCountries: workingCopy.selectedCountries,
      adminLevels: workingCopy.adminLevels,
      urlMetadata: workingCopy.urlMetadata,
    };
    return this.updateEntity(entityId, updates);
  }

  async updateProcessingStatus(
    entityId: EntityId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string
  ): Promise<void> {
    const existing = await this.getEntity(entityId);
    if (!existing) {
      throw new Error('Shape entity not found');
    }
    await this.updateEntity(entityId, {
      processingStatus: status,
      batchSessionId,
    });
  }

  async getProcessingStats(_entityId: EntityId): Promise<{
    featureCount: number;
    tileCount: number;
    storageUsed: number;
    lastProcessed?: number;
  }> {
    return { featureCount: 0, tileCount: 0, storageUsed: 0 };
  }

  async startBatchProcessing(
    entityId: EntityId,
    _config: Partial<ProcessingConfig>,
    _countries: string[],
    _adminLevels: number[]
  ): Promise<string> {
    const sessionId = `session-${Date.now()}`;
    await this.updateProcessingStatus(entityId, 'processing', sessionId);
    return sessionId;
  }

  async cancelBatchProcessing(sessionId: string): Promise<void> {
    // Find entity by sessionId and reset
    for (const [entityId, entity] of this.entitiesById.entries()) {
      if (entity.batchSessionId === sessionId) {
        await this.updateProcessingStatus(entityId, 'idle', undefined);
      }
    }
  }

  async getBatchProgress(_sessionId: string): Promise<any> {
    return { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 };
  }
}
