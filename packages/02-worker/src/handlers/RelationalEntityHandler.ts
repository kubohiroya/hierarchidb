/**
 * @file RelationalEntityHandler.ts
 * @description Specialized handler for RelationalEntity (N:N relationship)
 * Based on 3-classification entity system
 */

import type { RelationalEntity, NodeId, EntityId, PeerEntity } from '@hierarchidb/00-core';
import { BaseEntityHandler } from './BaseEntityHandler';

/**
 * Abstract handler specialized for RelationalEntity (N:N relationship with TreeNodes)
 * 
 * Features:
 * - N:N relationship with multiple TreeNodes
 * - Reference counting for automatic cleanup
 * - Shared resource management
 * - Efficient reference operations
 */
export abstract class RelationalEntityHandler<TEntity extends RelationalEntity = RelationalEntity>
  extends BaseEntityHandler<TEntity> {

  /**
   * RelationalEntity specific: Use EntityId as primary key
   * Allows shared entities across multiple nodes
   */
  protected getPrimaryKey(entityId: EntityId): string {
    if (!entityId) {
      throw new Error('RelationalEntity requires EntityId as primary key');
    }
    return entityId;
  }

  /**
   * Add a reference from a node to an entity
   * Core operation for RelationalEntity management
   */
  async addReference(entityId: EntityId, nodeId: NodeId): Promise<TEntity> {
    let entity = await this.getEntityById(entityId);
    
    if (!entity) {
      // Create new entity if it doesn't exist
      entity = await this.createSharedEntity(entityId, nodeId);
    } else {
      // Add reference to existing entity
      const relationalEntityData = entity as RelationalEntity;
      if (!relationalEntityData.nodeIds.includes(nodeId)) {
        relationalEntityData.nodeIds.push(nodeId);
        relationalEntityData.referenceCount = relationalEntityData.nodeIds.length;
        relationalEntityData.lastAccessedAt = Date.now();
        relationalEntityData.updatedAt = Date.now();
        relationalEntityData.version += 1;
        
        await this.db.table(this.tableName).put(relationalEntityData as TEntity);
        this.log(`Reference added: ${nodeId} -> ${entityId} (count: ${relationalEntityData.referenceCount})`)
      }
    }
    
    return entity;
  }

  /**
   * Remove a reference from a node to an entity
   * Automatically deletes entity if no references remain
   */
  async removeReference(entityId: EntityId, nodeId: NodeId): Promise<boolean> {
    const entity = await this.getEntityById(entityId);
    if (!entity) {
      return false;
    }
    
    const relationalEntityData = entity as RelationalEntity;
    const index = relationalEntityData.nodeIds.indexOf(nodeId);
    if (index === -1) {
      return false; // Reference didn't exist
    }
    
    relationalEntityData.nodeIds.splice(index, 1);
    relationalEntityData.referenceCount = relationalEntityData.nodeIds.length;
    relationalEntityData.updatedAt = Date.now();
    relationalEntityData.version += 1;
    
    if (relationalEntityData.referenceCount === 0) {
      // No more references, delete the entity
      await this.db.table(this.tableName).delete(entityId);
      this.log(`RelationalEntity auto-deleted: ${entityId} (no references remaining)`);
      return true;
    } else {
      // Update entity with reduced reference count
      await this.db.table(this.tableName).put(relationalEntityData as TEntity);
      this.log(`Reference removed: ${nodeId} -> ${entityId} (count: ${relationalEntityData.referenceCount})`)
      return false;
    }
  }

  /**
   * Get entity by EntityId (not NodeId)
   */
  async getEntityById(entityId: EntityId): Promise<TEntity | undefined> {
    return await this.db.table(this.tableName).get(entityId);
  }

  /**
   * Get all entities referenced by a specific node
   */
  async getReferencedEntities(nodeId: NodeId): Promise<TEntity[]> {
    return await this.db.table(this.tableName)
      .where('nodeIds')
      .anyOf([nodeId])
      .toArray();
  }

  /**
   * Get all nodes that reference a specific entity
   */
  async getReferencingNodes(entityId: EntityId): Promise<NodeId[]> {
    const entity = await this.getEntityById(entityId);
    return entity ? (entity as RelationalEntity).nodeIds : [];
  }

  /**
   * Remove all references from a specific node
   * Used when a node is deleted
   */
  async removeAllReferences(nodeId: NodeId): Promise<EntityId[]> {
    const referencedEntities = await this.getReferencedEntities(nodeId);
    const deletedEntityIds: EntityId[] = [];
    
    for (const entity of referencedEntities) {
      const wasDeleted = await this.removeReference(entity.id, nodeId);
      if (wasDeleted) {
        deletedEntityIds.push(entity.id);
      }
    }
    
    return deletedEntityIds;
  }

  /**
   * Create a shared entity with initial reference
   */
  protected async createSharedEntity(entityId: EntityId, nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity> {
    const entity: TEntity = {
      ...data,
      id: entityId,
      nodeIds: [nodeId],
      referenceCount: 1,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as TEntity;
    
    await this.db.table(this.tableName).add(entity);
    this.log(`RelationalEntity created: ${entityId} with initial reference from ${nodeId}`);
    
    return entity;
  }

  /**
   * Update entity content (not references)
   * All referencing nodes will see the update
   */
  async updateEntityContent(entityId: EntityId, updates: Partial<TEntity>): Promise<void> {
    const entity = await this.getEntityById(entityId);
    if (!entity) {
      throw new Error(`RelationalEntity not found: ${entityId}`);
    }
    
    // Preserve reference management fields
    const updatedEntity = {
      ...entity,
      ...updates,
      // Don't allow updating reference management fields directly
      id: entity.id,
      nodeIds: (entity as RelationalEntity).nodeIds,
      referenceCount: (entity as RelationalEntity).referenceCount,
      updatedAt: Date.now(),
      version: entity.version + 1,
    };
    
    await this.db.table(this.tableName).put(updatedEntity);
    this.log(`RelationalEntity content updated: ${entityId} (affects ${(entity as RelationalEntity).referenceCount} references)`);
  }

  /**
   * Get entities with low reference counts (candidates for cleanup)
   */
  async getLowUsageEntities(maxReferences: number = 1): Promise<TEntity[]> {
    return await this.db.table(this.tableName)
      .where('referenceCount')
      .belowOrEqual(maxReferences)
      .toArray();
  }

  /**
   * Get entities not accessed recently (candidates for cleanup)
   */
  async getStaleEntities(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<TEntity[]> {
    const cutoffTime = Date.now() - olderThanMs;
    return await this.db.table(this.tableName)
      .where('lastAccessedAt')
      .below(cutoffTime)
      .toArray();
  }

  /**
   * Cleanup orphaned entities with zero references
   * Should be called periodically
   */
  async cleanupOrphanedEntities(): Promise<number> {
    const orphans = await this.db.table(this.tableName)
      .where('referenceCount')
      .equals(0)
      .toArray();
    
    if (orphans.length > 0) {
      const orphanIds = orphans.map(e => e.id);
      await this.db.table(this.tableName).bulkDelete(orphanIds);
      this.log(`Cleaned up ${orphans.length} orphaned RelationalEntities`);
    }
    
    return orphans.length;
  }

  /**
   * Generate unique EntityId for RelationalEntity
   */
  protected generateEntityId(): EntityId {
    return crypto.randomUUID() as EntityId;
  }

  // ==================
  // Lifecycle integration hooks
  // ==================

  /**
   * Called when a TreeNode is created
   * Default implementation does nothing (RelationalEntities are typically shared)
   */
  async onNodeCreated(nodeId: NodeId, nodeData: any): Promise<void> {
    // RelationalEntities are typically created on-demand when references are needed
    this.log(`Node created: ${nodeId}. RelationalEntities will be referenced as needed.`);
  }

  /**
   * Called when a TreeNode is updated
   * Default implementation does nothing (RelationalEntities are independent)
   */
  async onNodeUpdated(nodeId: NodeId, nodeData: any, oldNodeData?: any): Promise<void> {
    // RelationalEntities typically don't sync with individual node updates
    // Override if specific behavior is needed
  }

  /**
   * Called when a TreeNode is deleted
   * Default implementation removes all references from the deleted node
   */
  async onNodeDeleted(nodeId: NodeId): Promise<void> {
    const deletedEntityIds = await this.removeAllReferences(nodeId);
    this.log(`Node deleted: ${nodeId}. Auto-deleted ${deletedEntityIds.length} RelationalEntities with no remaining references.`);
  }

  // ==================
  // Utility methods
  // ==================

  /**
   * Validate entity has required RelationalEntity properties
   */
  protected validateRelationalEntity(entity: Partial<TEntity>): void {
    const relationalEntityData = entity as Partial<RelationalEntity>;
    if (!Array.isArray(relationalEntityData.nodeIds)) {
      throw new Error('RelationalEntity must have nodeIds array');
    }
    if (typeof relationalEntityData.referenceCount !== 'number' || relationalEntityData.referenceCount < 0) {
      throw new Error('RelationalEntity must have valid referenceCount');
    }
    if (relationalEntityData.nodeIds.length !== relationalEntityData.referenceCount) {
      throw new Error('RelationalEntity referenceCount must match referencingNodeIds length');
    }
  }

  /**
   * Touch entity to update lastAccessedAt
   */
  async touchEntity(entityId: EntityId): Promise<void> {
    const entity = await this.getEntityById(entityId);
    if (entity) {
      entity.lastAccessedAt = Date.now();
      await this.db.table(this.tableName).put(entity);
    }
  }

  /**
   * Get reference statistics
   */
  async getReferenceStats(): Promise<{
    totalEntities: number;
    totalReferences: number;
    averageReferences: number;
    orphanedEntities: number;
  }> {
    const allEntities = await this.db.table(this.tableName).toArray();
    const totalEntities = allEntities.length;
    const totalReferences = allEntities.reduce((sum, e) => sum + e.referenceCount, 0);
    const averageReferences = totalEntities > 0 ? totalReferences / totalEntities : 0;
    const orphanedEntities = allEntities.filter(e => e.referenceCount === 0).length;
    
    return {
      totalEntities,
      totalReferences,
      averageReferences,
      orphanedEntities,
    };
  }
}

export default RelationalEntityHandler;