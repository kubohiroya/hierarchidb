/**
 * @file BaseEntityHandler.ts
 * @description Base entity handler class for all HierarchiDB plugins
 */

import type { Collection, IndexableType, Table } from 'dexie';
import type { BaseEntity, NodeId } from '@hierarchidb/common-type';
import type { BaseSearchCriteria, EntityLifecycleHooks, OperationResult, PaginatedResult } from '../types.js';

/**
 * Abstract base class for entity handlers
 * Provides common CRUD operations for all plugin entities
 */
export abstract class BaseEntityHandler<
  TEntity extends BaseEntity,
  TCreateData extends Partial<TEntity> = Partial<TEntity>,
  TSearchCriteria extends BaseSearchCriteria = BaseSearchCriteria,
> {
  protected abstract table: Table<TEntity, NodeId, TEntity>;
  protected lifecycleHooks: EntityLifecycleHooks<TEntity> = {};

  /**
   * Set lifecycle hooks for entity operations
   */
  setLifecycleHooks(hooks: EntityLifecycleHooks<TEntity>): void {
    this.lifecycleHooks = hooks;
  }

  /**
   * Create a new entity
   */
  async createEntity(nodeId: NodeId, data: TCreateData): Promise<TEntity> {
    try {
      // Pre-creation hook
      if (this.lifecycleHooks.beforeCreate) {
        await this.lifecycleHooks.beforeCreate(data);
      }

      const entityId = crypto.randomUUID() as unknown as NodeId;
      const entity = this.buildEntity(nodeId, entityId, data);

      await this.table.add(entity);

      // Post-creation hook
      if (this.lifecycleHooks.afterCreate) {
        await this.lifecycleHooks.afterCreate(entity);
      }

      return entity;
    } catch (error) {
      console.error('Failed to create entity:', error);
      throw error;
    }
  }

  /**
   * Update an existing entity
   */
  async updateEntity(entityId: NodeId, updates: Partial<TEntity>): Promise<TEntity> {
    try {
      const existing = await this.table.get(entityId);
      if (!existing) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      // Pre-update hook
      if (this.lifecycleHooks.beforeUpdate) {
        await this.lifecycleHooks.beforeUpdate(existing, updates);
      }

      const baseTs = typeof (existing as any).updatedAt === 'number' ? (existing as any).updatedAt : Date.now();
      const updatedAt = baseTs + 1; // ensure strictly greater than previous
      const updated: TEntity = {
        ...existing,
        ...updates,
        updatedAt,
        version: existing.version + 1,
      };

      await this.table.put(updated);

      // Post-update hook
      if (this.lifecycleHooks.afterUpdate) {
        await this.lifecycleHooks.afterUpdate(updated);
      }

      return updated;
    } catch (error) {
      console.error('Failed to update entity:', error);
      throw error;
    }
  }

  /**
   * Delete an entity
   */
  async deleteEntity(entityId: NodeId): Promise<void> {
    try {
      const entity = await this.table.get(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      // Pre-deletion hook
      if (this.lifecycleHooks.beforeDelete) {
        await this.lifecycleHooks.beforeDelete(entity);
      }

      // Cleanup related data
      await this.cleanupEntityData(entity);

      // Delete from database
      await this.table.delete(entityId);

      // Post-deletion hook
      if (this.lifecycleHooks.afterDelete) {
        await this.lifecycleHooks.afterDelete(entityId);
      }
    } catch (error) {
      console.error('Failed to delete entity:', error);
      throw error;
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: NodeId): Promise<TEntity | null> {
    try {
      const entity = await this.table.get(entityId);
      return entity || null;
    } catch (error) {
      console.error('Failed to get entity:', error);
      throw error;
    }
  }

  /**
   * Get entity by node ID
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<TEntity | null> {
    try {
      const entity = await this.table.where('nodeId').equals(nodeId).first();
      return entity || null;
    } catch (error) {
      console.error('Failed to get entity by node ID:', error);
      throw error;
    }
  }

  /**
   * List all entities with optional pagination
   */
  async listEntities(limit?: number, offset?: number): Promise<TEntity[]> {
    try {
      let query = this.table.orderBy('updatedAt').reverse();

      if (offset !== undefined) {
        query = query.offset(offset);
      }

      if (limit !== undefined) {
        query = query.limit(limit);
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to list entities:', error);
      throw error;
    }
  }

  /**
   * Get paginated entities
   */
  async getPaginatedEntities(
    page: number = 1,
    pageSize: number = 20,
    orderBy: string = 'updatedAt',
  ): Promise<PaginatedResult<TEntity>> {
    try {
      const offset = (page - 1) * pageSize;
      const total = await this.table.count();

      let query = this.table.orderBy(orderBy);
      if (orderBy === 'updatedAt' || orderBy === 'createdAt') {
        query = query.reverse();
      }

      const items = await query.offset(offset).limit(pageSize).toArray();

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error('Failed to get paginated entities:', error);
      throw error;
    }
  }

  /**
   * Search entities by criteria
   */
  async searchEntities(criteria: TSearchCriteria): Promise<TEntity[]> {
    try {
      let query = this.table.toCollection();

      // Apply base search criteria
      if (criteria.name) {
        query = query.filter((entity: any) =>
          entity.name?.toLowerCase().includes(criteria.name!.toLowerCase()),
        );
      }

      if (criteria.createdAfter) {
        query = query.filter((entity: any) => entity.createdAt >= criteria.createdAfter!);
      }

      if (criteria.createdBefore) {
        query = query.filter((entity: any) => entity.createdAt <= criteria.createdBefore!);
      }

      if (criteria.updatedAfter) {
        query = query.filter((entity: any) => entity.updatedAt >= criteria.updatedAfter!);
      }

      if (criteria.updatedBefore) {
        query = query.filter((entity: any) => entity.updatedAt <= criteria.updatedBefore!);
      }

      // Apply additional criteria from derived classes
      query = this.applyAdditionalSearchCriteria(query, criteria);

      return await query.toArray();
    } catch (error) {
      console.error('Failed to search entities:', error);
      throw error;
    }
  }

  /**
   * Check if entity exists
   */
  async entityExists(entityId: NodeId): Promise<boolean> {
    try {
      const count = await this.table.where('id').equals(entityId).count();
      return count > 0;
    } catch (error) {
      console.error('Failed to check entity existence:', error);
      throw error;
    }
  }

  /**
   * Count entities
   */
  async countEntities(criteria?: TSearchCriteria): Promise<number> {
    try {
      if (!criteria) {
        return await this.table.count();
      }

      const entities = await this.searchEntities(criteria);
      return entities.length;
    } catch (error) {
      console.error('Failed to count entities:', error);
      throw error;
    }
  }

  /**
   * Batch create entities
   */
  async batchCreateEntities(
    items: Array<{ nodeId: NodeId; data: TCreateData }>,
  ): Promise<TEntity[]> {
    try {
      const entities: TEntity[] = [];

      for (const item of items) {
        const entityId = crypto.randomUUID() as unknown as NodeId;
        const entity = this.buildEntity(item.nodeId, entityId, item.data);
        entities.push(entity);
      }

      await this.table.bulkAdd(entities);
      return entities;
    } catch (error) {
      console.error('Failed to batch create entities:', error);
      throw error;
    }
  }

  /**
   * Batch update entities
   */
  async batchUpdateEntities(
    updates: Array<{ entityId: NodeId; updates: Partial<TEntity> }>,
  ): Promise<OperationResult<TEntity[]>> {
    try {
      const updatedEntities: TEntity[] = [];
      const errors: Error[] = [];

      for (const update of updates) {
        try {
          const entity = await this.updateEntity(update.entityId, update.updates);
          updatedEntities.push(entity);
        } catch (error) {
          errors.push(error as Error);
        }
      }

      return {
        success: errors.length === 0,
        data: updatedEntities,
        error:
          errors.length > 0 ? new Error(`Failed to update ${errors.length} entities`) : undefined,
      };
    } catch (error) {
      console.error('Failed to batch update entities:', error);
      throw error;
    }
  }

  /**
   * Batch delete entities
   */
  async batchDeleteEntities(entityIds: NodeId[]): Promise<OperationResult> {
    try {
      const errors: Error[] = [];

      for (const entityId of entityIds) {
        try {
          await this.deleteEntity(entityId);
        } catch (error) {
          errors.push(error as Error);
        }
      }

      return {
        success: errors.length === 0,
        error:
          errors.length > 0 ? new Error(`Failed to delete ${errors.length} entities`) : undefined,
      };
    } catch (error) {
      console.error('Failed to batch delete entities:', error);
      throw error;
    }
  }

  /**
   * Abstract method to build entity from data
   * Must be implemented by derived classes
   */
  protected abstract buildEntity(_nodeId: NodeId, _entityId: NodeId, _data: TCreateData): TEntity;

  /**
   * Optional method to cleanup related data when entity is deleted
   * Can be overridden by derived classes
   */
  protected async cleanupEntityData(_entity: TEntity): Promise<void> {
    // Default implementation does nothing
    // Override in derived classes for specific cleanup logic
  }

  /**
   * Optional method to apply additional search criteria
   * Can be overridden by derived classes
   */
  protected applyAdditionalSearchCriteria(
    query: Collection<TEntity, IndexableType, TEntity>,
    _criteria: TSearchCriteria,
  ): Collection<TEntity, any, TEntity> {
    // Mark _criteria as intentionally unused in base implementation
    void _criteria;
    // Default implementation returns query unchanged
    // Override in derived classes for additional filtering
    return query;
  }
}
