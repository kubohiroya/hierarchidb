/**
 * @file createEntityHandlerContext.ts
 * @description Factory to create EntityHandlerContext from database
 * This bridges the gap between plugins and database implementation
 */

import type { 
  EntityHandlerContext,
  NodeId,
  PeerEntity,
  GroupEntity,
  WorkingCopyProperties
} from '@hierarchidb/common-core';
import type { Dexie } from 'dexie';

/**
 * Create an EntityHandlerContext for a plugin
 * This encapsulates all database operations into simple functions
 */
export function createEntityHandlerContext<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties
>(
  db: Dexie,
  tableName: string,
  workingCopyTableName?: string,
  groupTableName?: string
): EntityHandlerContext<TEntity, TGroupEntity, TWorkingCopy> {
  
  const context: EntityHandlerContext<TEntity, TGroupEntity, TWorkingCopy> = {
    // ==================
    // Store operations
    // ==================
    store: {
      create: async (entity: TEntity): Promise<TEntity> => {
        await db.table(tableName).add(entity);
        return entity;
      },

      get: async (nodeId: NodeId): Promise<TEntity | undefined> => {
        return await db.table(tableName).get(nodeId);
      },

      update: async (nodeId: NodeId, data: Partial<TEntity>): Promise<void> => {
        const table = db.table(tableName);
        const existing = await table.get(nodeId);
        
        if (!existing) {
          throw new Error(`Entity not found: ${nodeId}`);
        }

        const updated = {
          ...existing,
          ...data,
          nodeId, // Preserve nodeId
          updatedAt: Date.now(),
          version: (existing.version || 0) + 1,
        };

        await table.put(updated);
      },

      delete: async (nodeId: NodeId): Promise<void> => {
        await db.table(tableName).delete(nodeId);
      },

      exists: async (nodeId: NodeId): Promise<boolean> => {
        const count = await db.table(tableName)
          .where('nodeId')
          .equals(nodeId)
          .count();
        return count > 0;
      },
    },

    // ==================
    // Working copy operations
    // ==================
    workingCopy: workingCopyTableName ? {
      create: async (entity: TEntity): Promise<TWorkingCopy> => {
        const workingCopy = {
          ...entity,
          workingCopyId: `wc-${entity.nodeId}-${Date.now()}`,
          workingCopyOf: entity.nodeId,
          copiedAt: Date.now(),
          isDirty: false,
          originalVersion: entity.version || 1,
        } as unknown as TWorkingCopy;

        await db.table(workingCopyTableName).add(workingCopy);
        return workingCopy;
      },

      get: async (nodeId: NodeId): Promise<TWorkingCopy | undefined> => {
        return await db.table(workingCopyTableName)
          .where('workingCopyOf')
          .equals(nodeId)
          .first();
      },

      commit: async (workingCopy: TWorkingCopy): Promise<void> => {
        const { 
          workingCopyId, 
          workingCopyOf, 
          copiedAt, 
          isDirty, 
          originalVersion,
          ...entityData 
        } = workingCopy as any;

        // Update main entity
        await context.store.update(workingCopyOf, entityData as Partial<TEntity>);

        // Delete working copy
        await db.table(workingCopyTableName).delete(workingCopyId);
      },

      discard: async (nodeId: NodeId): Promise<void> => {
        await db.table(workingCopyTableName)
          .where('workingCopyOf')
          .equals(nodeId)
          .delete();
      },
    } : {
      // Minimal implementation if no working copy table
      create: async (entity: TEntity): Promise<TWorkingCopy> => {
        throw new Error('Working copy not supported');
      },
      get: async (): Promise<TWorkingCopy | undefined> => undefined,
      commit: async (): Promise<void> => {},
      discard: async (): Promise<void> => {},
    },

    // ==================
    // Group operations (optional)
    // ==================
    groups: groupTableName ? {
      create: async (nodeId: NodeId, group: TGroupEntity): Promise<TGroupEntity> => {
        await db.table(groupTableName).add(group);
        return group;
      },

      getAll: async (nodeId: NodeId): Promise<TGroupEntity[]> => {
        return await db.table(groupTableName)
          .where('nodeId')
          .equals(nodeId)
          .toArray();
      },

      delete: async (nodeId: NodeId, groupId: string): Promise<void> => {
        await db.table(groupTableName)
          .where('groupId')
          .equals(groupId)
          .delete();
      },

      deleteAll: async (nodeId: NodeId): Promise<void> => {
        await db.table(groupTableName)
          .where('nodeId')
          .equals(nodeId)
          .delete();
      },
    } : undefined,

    // ==================
    // Transaction support
    // ==================
    transaction: async <T>(operation: () => Promise<T>): Promise<T> => {
      return await db.transaction('rw', db.tables, operation);
    },
  };

  return context;
}

/**
 * Register a plugin with context injection
 * This is called by the worker when loading plugins
 */
export function registerPluginWithContext<
  TEntity extends PeerEntity,
  TGroupEntity extends GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties
>(
  handler: any, // The entity handler instance
  db: Dexie,
  config: {
    entityTable: string;
    workingCopyTable?: string;
    groupTable?: string;
  }
): void {
  // Create context
  const context = createEntityHandlerContext<TEntity, TGroupEntity, TWorkingCopy>(
    db,
    config.entityTable,
    config.workingCopyTable,
    config.groupTable
  );

  // Inject context if handler supports it
  if (typeof handler.setContext === 'function') {
    handler.setContext(context);
  }
}