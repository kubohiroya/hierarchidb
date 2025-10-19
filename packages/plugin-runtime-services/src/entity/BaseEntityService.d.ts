import type { Collection, IndexableType, Table } from 'dexie';
import type { BaseEntity, NodeId } from '@hierarchidb/common-types';
import type { BaseSearchCriteria, EntityLifecycleHooks, OperationResult, PaginatedResult } from '@hierarchidb/plugin-types';
/**
 * Lightweight runtime replacement for the legacy plugin-ui-sdk BaseEntityHandler.
 * Provides the CRUD/search primitives needed by in-repo plugins without
 * requiring plugin-ui-sdk (which only exposes runtime implementations via dist).
 */
export declare abstract class BaseEntityService<TEntity extends BaseEntity, TCreateData extends Partial<TEntity> = Partial<TEntity>, TSearchCriteria extends BaseSearchCriteria = BaseSearchCriteria> {
    protected abstract table: Table<TEntity, NodeId, TEntity>;
    protected lifecycleHooks: EntityLifecycleHooks<TEntity>;
    setLifecycleHooks(hooks: EntityLifecycleHooks<TEntity>): void;
    createEntity(nodeId: NodeId, data: TCreateData): Promise<TEntity>;
    updateEntity(entityId: NodeId, updates: Partial<TEntity>): Promise<TEntity>;
    deleteEntity(entityId: NodeId): Promise<void>;
    getEntity(entityId: NodeId): Promise<TEntity | null>;
    getEntityByNodeId(nodeId: NodeId): Promise<TEntity | null>;
    listEntities(limit?: number, offset?: number): Promise<TEntity[]>;
    getPaginatedEntities(page?: number, pageSize?: number, orderBy?: string): Promise<PaginatedResult<TEntity>>;
    searchEntities(criteria: TSearchCriteria): Promise<TEntity[]>;
    entityExists(entityId: NodeId): Promise<boolean>;
    countEntities(criteria?: TSearchCriteria): Promise<number>;
    batchCreateEntities(items: Array<{
        nodeId: NodeId;
        data: TCreateData;
    }>): Promise<TEntity[]>;
    batchUpdateEntities(updates: Array<{
        entityId: NodeId;
        updates: Partial<TEntity>;
    }>): Promise<OperationResult<TEntity[]>>;
    batchDeleteEntities(entityIds: NodeId[]): Promise<OperationResult>;
    protected abstract buildEntity(nodeId: NodeId, entityId: NodeId, data: TCreateData): TEntity;
    protected cleanupEntityData(_entity: TEntity): Promise<void>;
    protected applyAdditionalSearchCriteria(query: Collection<TEntity, IndexableType, TEntity>, _criteria: TSearchCriteria): Collection<TEntity, IndexableType, TEntity>;
}
//# sourceMappingURL=BaseEntityService.d.ts.map