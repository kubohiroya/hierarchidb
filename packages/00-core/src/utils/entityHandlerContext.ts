/**
 * @file entityHandlerContext.ts
 * @description Context interface for entity handlers - hides implementation details
 * Plugins receive pre-configured functions instead of knowing about helpers
 */

import type { NodeId } from '../types/ids';
import type { PeerEntity, GroupEntity } from '../types/nodeDefinition';
import type { WorkingCopyProperties } from '../types/workingCopy';

/**
 * Entity handler context - provides database operations as functions
 * This is injected into entity handlers without exposing implementation details
 */
export interface EntityHandlerContext<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties
> {
  /**
   * Store operations - these are injected functions, not methods
   * The plugin doesn't know HOW these work, just that they exist
   */
  store: {
    create: (entity: TEntity) => Promise<TEntity>;
    get: (nodeId: NodeId) => Promise<TEntity | undefined>;
    update: (nodeId: NodeId, data: Partial<TEntity>) => Promise<void>;
    delete: (nodeId: NodeId) => Promise<void>;
    exists: (nodeId: NodeId) => Promise<boolean>;
  };

  /**
   * Working copy operations
   */
  workingCopy: {
    create: (entity: TEntity) => Promise<TWorkingCopy>;
    get: (nodeId: NodeId) => Promise<TWorkingCopy | undefined>;
    commit: (workingCopy: TWorkingCopy) => Promise<void>;
    discard: (nodeId: NodeId) => Promise<void>;
  };

  /**
   * Group entity operations (optional)
   */
  groups?: {
    create: (nodeId: NodeId, group: TGroupEntity) => Promise<TGroupEntity>;
    getAll: (nodeId: NodeId) => Promise<TGroupEntity[]>;
    delete: (nodeId: NodeId, groupId: string) => Promise<void>;
    deleteAll: (nodeId: NodeId) => Promise<void>;
  };

  /**
   * Transaction support (optional)
   */
  transaction?: <T>(operation: () => Promise<T>) => Promise<T>;
}

/**
 * Utility functions for entity operations
 * These are pure functions that can be used by any entity handler
 */
export const entityUtils = {
  /**
   * Update version number
   */
  updateVersion<T extends { version: number }>(entity: T): T {
    return { ...entity, version: entity.version + 1 };
  },

  /**
   * Update timestamps
   */
  updateTimestamps<T>(entity: T, isCreate = false): T & { updatedAt: number; createdAt?: number } {
    const now = Date.now();
    return {
      ...entity,
      updatedAt: now,
      ...(isCreate && { createdAt: now })
    } as T & { updatedAt: number; createdAt?: number };
  },

  /**
   * Create a working copy from an entity
   */
  createWorkingCopyData<T extends { nodeId: NodeId; version: number }>(
    entity: T,
    workingCopyId?: string
  ): T & WorkingCopyProperties {
    return {
      ...entity,
      workingCopyId: workingCopyId || `wc-${entity.nodeId}-${Date.now()}`,
      workingCopyOf: entity.nodeId,
      copiedAt: Date.now(),
      isDirty: false,
      originalVersion: entity.version,
    };
  },

  /**
   * Extract entity data from working copy
   */
  extractEntityData<T extends WorkingCopyProperties>(
    workingCopy: T
  ): Omit<T, keyof WorkingCopyProperties> {
    const { 
      originalNodeId, 
      copiedAt, 
      hasEntityCopy,
      entityWorkingCopyId,
      originalVersion,
      hasGroupEntityCopy,
      ...entityData 
    } = workingCopy;
    return entityData as Omit<T, keyof WorkingCopyProperties>;
  },

  /**
   * Check if entity needs update
   */
  hasChanges<T>(original: T, updated: Partial<T>): boolean {
    return Object.keys(updated).some(key => {
      const k = key as keyof T;
      return original[k] !== updated[k];
    });
  },

  /**
   * Merge entity data safely
   */
  mergeEntityData<T extends { nodeId: NodeId }>(
    existing: T,
    updates: Partial<T>
  ): T {
    // nodeId should never be changed
    const { nodeId: _, ...safeUpdates } = updates;
    return {
      ...existing,
      ...safeUpdates,
      nodeId: existing.nodeId, // Preserve original nodeId
    };
  }
};