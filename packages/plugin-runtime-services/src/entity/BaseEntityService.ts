import type { Collection, IndexableType, Table } from 'dexie';
import type { BaseEntity, NodeId } from '@hierarchidb/common-types';
import type {
  BaseSearchCriteria,
  EntityLifecycleHooks,
  OperationResult,
  PaginatedResult,
} from '@hierarchidb/plugin-service-api';

/**
 * Lightweight runtime replacement for the legacy plugin-ui-sdk BaseEntityHandler.
 * Provides the CRUD/search primitives needed by in-repo plugins without
 * requiring plugin-ui-sdk (which only exposes runtime implementations via dist).
 */
export abstract class BaseEntityService<
  TEntity extends BaseEntity,
  TCreateData extends Partial<TEntity> = Partial<TEntity>,
  TSearchCriteria extends BaseSearchCriteria = BaseSearchCriteria,
> {
  protected abstract table: Table<TEntity, NodeId, TEntity>;
  protected lifecycleHooks: EntityLifecycleHooks<TEntity> = {};

  setLifecycleHooks(hooks: EntityLifecycleHooks<TEntity>): void {
    this.lifecycleHooks = hooks;
  }

  async createEntity(nodeId: NodeId, data: TCreateData): Promise<TEntity> {
    if (this.lifecycleHooks.beforeCreate) {
      await this.lifecycleHooks.beforeCreate(data);
    }

    const entityId = crypto.randomUUID() as unknown as NodeId;
    const entity = this.buildEntity(nodeId, entityId, data);

    await this.table.add(entity);

    if (this.lifecycleHooks.afterCreate) {
      await this.lifecycleHooks.afterCreate(entity);
    }

    return entity;
  }

  async updateEntity(entityId: NodeId, updates: Partial<TEntity>): Promise<TEntity> {
    const existing = await this.table.get(entityId);
    if (!existing) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    if (this.lifecycleHooks.beforeUpdate) {
      await this.lifecycleHooks.beforeUpdate(existing, updates);
    }

    const previousUpdatedAt =
      typeof existing.updatedAt === 'number' ? existing.updatedAt : Date.now();
    const updatedAt = Math.max(previousUpdatedAt + 1, Date.now());

    const updated: TEntity = {
      ...existing,
      ...updates,
      updatedAt,
      version: existing.version + 1,
    };

    await this.table.put(updated);

    if (this.lifecycleHooks.afterUpdate) {
      await this.lifecycleHooks.afterUpdate(updated);
    }

    return updated;
  }

  async deleteEntity(entityId: NodeId): Promise<void> {
    const entity = await this.table.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    if (this.lifecycleHooks.beforeDelete) {
      await this.lifecycleHooks.beforeDelete(entity);
    }

    await this.cleanupEntityData(entity);
    await this.table.delete(entityId);

    if (this.lifecycleHooks.afterDelete) {
      await this.lifecycleHooks.afterDelete(entityId);
    }
  }

  async getEntity(entityId: NodeId): Promise<TEntity | null> {
    const entity = await this.table.get(entityId);
    return entity ?? null;
  }

  async getEntityByNodeId(nodeId: NodeId): Promise<TEntity | null> {
    const entity = await this.table.where('nodeId').equals(nodeId).first();
    return entity ?? null;
  }

  async listEntities(limit?: number, offset?: number): Promise<TEntity[]> {
    let query = this.table.orderBy('updatedAt').reverse();

    if (typeof offset === 'number') {
      query = query.offset(offset);
    }

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    return await query.toArray();
  }

  async getPaginatedEntities(
    page: number = 1,
    pageSize: number = 20,
    orderBy: string = 'updatedAt',
  ): Promise<PaginatedResult<TEntity>> {
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
  }

  async searchEntities(criteria: TSearchCriteria): Promise<TEntity[]> {
    let query: Collection<TEntity, IndexableType, TEntity> = this.table.toCollection();

    if (criteria.name) {
      const needle = criteria.name.toLowerCase();
      query = query.filter(entity =>
        (entity as any).name?.toLowerCase().includes(needle),
      );
    }

    if (criteria.createdAfter) {
      query = query.filter(entity => (entity.createdAt ?? 0) >= criteria.createdAfter!);
    }

    if (criteria.createdBefore) {
      query = query.filter(entity => (entity.createdAt ?? 0) <= criteria.createdBefore!);
    }

    if (criteria.updatedAfter) {
      query = query.filter(entity => (entity.updatedAt ?? 0) >= criteria.updatedAfter!);
    }

    if (criteria.updatedBefore) {
      query = query.filter(entity => (entity.updatedAt ?? 0) <= criteria.updatedBefore!);
    }

    query = this.applyAdditionalSearchCriteria(query, criteria);

    return await query.toArray();
  }

  async entityExists(entityId: NodeId): Promise<boolean> {
    const count = await this.table.where('id').equals(entityId).count();
    return count > 0;
  }

  async countEntities(criteria?: TSearchCriteria): Promise<number> {
    if (!criteria) {
      return await this.table.count();
    }
    const matches = await this.searchEntities(criteria);
    return matches.length;
  }

  async batchCreateEntities(
    items: Array<{ nodeId: NodeId; data: TCreateData }>,
  ): Promise<TEntity[]> {
    const entities: TEntity[] = items.map(item => {
      const entityId = crypto.randomUUID() as unknown as NodeId;
      return this.buildEntity(item.nodeId, entityId, item.data);
    });

    await this.table.bulkAdd(entities);
    return entities;
  }

  async batchUpdateEntities(
    updates: Array<{ entityId: NodeId; updates: Partial<TEntity> }>,
  ): Promise<OperationResult<TEntity[]>> {
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
  }

  async batchDeleteEntities(entityIds: NodeId[]): Promise<OperationResult> {
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
  }

  protected abstract buildEntity(nodeId: NodeId, entityId: NodeId, data: TCreateData): TEntity;

  protected async cleanupEntityData(_entity: TEntity): Promise<void> {
    // noop by default
  }

  protected applyAdditionalSearchCriteria(
    query: Collection<TEntity, IndexableType, TEntity>,
    _criteria: TSearchCriteria,
  ): Collection<TEntity, IndexableType, TEntity> {
    return query;
  }
}
