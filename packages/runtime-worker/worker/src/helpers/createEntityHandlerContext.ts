/**
// EntityHandlerContext is defined locally
 * @file createEntityHandlerContext.ts
 * @description Factory to create EntityHandlerContext from database
 * This bridges the gap between plugins and database implementation
 */

import {
  GroupEntity,
  NodeId,
  PeerEntity,
  WorkingCopy,
  WorkingCopyProperties,
} from '@hierarchidb/common-type';
import type { Dexie } from 'dexie';

/**
 * Entity handler context interface
 */
interface EntityHandlerContext {
  store: {
    create: (entity: PeerEntity) => Promise<PeerEntity>;
    update: (nodeId: NodeId, updates: Partial<PeerEntity>) => Promise<void>;
    delete: (nodeId: NodeId) => Promise<void>;
    get: (nodeId: NodeId) => Promise<PeerEntity | null>;
    list: () => Promise<PeerEntity[]>;
  };
  workingCopy?: {
    create: (workingCopy: WorkingCopy) => Promise<WorkingCopy>;
    update: (nodeId: NodeId, updates: Partial<WorkingCopy>) => Promise<void>;
    delete: (nodeId: NodeId) => Promise<void>;
    get: (nodeId: NodeId) => Promise<WorkingCopy | null>;
    list: () => Promise<WorkingCopy[]>;
  };
  group?: {
    create: (groupEntity: GroupEntity) => Promise<GroupEntity>;
    update: (id: string, updates: Partial<GroupEntity>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    get: (id: string) => Promise<GroupEntity | null>;
    list: () => Promise<GroupEntity[]>;
  };
}

/**
 * Create an EntityHandlerContext for a plugin
 * This encapsulates all database operations into simple functions
 */
export function createEntityHandlerContext(
  db: Dexie,
  tableName: string,
  workingCopyTableName?: string,
  groupTableName?: string
): EntityHandlerContext {
  const context: EntityHandlerContext = {
    // ==================
    // Store operations
    // ==================
    store: {
      create: async (entity: PeerEntity): Promise<PeerEntity> => {
        await db.table(tableName).add(entity);
        return entity;
      },

      get: async (nodeId: NodeId): Promise<PeerEntity | undefined> => {
        return await db.table(tableName).get(nodeId);
      },

      update: async (nodeId: NodeId, data: Partial<PeerEntity>): Promise<void> => {
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

      list: async (): Promise<PeerEntity[]> => {
        return await db.table(tableName).toArray();
      },
    },

    // ==================
    // Working copy operations
    // ==================
    workingCopy: workingCopyTableName
      ? {
          create: async (workingCopy: WorkingCopy): Promise<WorkingCopy> => {
            // The workingCopy parameter is already a WorkingCopy type

            await db.table(workingCopyTableName).add(workingCopy);
            return workingCopy;
          },

          get: async (nodeId: NodeId): Promise<WorkingCopy | null> => {
            const wc = await db
              .table(workingCopyTableName)
              .where('nodeId')
              .equals(nodeId)
              .first();
            return wc || null;
          },

          update: async (nodeId: NodeId, updates: Partial<WorkingCopy>): Promise<void> => {
            await db.table(workingCopyTableName)
              .where('nodeId')
              .equals(nodeId)
              .modify(updates);
          },

          delete: async (nodeId: NodeId): Promise<void> => {
            await db.table(workingCopyTableName)
              .where('nodeId')
              .equals(nodeId)
              .delete();
          },

          list: async (): Promise<WorkingCopy[]> => {
            return await db.table(workingCopyTableName).toArray();
          },
        }
      : undefined,

    // ==================
    // Group operations (optional)
    // ==================
    groups: groupTableName
      ? {
          create: async (nodeId: NodeId, group: GroupEntity): Promise<GroupEntity> => {
            await db.table(groupTableName).add(group);
            return group;
          },

          getAll: async (nodeId: NodeId): Promise<GroupEntity[]> => {
            return await db.table(groupTableName).where('nodeId').equals(nodeId).toArray();
          },

          delete: async (nodeId: NodeId, groupId: string): Promise<void> => {
            await db.table(groupTableName).where('groupId').equals(groupId).delete();
          },

          deleteAll: async (nodeId: NodeId): Promise<void> => {
            await db.table(groupTableName).where('nodeId').equals(nodeId).delete();
          },
        }
      : undefined,

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
export function registerPluginWithContext(
  handler: any, // The entity handler instance
  db: Dexie,
  config: {
    entityTable: string;
    workingCopyTable?: string;
    groupTable?: string;
  }
): void {
  // Create context
  const context = createEntityHandlerContext(
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
