/**
 * @file BaseEntityHandler.ts
 * @description Abstract base class for entity handlers
 * Provides common functionality for all entity handlers
 */

import type {
  PeerEntity,
  GroupEntity,
  RelationalEntity,
  WorkingCopyProperties,
  EntityBackup,
  NodeId,
} from '@hierarchidb/00-core';
import type Dexie from 'dexie';
import { workerLog } from '../utils/workerLogger';

/**
 * Abstract base implementation for entity handlers
 * Provides common database operations and patterns
 */
export abstract class BaseEntityHandler<
  TEntity extends PeerEntity | GroupEntity | RelationalEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
>
{
  /**
   * Database instance
   */
  protected db: Dexie;

  /**
   * Table name for entities
   */
  protected tableName: string;

  /**
   * Table name for working copies
   */
  protected workingCopyTableName: string;

  /**
   * Table name for sub-entities
   */
  protected groupEntityTableName?: string;

  /**
   * Constructor
   * @param db Dexie database instance
   * @param tableName Main entity table name
   * @param workingCopyTableName Working copy table name
   * @param groupEntityTableName Optional sub-entity table name
   */
  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    groupEntityTableName?: string
  ) {
    this.db = db;
    this.tableName = tableName;
    this.workingCopyTableName = workingCopyTableName;
    this.groupEntityTableName = groupEntityTableName;
  }

  // ==================
  // Abstract methods - must be implemented by subclasses
  // ==================

  /**
   * Create a new entity
   */
  abstract createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;

  /**
   * Get an entity by node ID
   */
  abstract getEntity(nodeId: NodeId): Promise<TEntity | undefined>;

  /**
   * Update an entity
   */
  abstract updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;

  /**
   * Delete an entity
   */
  abstract deleteEntity(nodeId: NodeId): Promise<void>;

  // ==================
  // Working copy operations - can be overridden
  // ==================

  /**
   * Create a working copy of an entity
   */
  async createWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    const workingCopy = {
      ...entity,
      workingCopyId: this.generateNodeId(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    } as unknown as TWorkingCopy;

    await this.db.table(this.workingCopyTableName).add(workingCopy);
    return workingCopy;
  }

  /**
   * Commit a working copy back to the entity
   */
  async commitWorkingCopy(nodeId: NodeId, workingCopy: TWorkingCopy): Promise<void> {
    // Extract working copy specific fields
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy as any;

    // Update the entity
    await this.updateEntity(nodeId, entityData);

    // Delete the working copy
    await this.db.table(this.workingCopyTableName).delete(workingCopyId);
  }

  /**
   * Discard a working copy
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    try {
      const workingCopy = await this.db
        .table(this.workingCopyTableName)
        .where('workingCopyOf')
        .equals(nodeId)
        .first();

      if (workingCopy) {
        await this.db.table(this.workingCopyTableName).delete(workingCopy.workingCopyId);
      }
    } catch (error) {
      // Ignore if table doesn't exist
      this.log('Warning: working copy table not found', error);
    }
  }

  // ==================
  // Sub-entity operations - optional
  // ==================

  /**
   * Create a sub-entity
   */
  async createGroupEntity?(
    nodeId: NodeId,
    groupEntityType: string,
    data: TGroupEntity
  ): Promise<void> {
    if (!this.groupEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const groupEntity = {
      ...data,
      id: this.generateNodeId(),
      parentNodeId: nodeId,
      groupEntityType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.table(this.groupEntityTableName).add(groupEntity);
  }

  /**
   * Get sub-entities for a node
   */
  async getGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<TGroupEntity[]> {
    if (!this.groupEntityTableName) {
      return [];
    }

    return await this.db
      .table(this.groupEntityTableName)
      .where(['parentNodeId', 'groupEntityType'])
      .equals([nodeId, groupEntityType])
      .toArray();
  }

  /**
   * Delete sub-entities for a node
   */
  async deleteGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<void> {
    if (!this.groupEntityTableName) {
      return;
    }

    await this.db
      .table(this.groupEntityTableName)
      .where(['parentNodeId', 'groupEntityType'])
      .equals([nodeId, groupEntityType])
      .delete();
  }

  // ==================
  // Special operations - optional
  // ==================

  /**
   * Duplicate an entity
   */
  async duplicate?(nodeId: NodeId, newNodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    const newEntity = {
      ...entity,
      nodeId: newNodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await this.createEntity(newNodeId, newEntity);
  }

  /**
   * Create a backup of an entity
   */
  async backup?(nodeId: NodeId): Promise<EntityBackup<PeerEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    const groupEntities: Record<string, GroupEntity[]> = {};
    if (this.groupEntityTableName) {
      const allGroupEntities = await this.db
        .table(this.groupEntityTableName)
        .where('parentNodeId')
        .equals(nodeId)
        .toArray();

      // Group by type
      for (const groupEntity of allGroupEntities) {
        const type = (groupEntity as any).groupEntityType || 'default';
        if (!groupEntities[type]) {
          groupEntities[type] = [];
        }
        groupEntities[type].push(groupEntity);
      }
    }

    return {
      entity: entity as PeerEntity,
      subEntities: Object.keys(groupEntities).length > 0 ? groupEntities : undefined,
      metadata: {
        backupDate: Date.now(),
        version: '1.0.0',
        nodeType: (entity as any).nodeType || 'unknown',
      },
    };
  }

  /**
   * Restore an entity from backup
   */
  async restore?(nodeId: NodeId, backup: EntityBackup<PeerEntity>): Promise<void> {
    const { entity, subEntities } = backup;

    // Restore entity
    const existing = await this.getEntity(nodeId);
    if (existing) {
      await this.updateEntity(nodeId, entity as unknown as Partial<TEntity>);
    } else {
      await this.createEntity(nodeId, entity as unknown as Partial<TEntity>);
    }

    // Restore sub-entities if any
    if (subEntities && this.groupEntityTableName) {
      // Delete existing sub-entities
      await this.db.table(this.groupEntityTableName).where('parentNodeId').equals(nodeId).delete();

      // Add restored sub-entities
      for (const [type, entities] of Object.entries(subEntities)) {
        if (Array.isArray(entities)) {
          for (const groupEntity of entities) {
            await this.db.table(this.groupEntityTableName).add({
              ...groupEntity,
              parentNodeId: nodeId,
              groupEntityType: type,
            });
          }
        }
      }
    }
  }

  /**
   * Cleanup resources for an entity
   */
  async cleanup?(nodeId: NodeId): Promise<void> {
    try {
      // Discard working copies
      await this.discardWorkingCopy(nodeId);
    } catch (error) {
      // Ignore errors if table doesn't exist
      this.log('Cleanup warning: working copy table issue', error);
    }

    // Delete sub-entities
    if (this.groupEntityTableName) {
      try {
        await this.db.table(this.groupEntityTableName).where('parentNodeId').equals(nodeId).delete();
      } catch (error) {
        // Ignore errors if table doesn't exist
        this.log('Cleanup warning: sub-entity table issue', error);
      }
    }
  }

  // ==================
  // Helper methods
  // ==================

  /**
   * Generate a string v4
   */
  protected generateNodeId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get current timestamp
   */
  protected now(): number {
    return Date.now();
  }

  /**
   * Validate entity data
   */
  protected validateEntity(data: Partial<TEntity>): void {
    // Override in subclasses for specific validation
  }

  /**
   * Log in development mode
   */
  protected log(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      workerLog(`[${this.constructor.name}] ${message}`, data || '');
    }
  }
}
