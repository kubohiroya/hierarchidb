// =============================================================================
// Plugin Definition Types (moved from worker package)
// =============================================================================

import type { RelationalEntity } from './entity-types.js';
import type { NodeId } from './id-types.js';

// =============================================================================
//  RelationalEntity
// =============================================================================

/**
  * RelationalEntity
  */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface RelationalEntityManager<TRelationalEntity extends RelationalEntity> {
  /**
            */
  addReference(entityId: string, nodeId: NodeId): Promise<void>;

  /**
      * 0
      */
  removeReference(entityId: string, nodeId: NodeId): Promise<void>;

  /**
      * undefined
      */
  getEntity(entityId: string): Promise<TRelationalEntity | undefined>;

  /**
      * =1
      */
  createEntity(
    nodeId: NodeId,
    data: Omit<TRelationalEntity, keyof RelationalEntity>,
  ): Promise<TRelationalEntity>;

  /**
            */
  getReferencedEntities(nodeId: NodeId): Promise<TRelationalEntity[]>;

  /**
      * =0
      */
  cleanupOrphanedEntities(): Promise<number>;
}
