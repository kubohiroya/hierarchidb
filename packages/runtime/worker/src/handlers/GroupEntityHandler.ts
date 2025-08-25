/**
 * @file GroupEntityHandler.ts
 * @description Specialized handler for GroupEntity (1:N relationship)
 * Based on 3-classification entity system
 */

import type { GroupEntity, NodeId, EntityId } from '@hierarchidb/common-core';
import { BaseEntityHandler } from './BaseEntityHandler';

/**
 * Abstract handler specialized for GroupEntity (1:N relationship with TreeNode)
 *
 * Features:
 * - 1:N relationship with TreeNode (multiple entities per node)
 * - Batch operations support
 * - Index-based ordering within groups
 * - Efficient bulk operations
 */
export abstract class GroupEntityHandler<
  TEntity extends GroupEntity = GroupEntity,
> extends BaseEntityHandler<TEntity> {
  /**
   * GroupEntity specific: Use output EntityId as primary key
   * Allows multiple entities per node
   */
  protected getPrimaryKey(nodeId: NodeId, entityId?: EntityId): string {
    if (!entityId) {
      throw new Error('GroupEntity requires EntityId as primary key');
    }
    return entityId;
  }

  /**
   * Create multiple entities in a batch
   * Optimized for GroupEntity's 1:N nature
   */
  async createBatch(nodeId: NodeId, items: Partial<TEntity>[]): Promise<TEntity[]> {
    const entities: TEntity[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entityData = {
        ...item,
        id: this.generateEntityId(),
        nodeId: nodeId,
        index: (item as any)?.index ?? i, // Default to array index if not specified
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as unknown as TEntity;

      entities.push(entityData);
    }

    await this.db.table(this.tableName).bulkAdd(entities);

    // Log creation events
    entities.forEach((entity) => {
      this.log(`GroupEntity created: ${entity.id} for node: ${nodeId}`);
    });

    return entities;
  }

  /**
   * Get all entities belonging to a specific node
   * Core operation for GroupEntity
   */
  async getByParentNode(nodeId: NodeId): Promise<TEntity[]> {
    return await this.db
      .table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      // .orderBy('index') - Not available in basic Dexie Collection
      .toArray();
  }

  /**
   * Update entities by parent node with batch operations
   */
  async updateBatchByNode(nodeId: NodeId, updates: Partial<TEntity>[]): Promise<void> {
    const existingEntities = await this.getByParentNode(nodeId);

    for (let i = 0; i < updates.length && i < existingEntities.length; i++) {
      const entity = existingEntities[i];
      const update = updates[i];

      const updatedEntity = {
        ...entity,
        ...update,
        updatedAt: Date.now(),
        version: (entity?.version ?? 0) + 1,
      };

      await this.db.table(this.tableName).put(updatedEntity);
    }
  }

  /**
   * Delete all entities belonging to a specific node
   * Essential for GroupEntity cleanup
   */
  async deleteByParentNode(nodeId: NodeId): Promise<void> {
    const count = await this.db.table(this.tableName).where('nodeId').equals(nodeId).delete();

    this.log(`Deleted ${count} GroupEntities for node: ${nodeId}`);
  }

  /**
   * Reorder entities within a group
   * GroupEntity specific functionality
   */
  async reorderEntities(nodeId: NodeId, orderedIds: EntityId[]): Promise<void> {
    const entities = await this.getByParentNode(nodeId);
    const entityMap = new Map(entities.map((e) => [e.id, e]));

    const updates: TEntity[] = [];

    for (let i = 0; i < orderedIds.length; i++) {
      const entityId = orderedIds[i];
      if (!entityId) continue;

      const entity = entityMap.get(entityId);

      if (entity) {
        updates.push({
          ...entity,
          index: i,
          updatedAt: Date.now(),
          version: entity.version + 1,
        });
      }
    }

    if (updates.length > 0) {
      await this.db.table(this.tableName).bulkPut(updates);
    }
  }

  /**
   * Get entity count for a specific node
   * Useful for pagination and statistics
   */
  async getCountByParentNode(nodeId: NodeId): Promise<number> {
    return await this.db.table(this.tableName).where('nodeId').equals(nodeId).count();
  }

  /**
   * Get entities with pagination
   * Optimized for large groups
   */
  async getByParentNodePaginated(
    nodeId: NodeId,
    offset: number = 0,
    limit: number = 50
  ): Promise<{ entities: TEntity[]; total: number }> {
    const total = await this.getCountByParentNode(nodeId);
    const entities = await this.db
      .table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      // .orderBy('index') - Not available in basic Dexie Collection
      .offset(offset)
      .limit(limit)
      .toArray();

    return { entities, total };
  }

  /**
   * Find entities by type within a parent node
   * Useful when GroupEntity has subtypes
   */
  async getByParentNodeAndType(nodeId: NodeId, type: string): Promise<TEntity[]> {
    return await this.db
      .table(this.tableName)
      .where(['nodeId', 'type'])
      .equals([nodeId, type])
      // .orderBy('index') - Not available in basic Dexie Collection
      .toArray();
  }

  /**
   * Generate unique EntityId for GroupEntity
   */
  protected generateEntityId(): EntityId {
    return crypto.randomUUID() as EntityId;
  }

  // ==================
  // Lifecycle integration hooks
  // ==================

  /**
   * Called when the associated TreeNode is created
   * Default implementation does nothing (GroupEntities are typically created on-demand)
   */
  async onNodeCreated(nodeId: NodeId, nodeData: any): Promise<void> {
    // GroupEntities are typically created on-demand, not automatically
    this.log(`Node created: ${nodeId}. GroupEntities will be created on-demand.`);
  }

  /**
   * Called when the associated TreeNode is updated
   * Default implementation does nothing (GroupEntities are independent)
   */
  async onNodeUpdated(nodeId: NodeId, nodeData: any, oldNodeData?: any): Promise<void> {
    // GroupEntities typically don't sync with node updates
    // Override if specific behavior is needed
  }

  /**
   * Called when the associated TreeNode is deleted
   * Default implementation deletes all GroupEntities for the node
   */
  async onNodeDeleted(nodeId: NodeId): Promise<void> {
    await this.deleteByParentNode(nodeId);
  }

  /**
   * Called when the associated TreeNode is moved
   * Default implementation updates parentId for all entities
   */
  async onNodeMoved(nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId): Promise<void> {
    // GroupEntities typically stay with their direct parent (the node itself)
    // This method is for cases where entities need to be aware of node hierarchy changes
    this.log(`Node moved: ${nodeId} from ${oldParentId} to ${newParentId}`);
  }

  // ==================
  // Utility methods
  // ==================

  /**
   * Validate entity has required GroupEntity properties
   */
  protected validateGroupEntity(entity: Partial<TEntity>): void {
    if (!(entity as any).nodeId) {
      throw new Error('GroupEntity must have nodeId');
    }
    if ((entity as any).index === undefined || (entity as any).index < 0) {
      throw new Error('GroupEntity must have valid index');
    }
  }

  /**
   * Override createEntity to add GroupEntity specific validation
   */
  async createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity> {
    const entityData = {
      ...data,
      parentId: nodeId,
      id: this.generateEntityId(),
      index: (data as any)?.index ?? (await this.getNextIndex(nodeId)),
    } as unknown as Partial<TEntity>;

    this.validateGroupEntity(entityData);
    // Cannot call abstract method via super - must implement directly
    const now = Date.now();
    const entity = {
      ...entityData,
      nodeId,
      createdAt: entityData.createdAt ?? now,
      updatedAt: entityData.updatedAt ?? now,
      version: entityData.version ?? 1,
    } as TEntity;

    await this.db.table(this.tableName).add(entity);
    return entity;
  }

  /**
   * Get next available index for new entity
   */
  protected async getNextIndex(nodeId: NodeId): Promise<number> {
    const count = await this.getCountByParentNode(nodeId);
    return count;
  }
}

export default GroupEntityHandler;
