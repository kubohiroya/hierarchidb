/**
 * @file PeerEntityHandler.ts
 * @description Specialized handler for PeerEntity (1:1 relationship)
 * Based on 3-classification entity system
 */

import type { PeerEntity, NodeId } from '@hierarchidb/00-core';
import { BaseEntityHandler } from './BaseEntityHandler';

/**
 * Abstract handler specialized for PeerEntity (1:1 relationship with TreeNode)
 * 
 * Features:
 * - 1:1 relationship with TreeNode guaranteed
 * - Automatic synchronization with node lifecycle
 * - Simplified CRUD operations for single entities
 */
export abstract class PeerEntityHandler<TEntity extends PeerEntity = PeerEntity>
  extends BaseEntityHandler<TEntity> {

  /**
   * PeerEntity specific: Always use NodeId as primary key
   * Ensures 1:1 relationship with TreeNode
   */
  protected getPrimaryKey(nodeId: NodeId): string {
    return nodeId;
  }

  /**
   * PeerEntity specific: Sync entity with node changes
   * Called automatically when TreeNode is updated
   */
  protected async syncWithNode(nodeId: NodeId, nodeData?: Partial<any>): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity && nodeData) {
      // Update entity based on node changes
      const updates = this.extractEntityUpdatesFromNode(nodeData);
      if (Object.keys(updates).length > 0) {
        await this.updateEntity(nodeId, updates);
      }
    }
  }

  /**
   * Extract entity-relevant updates from TreeNode changes
   * Override in subclasses to define which node changes should update the entity
   */
  protected extractEntityUpdatesFromNode(nodeData: Partial<any>): Partial<TEntity> {
    const updates: Partial<TEntity> = {};
    
    // Common updates from TreeNode
    if (nodeData.name !== undefined) {
      // Override in subclasses if entity should reflect node name changes
    }
    if (nodeData.description !== undefined) {
      // Override in subclasses if entity should reflect description changes
    }
    
    return updates;
  }

  /**
   * PeerEntity specific: Ensure entity exists when getting
   * Creates default entity if it doesn't exist (lazy initialization)
   */
  async ensureEntityExists(nodeId: NodeId): Promise<TEntity> {
    let entity = await this.getEntity(nodeId);
    if (!entity) {
      entity = await this.createEntity(nodeId, this.getDefaultEntityData());
    }
    return entity;
  }

  /**
   * Get default entity data for lazy initialization
   * Override in subclasses to provide appropriate defaults
   */
  protected getDefaultEntityData(): Partial<TEntity> {
    return {} as Partial<TEntity>;
  }

  /**
   * PeerEntity specific: Validate 1:1 relationship
   * Ensures no duplicate entities for the same node
   */
  protected async validateUniqueEntity(nodeId: NodeId): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (existing) {
      throw new Error(`PeerEntity already exists for node: ${nodeId}`);
    }
  }

  /**
   * Override createEntity to add PeerEntity specific validation
   */
  async createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity> {
    await this.validateUniqueEntity(nodeId);
    
    // Since createEntity is abstract in BaseEntityHandler, we implement it here
    const now = Date.now();
    const entity = {
      ...data,
      nodeId,
      createdAt: data?.createdAt ?? now,
      updatedAt: data?.updatedAt ?? now,
      version: data?.version ?? 1,
    } as TEntity;
    
    await this.db.table(this.tableName).add(entity);
    return entity;
  }

  /**
   * PeerEntity specific: Bulk operations are not typical
   * Override if bulk operations are needed for specific use cases
   */
  protected warnAboutBulkOperations(): void {
    this.log('Warning: Bulk operations are unusual for PeerEntity (1:1 relationship)');
  }

  // ==================
  // Lifecycle integration hooks
  // ==================

  /**
   * Called when the associated TreeNode is created
   * Default implementation creates the PeerEntity automatically
   */
  async onNodeCreated(nodeId: NodeId, nodeData: any): Promise<void> {
    await this.createEntity(nodeId, this.deriveEntityDataFromNode(nodeData));
  }

  /**
   * Called when the associated TreeNode is updated
   * Default implementation syncs entity with node changes
   */
  async onNodeUpdated(nodeId: NodeId, nodeData: any, oldNodeData?: any): Promise<void> {
    await this.syncWithNode(nodeId, nodeData);
  }

  /**
   * Called when the associated TreeNode is deleted
   * Default implementation deletes the PeerEntity
   */
  async onNodeDeleted(nodeId: NodeId): Promise<void> {
    await this.deleteEntity(nodeId);
  }

  /**
   * Derive initial entity data from TreeNode data
   * Override in subclasses to map node properties to entity properties
   */
  protected deriveEntityDataFromNode(nodeData: any): Partial<TEntity> {
    return {} as Partial<TEntity>;
  }
}

export default PeerEntityHandler;