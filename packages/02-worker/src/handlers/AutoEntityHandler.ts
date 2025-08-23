/**
 * @file AutoEntityHandler.ts
 * @description Automatic entity handler that uses lifecycle management for CRUD operations
 */

import type { NodeId, TreeNodeType, PeerEntity, WorkingCopyProperties } from '@hierarchidb/00-core';
import type Dexie from 'dexie';
import { AutoLifecycleManager } from '../services/AutoLifecycleManager';
import { WorkingCopySession } from '../services/WorkingCopyManager';

/**
 * Automatic entity handler with lifecycle management
 * Provides simplified CRUD operations using the automatic lifecycle system
 */
export class AutoEntityHandler<TEntity extends PeerEntity> {
  constructor(
    protected nodeType: TreeNodeType,
    protected tableName: string,
    protected autoLifecycleManager: AutoLifecycleManager
  ) {}

  /**
   * Get database instance from lifecycle manager
   */
  protected get database(): Dexie {
    return (this.autoLifecycleManager as any).database;
  }

  /**
   * Create new entity using lifecycle manager
   */
  async createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity> {
    // Validate node ID
    if (!nodeId || nodeId.trim() === '') {
      throw new Error('Invalid node ID provided');
    }

    // Use lifecycle manager to create entity
    await this.autoLifecycleManager.onNodeCreate(nodeId, this.nodeType);

    // Get the created entity
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Failed to create entity for node: ${nodeId}`);
    }

    // Apply additional data if provided
    if (data && Object.keys(data).length > 0) {
      return await this.updateEntity(nodeId, data) as TEntity;
    }

    return entity as TEntity;
  }

  /**
   * Delete entity using lifecycle manager
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    await this.autoLifecycleManager.onNodeDelete(nodeId, this.nodeType);
  }

  /**
   * Duplicate entity using lifecycle manager
   */
  async duplicateEntity(sourceNodeId: NodeId, targetNodeId: NodeId): Promise<TEntity> {
    await this.autoLifecycleManager.onNodeDuplicate(sourceNodeId, targetNodeId, this.nodeType);

    const duplicatedEntity = await this.getEntity(targetNodeId);
    if (!duplicatedEntity) {
      throw new Error(`Failed to duplicate entity from ${sourceNodeId} to ${targetNodeId}`);
    }

    return duplicatedEntity as TEntity;
  }

  /**
   * Get entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<TEntity | undefined> {
    return await this.database.table(this.tableName).get(nodeId) as TEntity | undefined;
  }

  /**
   * Update entity with partial data
   */
  async updateEntity(nodeId: NodeId, updates: Partial<TEntity>): Promise<TEntity | undefined> {
    const table = this.database.table(this.tableName);
    const existing = await table.get(nodeId);
    
    if (!existing) {
      return undefined;
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await table.put(updated);
    return updated as TEntity;
  }

  /**
   * List entities with optional pagination
   */
  async listEntities(offset: number = 0, limit?: number): Promise<TEntity[]> {
    let query = this.database.table(this.tableName).orderBy('createdAt');

    if (offset > 0) {
      query = query.offset(offset);
    }

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    return await query.toArray() as TEntity[];
  }

  /**
   * Count total number of entities
   */
  async countEntities(): Promise<number> {
    return await this.database.table(this.tableName).count();
  }

  /**
   * Create working copy using lifecycle manager
   */
  async createWorkingCopy(nodeId: NodeId): Promise<TEntity & WorkingCopyProperties> {
    const session = await this.autoLifecycleManager.createWorkingCopies(nodeId, this.nodeType);
    
    const workingCopy = session.getWorkingCopy(this.tableName);
    if (!workingCopy) {
      throw new Error(`Failed to create working copy for entity: ${nodeId}`);
    }

    return workingCopy as TEntity & WorkingCopyProperties;
  }

  /**
   * Commit working copy using lifecycle manager
   */
  async commitWorkingCopy(
    nodeId: NodeId,
    workingCopy: TEntity & WorkingCopyProperties
  ): Promise<void> {
    const session = WorkingCopySession.fromWorkingCopy(nodeId, this.tableName, workingCopy);
    await this.autoLifecycleManager.commitWorkingCopies(session);
  }

  /**
   * Discard working copy using lifecycle manager
   */
  async discardWorkingCopy(
    nodeId: NodeId,
    workingCopy: TEntity & WorkingCopyProperties
  ): Promise<void> {
    const session = WorkingCopySession.fromWorkingCopy(nodeId, this.tableName, workingCopy);
    await this.autoLifecycleManager.discardWorkingCopies(session);
  }

  // Protected methods for customization by subclasses

  /**
   * Hook called before entity creation
   */
  protected async beforeCreate(_nodeId: NodeId, _data?: Partial<TEntity>): Promise<void> {
    // Override in subclasses for custom logic
  }

  /**
   * Hook called after entity creation
   */
  protected async afterCreate(_nodeId: NodeId, _entity: TEntity): Promise<void> {
    // Override in subclasses for custom logic
  }

  /**
   * Hook called before entity deletion
   */
  protected async beforeDelete(_nodeId: NodeId): Promise<void> {
    // Override in subclasses for custom logic
  }

  /**
   * Hook called after entity deletion
   */
  protected async afterDelete(_nodeId: NodeId): Promise<void> {
    // Override in subclasses for custom logic
  }

  /**
   * Hook called before entity update
   */
  protected async beforeUpdate(_nodeId: NodeId, _updates: Partial<TEntity>): Promise<void> {
    // Override in subclasses for custom logic
  }

  /**
   * Hook called after entity update
   */
  protected async afterUpdate(_nodeId: NodeId, _entity: TEntity): Promise<void> {
    // Override in subclasses for custom logic
  }
}