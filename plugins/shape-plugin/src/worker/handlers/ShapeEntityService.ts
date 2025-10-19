/**
 * Shape Entity Handler - Worker Layer
 * Manages CRUD operations for Shape entities in Worker environment
 */

import type { Collection, IndexableType, Table } from 'dexie';
import type { DataSourceName, NodeId, NodeType } from '../../common/shared/index.js';
import {
  buildShapeEntityFromCreate,
  createWorkingCopyFromEntity,
  DEFAULT_PROCESSING_CONFIG,
  mapWorkingCopyToUpdates,
  mergeProcessingConfig,
  type ProcessingConfig,
  type ShapeEntity,
  type ShapeWorkingCopy,
} from '../../common/shared/index.js';
import {
  BaseEntityService,
  createDraftWorkingCopyBase,
  markWorkingCopyUpdated,
} from '@hierarchidb/plugin-entity-service';
import type { Timestamp } from '@hierarchidb/common-types';

/**
 * Create shape data interface
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: DataSourceName;
  processingConfig?: Partial<ProcessingConfig>;
}

/**
 * Shape filter criteria for searching entities
 */
export interface ShapeFilterCriteria {
  name?: string;
  dataSource?: DataSourceName;
  processingStatus?: string;
  hasActiveBatch?: boolean;
}

/**
 * Entity service for Shape plugin in Worker layer
 * Extends BaseEntityService for common CRUD operations
 */
export class ShapeEntityService extends BaseEntityService<
  ShapeEntity,
  CreateShapeData,
  ShapeFilterCriteria
> {
  protected table: Table<ShapeEntity, NodeId>;
  private ephemeralDB: any; // EphemeralDB reference for working copies

  constructor(table: Table<ShapeEntity, NodeId>, ephemeralDB?: any) {
    super();
    this.table = table;
    this.ephemeralDB = ephemeralDB;
  }

  /**
   * Build shape entity from creation data
   */
  protected buildEntity(
    nodeId: NodeId,
    _entityId: NodeId,
    data: CreateShapeData,
  ): ShapeEntity {
    return buildShapeEntityFromCreate({
      nodeId,
      data: {
        name: data.name,
        description: data.description,
        dataSourceName: data.dataSourceName,
        processingConfig: data.processingConfig as Partial<ProcessingConfig>,
      },
    });
  }

  /**
   * Get Shape entity by node ID
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<ShapeEntity | null> {
    try {
      const entity = await this.table.where('nodeId').equals(nodeId).first();
      return entity || null;
    } catch (error) {
      console.error('Failed to get Shape entity by node ID:', error);
      throw error;
    }
  }

  protected applyAdditionalSearchCriteria(
    query: Collection<ShapeEntity, IndexableType, ShapeEntity>,
    criteria: ShapeFilterCriteria,
  ): Collection<ShapeEntity, IndexableType, ShapeEntity> {
    if (criteria.name) {
      const needle = criteria.name.toLowerCase();
      query = query.filter(entity => entity.name.toLowerCase().includes(needle));
    }

    if (criteria.dataSource) {
      query = query.filter(entity => entity.dataSourceName === criteria.dataSource);
    }

    if (criteria.processingStatus) {
      query = query.filter(entity => entity.processingStatus === criteria.processingStatus);
    }

    if (criteria.hasActiveBatch !== undefined) {
      query = query.filter(entity =>
        criteria.hasActiveBatch ? !!entity.batchSessionId : !entity.batchSessionId,
      );
    }

    return query;
  }

  /**
   * Create working copy from entity
   */
  async createWorkingCopy(entity: ShapeEntity): Promise<ShapeWorkingCopy> {
    const workingCopy = createWorkingCopyFromEntity(entity);

    if (this.ephemeralDB?.workingCopies) {
      await this.ephemeralDB.workingCopies.put(workingCopy, workingCopy.treeNodeId);
    }

    return workingCopy;
  }

  /**
   * Create new draft working copy
   */
  async createNewDraftWorkingCopy(parentId: NodeId): Promise<ShapeWorkingCopy> {
    const workingCopyId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as unknown as NodeId;
    const now = Date.now() as Timestamp;

    const draft = {
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG),
      checkboxState: [],
      processingStatus: 'idle' as ShapeEntity['processingStatus'],
      createdAt: now,
      updatedAt: now,
      version: 1,
    } satisfies Partial<ShapeEntity>;

    const base = createDraftWorkingCopyBase<ShapeEntity>({
      draft,
      meta: {
        treeNodeId: workingCopyId,
        createdAt: now,
        updatedAt: now,
        originalVersion: 1,
      },
    });

    const workingCopy: ShapeWorkingCopy = {
      ...base,
      ...draft,
      id: workingCopyId,
      parentId,
      nodeType: 'shape' as NodeType,
      nodeId: '' as NodeId,
      depth: 0,
      copiedAt: now,
      isDraft: true,
    };

    if (this.ephemeralDB?.workingCopies) {
      await this.ephemeralDB.workingCopies.put(workingCopy, workingCopy.treeNodeId);
    }

    return workingCopy;
  }

  /**
   * Get working copy from EphemeralDB
   */
  async getWorkingCopy(workingCopyId: NodeId): Promise<ShapeWorkingCopy | undefined> {
    try {
      if (!this.ephemeralDB?.workingCopies) {
        return undefined;
      }
      const workingCopy = await this.ephemeralDB.workingCopies.get(workingCopyId);
      return workingCopy as ShapeWorkingCopy | undefined;
    } catch (error) {
      console.error('Failed to get working copy:', error);
      return undefined;
    }
  }

  /**
   * Update working copy in EphemeralDB
   */
  async updateWorkingCopy(
    workingCopyId: NodeId,
    data: Partial<ShapeEntity>,
  ): Promise<ShapeWorkingCopy> {
    try {
      const existing = await this.getWorkingCopy(workingCopyId);
      if (!existing) {
        throw new Error(`Working copy not found: ${workingCopyId}`);
      }

      const timestamp = Date.now() as Timestamp;
      const base = markWorkingCopyUpdated(existing, data, timestamp);
      const updated: ShapeWorkingCopy = {
        ...existing,
        ...data,
        ...base,
        updatedAt: timestamp,
      };

      if (this.ephemeralDB?.workingCopies) {
        await this.ephemeralDB.workingCopies.put(updated, updated.treeNodeId);
      }

      return updated;
    } catch (error) {
      console.error('Failed to update working copy:', error);
      throw error;
    }
  }

  /**
   * Commit working copy to CoreDB
   */
  async commitWorkingCopy(workingCopyId: NodeId): Promise<NodeId> {
    try {
      // Get working copy from EphemeralDB
      const workingCopy = await this.getWorkingCopy(workingCopyId);
      if (!workingCopy) {
        throw new Error(`Working copy not found: ${workingCopyId}`);
      }

      const updates = mapWorkingCopyToUpdates(workingCopy);
      let nodeId: NodeId;

      if (workingCopy.isDraft) {
        const entityData: CreateShapeData = {
          name: updates.name ?? workingCopy.draft.name ?? '',
          description: updates.description ?? workingCopy.draft.description,
          dataSourceName: updates.dataSourceName ?? workingCopy.draft.dataSourceName ?? 'naturalearth',
          processingConfig: updates.processingConfig ?? workingCopy.draft.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
        };

        const entity = await this.createEntity(workingCopy.treeNodeId, entityData);
        nodeId = entity.nodeId;

        const postCreateUpdates: Partial<ShapeEntity> = {
          licenseAgreement: updates.licenseAgreement ?? workingCopy.draft.licenseAgreement ?? false,
          checkboxState: updates.checkboxState ?? workingCopy.draft.checkboxState ?? [],
          batchSessionId: updates.batchSessionId,
          processingStatus: updates.processingStatus ?? 'idle',
        };
        await this.updateEntity(entity.id, postCreateUpdates);
      } else {
        const targetNodeId = workingCopy.nodeId || workingCopy.treeNodeId;
        await this.updateEntity(targetNodeId, updates);
        nodeId = targetNodeId;
      }

      await this.discardWorkingCopy(workingCopyId);
      return nodeId;
    } catch (error) {
      console.error('Failed to commit working copy:', error);
      throw error;
    }
  }

  /**
   * Discard working copy from EphemeralDB
   */
  async discardWorkingCopy(workingCopyId: NodeId): Promise<void> {
    try {
      if (this.ephemeralDB?.workingCopies) {
        await this.ephemeralDB.workingCopies.delete(workingCopyId);
      }
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }

  /**
   * Apply working copy changes to entity
   */
  async applyWorkingCopy(nodeId: NodeId, workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
    const updates: Partial<ShapeEntity> = mapWorkingCopyToUpdates(workingCopy) as Partial<ShapeEntity>;
    return this.updateEntity(nodeId, updates);
  }

  /**
   * Update processing status for batch operations
   */
  async updateProcessingStatus(
    nodeId: NodeId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string,
  ): Promise<void> {
    const updates: Partial<ShapeEntity> = {
      processingStatus: status,
    };

    if (batchSessionId !== undefined) {
      updates.batchSessionId = batchSessionId;
    }

    await this.updateEntity(nodeId, updates);
  }

  /**
   * Get processing statistics for entity
   */
  async getProcessingStats(nodeId: NodeId): Promise<{
    featureCount: number;
    tileCount: number;
    storageUsed: number;
    lastProcessed?: number;
  }> {
    // In real implementation, would query related tables for statistics
    console.log(`Getting processing stats for entity: ${nodeId}`);
    return {
      featureCount: 0,
      tileCount: 0,
      storageUsed: 0,
    };
  }

  /**
   * Override delete to handle batch session cleanup
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    try {
      const entity = await this.table.get(nodeId);
      if (!entity) {
        throw new Error(`Shape entity not found: ${nodeId}`);
      }

      // Cancel any active batch sessions
      if (entity.batchSessionId) {
        await this.cancelBatchSession(entity.batchSessionId);
      }

      // Cleanup related data
      await this.cleanupEntityData(entity);

      // Call parent delete method
      await super.deleteEntity(nodeId);

      console.log(`Deleted Shape entity: ${nodeId}`);
    } catch (error) {
      console.error('Failed to delete Shape entity:', error);
      throw error;
    }
  }

  /**
   * Protected helper: Cancel batch session
   */
  protected async cancelBatchSession(sessionId: string): Promise<void> {
    try {
      console.log(`Cancelling batch session: ${sessionId}`);
      // Would cancel active workers and cleanup session
    } catch (error) {
      console.error('Failed to cancel batch session:', error);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Protected helper: Cleanup entity data
   */
  protected async cleanupEntityData(entity: ShapeEntity): Promise<void> {
    try {
      console.log(`Cleaning up data for Shape entity: ${entity.id}`);
      // Would cleanup:
      // 1. Feature data
      // 2. Vector tiles
      // 3. Cache entries
      // 4. Batch sessions
    } catch (error) {
      console.error('Error during entity cleanup:', error);
      // Don't throw - cleanup is best effort
    }
  }
}

export { ShapeEntityService as ShapeEntityHandler };
