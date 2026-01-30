import type { NodeId } from '@hierarchidb/core-types';

/**
 * Entity handler lifecycle hooks
 */
export interface EntityLifecycleHooks<TEntity> {
  beforeCreate?: (data: Partial<TEntity>) => Promise<void>;
  afterCreate?: (entity: TEntity) => Promise<void>;
  beforeUpdate?: (entity: TEntity, updates: Partial<TEntity>) => Promise<void>;
  afterUpdate?: (entity: TEntity) => Promise<void>;
  beforeDelete?: (entity: TEntity) => Promise<void>;
  afterDelete?: (entityId: NodeId) => Promise<void>;
}
