/**
 * @file BaseEntityHandler.ts
 * @description Base entity handler class for all HierarchiDB plugin-loader
 */
import type { Collection, IndexableType, Table } from 'dexie';
import type { BaseEntity, NodeId } from '@hierarchidb/common-types';
import { EntityLifecycleHooks } from '~/types/entityLifecycleHooks.js';
import { OperationResult } from '~/types/operationResult.js';
import { PaginatedResult } from '~/types/paginatedResult.js';
import { BaseSearchCriteria } from '~/types/baseSearchCriteria.js';
/**
 * Abstract base class for entity handlers
 * Provides common CRUD operations for all plugin entities
 */
export declare abstract class BaseEntityHandler<TEntity extends BaseEntity, TCreateData extends Partial<TEntity> = Partial<TEntity>, TSearchCriteria extends BaseSearchCriteria = BaseSearchCriteria> {
    protected abstract table: Table<TEntity, NodeId, TEntity>;
    protected lifecycleHooks: EntityLifecycleHooks<TEntity>;
    /**
     * Set lifecycle hooks for entity operations
     */
    setLifecycleHooks(hooks: EntityLifecycleHooks<TEntity>): void;
    /**
     * Create a new entity
     */
    createEntity(nodeId: NodeId, data: TCreateData): Promise<TEntity>;
    /**
     * Update an existing entity
     */
    updateEntity(entityId: NodeId, updates: Partial<TEntity>): Promise<TEntity>;
    /**
     * Delete an entity
     */
    deleteEntity(entityId: NodeId): Promise<void>;
    /**
     * Get entity by ID
     */
    getEntity(entityId: NodeId): Promise<TEntity | null>;
    /**
     * Get entity by node ID
     */
    getEntityByNodeId(nodeId: NodeId): Promise<TEntity | null>;
    /**
     * List all entities with optional pagination
     */
    listEntities(limit?: number, offset?: number): Promise<TEntity[]>;
    /**
     * Get paginated entities
     */
    getPaginatedEntities(page?: number, pageSize?: number, orderBy?: string): Promise<PaginatedResult<TEntity>>;
    /**
     * Search entities by criteria
     */
    searchEntities(criteria: TSearchCriteria): Promise<TEntity[]>;
    /**
     * Check if entity exists
     */
    entityExists(entityId: NodeId): Promise<boolean>;
    /**
     * Count entities
     */
    countEntities(criteria?: TSearchCriteria): Promise<number>;
    /**
     * Batch create entities
     */
    batchCreateEntities(items: Array<{
        nodeId: NodeId;
        data: TCreateData;
    }>): Promise<TEntity[]>;
    /**
     * Batch update entities
     */
    batchUpdateEntities(updates: Array<{
        entityId: NodeId;
        updates: Partial<TEntity>;
    }>): Promise<OperationResult<TEntity[]>>;
    /**
     * Batch delete entities
     */
    batchDeleteEntities(entityIds: NodeId[]): Promise<OperationResult>;
    /**
     * Abstract method to build entity from data
     * Must be implemented by derived classes
     */
    protected abstract buildEntity(_nodeId: NodeId, _entityId: NodeId, _data: TCreateData): TEntity;
    /**
     * Optional method to cleanup related data when entity is deleted
     * Can be overridden by derived classes
     */
    protected cleanupEntityData(_entity: TEntity): Promise<void>;
    /**
     * Optional method to apply additional search criteria
     * Can be overridden by derived classes
     */
    protected applyAdditionalSearchCriteria(query: Collection<TEntity, IndexableType, TEntity>, _criteria: TSearchCriteria): Collection<TEntity, any, TEntity>;
}
//# sourceMappingURL=BaseEntityHandler.d.ts.map