/**
 * Shape Entity Handler - Worker Layer
 * Manages CRUD operations for Shape entities in Worker environment
 */

import { Dexie, type Collection, type IndexableType, type Table } from 'dexie';
import type { DataSourceName, NodeId } from '../../common/shared/index.js';
import {
  buildShapeEntityFromCreate,
  createDraftFromEntity,
  DEFAULT_PROCESSING_CONFIG,
  mapDraftToUpdates,
  type ProcessingConfig,
  type ShapeEntity,
  type ShapeDraft,
} from '../../common/shared/index.js';
import {
  BaseEntityService,
  markDraftUpdated,
} from '@hierarchidb/plugin-runtime-services';
import type { Timestamp } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';

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

  private static defaultDb: Dexie | null = null;

  private static ensureDefaultTable(): Table<ShapeEntity, NodeId> {
    if (!ShapeEntityService.defaultDb) {
      const db = new Dexie(getDBName('shape-entity-service'));
      db.version(1).stores({
        shapeEntities: '&id, nodeId',
      });
      ShapeEntityService.defaultDb = db;
    }
    return ShapeEntityService.defaultDb.table('shapeEntities') as Table<ShapeEntity, NodeId>;
  }

  constructor(table?: Table<ShapeEntity, NodeId>, ephemeralDB?: any) {
    super();
    this.table = table ?? ShapeEntityService.ensureDefaultTable();
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
      query = query.filter(entity => (entity.name ?? '').toLowerCase().includes(needle));
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
  async createDraft(entity: ShapeEntity): Promise<ShapeDraft> {
    const draft = createDraftFromEntity(entity);

    if (this.ephemeralDB?.workingCopies) {
      await this.ephemeralDB.workingCopies.put(draft, draft.treeNodeId);
    }

    return draft;
  }

  /**
   * Get working copy from EphemeralDB
   */
  async getDraft(draftId: NodeId): Promise<ShapeDraft | undefined> {
    try {
      if (!this.ephemeralDB?.workingCopies) {
        return undefined;
      }
      const draft = await this.ephemeralDB.workingCopies.get(draftId);
      return draft as ShapeDraft | undefined;
    } catch (error) {
      console.error('Failed to get working copy:', error);
      return undefined;
    }
  }

  /**
   * Update working copy in EphemeralDB
   */
  async updateDraft(
    draftId: NodeId,
    data: Partial<ShapeEntity>,
  ): Promise<ShapeDraft> {
    try {
      const existing = await this.getDraft(draftId);
      if (!existing) {
        throw new Error(`Working copy not found: ${draftId}`);
      }

      const timestamp = Date.now() as Timestamp;
      const base = markDraftUpdated(existing, data, timestamp);
      const updated: ShapeDraft = {
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
  async commitDraft(draftId: NodeId): Promise<void> {
    try {
      // Get working copy from EphemeralDB
      const draft = await this.getDraft(draftId);
      if (!draft) {
        throw new Error(`Working copy not found: ${draftId}`);
      }

      const updates = mapDraftToUpdates(draft);

      if (draft) {
        const entityData: CreateShapeData = {
          name: updates.name ?? draft.draft.name ?? '',
          description: updates.description ?? draft.draft.description,
          dataSourceName: updates.dataSourceName ?? draft.draft.dataSourceName ?? 'naturalearth',
          processingConfig: updates.processingConfig ?? draft.draft.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
        };

        const entity = await this.createEntity(draft.treeNodeId, entityData);

        const postCreateUpdates: Partial<ShapeEntity> = {
          licenseAgreement: updates.licenseAgreement ?? draft.draft.licenseAgreement ?? false,
          checkboxState: updates.checkboxState ?? draft.draft.checkboxState ?? [],
          batchSessionId: updates.batchSessionId,
          processingStatus: updates.processingStatus ?? 'idle',
        };
        await this.updateEntity(entity.id, postCreateUpdates);
      }

      await this.discardDraft(draftId);
      return;
    } catch (error) {
      console.error('Failed to commit working copy:', error);
      throw error;
    }
  }

  /**
   * Discard working copy from EphemeralDB
   */
  async discardDraft(draftId: NodeId): Promise<void> {
    try {
      if (this.ephemeralDB?.workingCopies) {
        await this.ephemeralDB.workingCopies.delete(draftId);
      }
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }

  /**
   * Apply working copy changes to entity
   */
  async applyDraft(nodeId: NodeId, draft: ShapeDraft): Promise<ShapeEntity> {
    const updates: Partial<ShapeEntity> = mapDraftToUpdates(draft) as Partial<ShapeEntity>;
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
