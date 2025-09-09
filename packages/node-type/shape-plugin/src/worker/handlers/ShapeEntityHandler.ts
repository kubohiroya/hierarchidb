/**
 * Shape Entity Handler - Worker Layer
 * Manages CRUD operations for Shape entities in Worker environment
 */

import type { Table } from 'dexie';
import type { NodeId, NodeType } from '../../shared';
import {
  buildShapeEntityFromCreate,
  DEFAULT_PROCESSING_CONFIG,
  mapWorkingCopyToUpdates,
  ProcessingConfig,
  ShapeEntity,
  ShapeWorkingCopy,
} from '../../shared';
import { BaseEntityHandler } from '@hierarchidb/base-plugin';

/**
 * Create shape data interface
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: string;
  processingConfig?: Partial<ProcessingConfig>;
  selectedCountries?: string[];
  adminLevels?: number[];
}

/**
 * Shape filter criteria for searching entities
 */
export interface ShapeFilterCriteria {
  name?: string;
  dataSource?: string;
  processingStatus?: string;
  hasActiveBatch?: boolean;
}

/**
 * Entity handler for Shape plugin in Worker layer
 * Extends BaseEntityHandler for common CRUD operations
 */
export class ShapeEntityHandler extends BaseEntityHandler<
  ShapeEntity,
  ShapeWorkingCopy,
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
        dataSourceName: data.dataSourceName as any,
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

  /**
   * Search Shape entities by criteria
   */
  async searchEntities(criteria: ShapeFilterCriteria): Promise<ShapeEntity[]> {
    try {
      let query = this.table.toCollection();

      if (criteria.name) {
        query = query.filter((entity: ShapeEntity) =>
          entity.name.toLowerCase().includes(criteria.name!.toLowerCase()),
        );
      }

      if (criteria.dataSource) {
        query = query.filter((entity: ShapeEntity) =>
          entity.dataSourceName === criteria.dataSource,
        );
      }

      if (criteria.processingStatus) {
        query = query.filter((entity: ShapeEntity) =>
          entity.processingStatus === criteria.processingStatus,
        );
      }

      if (criteria.hasActiveBatch !== undefined) {
        query = query.filter((entity: ShapeEntity) =>
          criteria.hasActiveBatch ? !!entity.batchSessionId : !entity.batchSessionId,
        );
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to search Shape entities:', error);
      throw error;
    }
  }

  /**
   * Create working copy from entity
   */
  async createWorkingCopy(entity: ShapeEntity): Promise<ShapeWorkingCopy> {
    const workingCopy: ShapeWorkingCopy = {
      // Use nodeId as id for working copy
      id: entity.nodeId as NodeId,
      parentId: entity.nodeId, // Use nodeId as parentId for working copy
      nodeType: 'shape' as NodeType,
      nodeId: entity.nodeId,
      name: entity.name,
      depth: 0, // Set appropriate depth

      // WorkingCopyProperties
      originalNodeId: entity.nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true,
      entityWorkingCopyId: entity.id,
      originalVersion: entity.version,

      // Shape entity properties
      description: entity.description,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: false, // Reset for editing
      processingConfig: { ...entity.processingConfig },
      checkboxState: entity.checkboxState,
      selectedCountries: [...entity.selectedCountries],
      adminLevels: [...entity.adminLevels],
      urlMetadata: [...entity.urlMetadata],
      isDraft: false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };

    console.log(`Created working copy for entity: ${entity.id}`);
    return workingCopy;
  }

  /**
   * Create new draft working copy
   */
  async createNewDraftWorkingCopy(parentId: NodeId): Promise<ShapeWorkingCopy> {
    const workingCopyId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as unknown as NodeId;

    const workingCopy: ShapeWorkingCopy = {
      // TreeNode required properties
      id: workingCopyId,
      parentId: parentId,
      nodeType: 'shape' as NodeType,
      nodeId: '' as NodeId, // Will be set when committed
      name: '',
      depth: 0, // Set appropriate depth

      // WorkingCopyProperties
      copiedAt: Date.now(),

      // Shape entity properties
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: DEFAULT_PROCESSING_CONFIG,
      checkboxState: '',
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      isDraft: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // Store in EphemeralDB if available
    if (this.ephemeralDB?.workingCopies) {
      await this.ephemeralDB.workingCopies.put(workingCopy);
    }

    console.log(`Created new draft working copy: ${workingCopyId} for parent: ${parentId}`);
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

      const updated: ShapeWorkingCopy = {
        ...existing,
        ...data,
        updatedAt: Date.now(),
      };

      if (this.ephemeralDB?.workingCopies) {
        await this.ephemeralDB.workingCopies.put(updated);
      }

      console.log(`Updated working copy: ${workingCopyId}`);
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

      let nodeId: NodeId;
      if (workingCopy.isDraft) {
        // Create new entity for draft
        const entityData: CreateShapeData = {
          name: workingCopy.name,
          description: workingCopy.description,
          dataSourceName: workingCopy.dataSourceName,
          processingConfig: workingCopy.processingConfig,
          selectedCountries: workingCopy.selectedCountries,
          adminLevels: workingCopy.adminLevels,
        };
        const entity = await this.createEntity('' as NodeId, entityData);
        nodeId = entity.nodeId;
      } else {
        // Update existing entity
        await this.updateEntity(workingCopy.id, workingCopy);
        nodeId = workingCopy.nodeId;
      }

      // Remove working copy from EphemeralDB
      await this.discardWorkingCopy(workingCopyId);

      console.log(`Committed working copy: ${workingCopyId} to node: ${nodeId}`);
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
      console.log(`Discarded working copy: ${workingCopyId}`);
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
