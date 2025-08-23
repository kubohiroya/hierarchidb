/**
 * @file WorkingCopyManager.ts
 * @description Service for managing working copies with manual commit/discard
 */

import type { NodeId, PeerEntity, WorkingCopyProperties } from '@hierarchidb/00-core';
import type { EntityMetadata } from '@hierarchidb/00-core';
import type Dexie from 'dexie';

/**
 * Working copy session for managing multiple working copies
 */
export class WorkingCopySession {
  private workingCopies = new Map<string, any>();

  constructor(public readonly nodeId: NodeId) {}

  /**
   * Add working copy to session
   */
  addWorkingCopy(tableName: string, workingCopy: any): void {
    this.workingCopies.set(tableName, workingCopy);
  }

  /**
   * Get working copy by table name
   */
  getWorkingCopy(tableName: string): any {
    return this.workingCopies.get(tableName);
  }

  /**
   * Get all table names in session
   */
  getTableNames(): string[] {
    return Array.from(this.workingCopies.keys());
  }

  /**
   * Get primary working copy (first one added)
   */
  getPrimaryWorkingCopy(): any {
    const firstStore = this.getTableNames()[0];
    return firstStore ? this.workingCopies.get(firstStore) : undefined;
  }

  /**
   * Clear all working copies
   */
  clear(): void {
    this.workingCopies.clear();
  }

  /**
   * Create session from existing working copy
   */
  static fromWorkingCopy(
    nodeId: NodeId,
    tableName: string,
    workingCopy: any
  ): WorkingCopySession {
    const session = new WorkingCopySession(nodeId);
    session.addWorkingCopy(tableName, workingCopy);
    return session;
  }
}

/**
 * Service for managing working copies
 */
export class WorkingCopyManager {
  constructor(private database: Dexie) {}

  /**
   * Create working copy from existing entity
   */
  async create<T extends PeerEntity>(
    nodeId: NodeId,
    entityMeta: EntityMetadata
  ): Promise<T & WorkingCopyProperties> {
    // Validate working copy config
    if (!entityMeta.workingCopyConfig?.enabled) {
      throw new Error('Working copy not enabled for this entity');
    }

    // Get original entity
    let originalEntity: T;
    
    if (entityMeta.relationship.type === 'one-to-one') {
      originalEntity = await this.database
        .table(entityMeta.tableName)
        .get(nodeId) as T;
    } else {
      // For one-to-many relationships, get the first entity with matching foreign key
      originalEntity = await this.database
        .table(entityMeta.tableName)
        .where(entityMeta.relationship.foreignKeyField)
        .equals(nodeId)
        .first() as T;
    }

    if (!originalEntity) {
      throw new Error(`Original entity not found: ${nodeId}`);
    }

    // Create working copy
    const workingCopy: T & WorkingCopyProperties = {
      ...originalEntity,
      workingCopyId: crypto.randomUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };

    // Store working copy
    const workingCopyTable = entityMeta.workingCopyConfig.tableName;
    await this.database.table(workingCopyTable).add(workingCopy);

    return workingCopy;
  }

  /**
   * Commit working copy changes to main entity
   */
  async commit(
    session: WorkingCopySession,
    entityMeta: EntityMetadata
  ): Promise<void> {
    const workingCopy = session.getWorkingCopy(entityMeta.tableName);
    if (!workingCopy) return;

    // Remove working copy properties
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;

    // Update main entity
    await this.database.table(entityMeta.tableName).put({
      ...entityData,
      updatedAt: Date.now(),
    });

    // Delete working copy
    if (entityMeta.workingCopyConfig?.enabled) {
      const workingCopyTable = entityMeta.workingCopyConfig.tableName;
      await this.database.table(workingCopyTable).delete(workingCopyId);
    }
  }

  /**
   * Discard working copy without saving changes
   */
  async discard(
    session: WorkingCopySession,
    entityMeta: EntityMetadata
  ): Promise<void> {
    const workingCopy = session.getWorkingCopy(entityMeta.tableName);
    if (!workingCopy) return;

    // Delete working copy
    if (entityMeta.workingCopyConfig?.enabled) {
      const workingCopyTable = entityMeta.workingCopyConfig.tableName;
      await this.database.table(workingCopyTable).delete(workingCopy.workingCopyId);
    }
  }

  /**
   * Update reference count for relational entities
   */
  async updateRelationalReference(
    resourceId: string,
    nodeId: NodeId,
    operation: 'add' | 'remove',
    entityMeta: EntityMetadata
  ): Promise<void> {
    if (!entityMeta.referenceManagement) return;

    const { countField, nodeListField, autoDeleteWhenZero } = entityMeta.referenceManagement;
    const table = this.database.table(entityMeta.tableName);
    
    const resource = await table.get(resourceId);
    if (!resource) return;

    if (operation === 'add') {
      // Add reference
      resource[countField] = (resource[countField] || 0) + 1;
      const nodeList = resource[nodeListField] || [];
      if (!nodeList.includes(nodeId)) {
        nodeList.push(nodeId);
      }
      resource[nodeListField] = nodeList;
      await table.put(resource);
    } else {
      // Remove reference
      resource[countField] = Math.max(0, (resource[countField] || 0) - 1);
      const nodeList = resource[nodeListField] || [];
      const index = nodeList.indexOf(nodeId);
      if (index > -1) {
        nodeList.splice(index, 1);
      }
      resource[nodeListField] = nodeList;

      if (resource[countField] === 0 && autoDeleteWhenZero) {
        // Auto-delete when reference count reaches zero
        await table.delete(resourceId);
      } else {
        await table.put(resource);
      }
    }
  }
}