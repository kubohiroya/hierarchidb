/**
 * @file BaseEntityHandler.ts
 * @description Abstract base class for entity handlers
 * Provides common functionality for all entity handlers
 */

import type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityBackup,
  EntityHandler,
  TreeNodeId,
} from '@hierarchidb/core';
import type Dexie from 'dexie';
import { workerLog } from '../utils/workerLogger';

/**
 * Abstract base implementation for entity handlers
 * Provides common database operations and patterns
 */
export abstract class BaseEntityHandler<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> implements EntityHandler<TEntity, TSubEntity, TWorkingCopy>
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
  protected subEntityTableName?: string;

  /**
   * Constructor
   * @param db Dexie database instance
   * @param tableName Main entity table name
   * @param workingCopyTableName Working copy table name
   * @param subEntityTableName Optional sub-entity table name
   */
  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    subEntityTableName?: string
  ) {
    this.db = db;
    this.tableName = tableName;
    this.workingCopyTableName = workingCopyTableName;
    this.subEntityTableName = subEntityTableName;
  }

  // ==================
  // Abstract methods - must be implemented by subclasses
  // ==================

  /**
   * Create a new entity
   */
  abstract createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity>;

  /**
   * Get an entity by node ID
   */
  abstract getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined>;

  /**
   * Update an entity
   */
  abstract updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void>;

  /**
   * Delete an entity
   */
  abstract deleteEntity(nodeId: TreeNodeId): Promise<void>;

  // ==================
  // Working copy operations - can be overridden
  // ==================

  /**
   * Create a working copy of an entity
   */
  async createWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    const workingCopy = {
      ...entity,
      workingCopyId: this.generateUUID(),
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
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: TWorkingCopy): Promise<void> {
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
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
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
  async createSubEntity?(
    nodeId: TreeNodeId,
    subEntityType: string,
    data: TSubEntity
  ): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const subEntity = {
      ...data,
      id: this.generateUUID(),
      parentNodeId: nodeId,
      subEntityType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.table(this.subEntityTableName).add(subEntity);
  }

  /**
   * Get sub-entities for a node
   */
  async getSubEntities?(nodeId: TreeNodeId, subEntityType: string): Promise<TSubEntity[]> {
    if (!this.subEntityTableName) {
      return [];
    }

    return await this.db
      .table(this.subEntityTableName)
      .where(['parentNodeId', 'subEntityType'])
      .equals([nodeId, subEntityType])
      .toArray();
  }

  /**
   * Delete sub-entities for a node
   */
  async deleteSubEntities?(nodeId: TreeNodeId, subEntityType: string): Promise<void> {
    if (!this.subEntityTableName) {
      return;
    }

    await this.db
      .table(this.subEntityTableName)
      .where(['parentNodeId', 'subEntityType'])
      .equals([nodeId, subEntityType])
      .delete();
  }

  // ==================
  // Special operations - optional
  // ==================

  /**
   * Duplicate an entity
   */
  async duplicate?(nodeId: TreeNodeId, newNodeId: TreeNodeId): Promise<void> {
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
  async backup?(nodeId: TreeNodeId): Promise<EntityBackup<TEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    const subEntities: Record<string, BaseSubEntity[]> = {};
    if (this.subEntityTableName) {
      const allSubEntities = await this.db
        .table(this.subEntityTableName)
        .where('parentNodeId')
        .equals(nodeId)
        .toArray();

      // Group by type
      for (const subEntity of allSubEntities) {
        const type = (subEntity as any).subEntityType || 'default';
        if (!subEntities[type]) {
          subEntities[type] = [];
        }
        subEntities[type].push(subEntity);
      }
    }

    return {
      entity,
      subEntities: Object.keys(subEntities).length > 0 ? subEntities : undefined,
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
  async restore?(nodeId: TreeNodeId, backup: EntityBackup<TEntity>): Promise<void> {
    const { entity, subEntities } = backup;

    // Restore entity
    const existing = await this.getEntity(nodeId);
    if (existing) {
      await this.updateEntity(nodeId, entity);
    } else {
      await this.createEntity(nodeId, entity);
    }

    // Restore sub-entities if any
    if (subEntities && this.subEntityTableName) {
      // Delete existing sub-entities
      await this.db.table(this.subEntityTableName).where('parentNodeId').equals(nodeId).delete();

      // Add restored sub-entities
      for (const [type, entities] of Object.entries(subEntities)) {
        if (Array.isArray(entities)) {
          for (const subEntity of entities) {
            await this.db.table(this.subEntityTableName).add({
              ...subEntity,
              parentNodeId: nodeId,
              subEntityType: type,
            });
          }
        }
      }
    }
  }

  /**
   * Cleanup resources for an entity
   */
  async cleanup?(nodeId: TreeNodeId): Promise<void> {
    try {
      // Discard working copies
      await this.discardWorkingCopy(nodeId);
    } catch (error) {
      // Ignore errors if table doesn't exist
      this.log('Cleanup warning: working copy table issue', error);
    }

    // Delete sub-entities
    if (this.subEntityTableName) {
      try {
        await this.db.table(this.subEntityTableName).where('parentNodeId').equals(nodeId).delete();
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
   * Generate a UUID v4
   */
  protected generateUUID(): string {
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
