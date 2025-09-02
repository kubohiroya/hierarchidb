/**
import type { NodeId, PeerEntity, WorkingCopyProperties, EntityMetadata } from '@hierarchidb/common-type';
 * @file WorkingCopyManager.ts
 * @description Service for managing working copies with manual commit/discard
 */

import {
  EntityMetadata,
  generateNodeId,
  NodeId,
  PeerEntity,
  WorkingCopy,
} from '@hierarchidb/common-type';
import type Dexie from 'dexie';

/**
 * Service for managing working copies
 */
export class WorkingCopyEntityService {
  constructor(private database: Dexie) {}

  /**
   * Create working copy from existing entity
   */
  async create<T extends PeerEntity>(
    nodeId: NodeId,
    entityMeta: EntityMetadata
  ): Promise<T & WorkingCopy> {
    // Validate working copy config
    if (!entityMeta.workingCopyConfig?.enabled) {
      throw new Error('Working copy not enabled for this entity');
    }

    const originalEntity = await this.getEntity(nodeId, entityMeta);
    if (!originalEntity) {
      throw new Error(`Original entity not found: ${nodeId}`);
    }

    // Create working copy
    const workingCopy: T & WorkingCopy = {
      ...originalEntity,
      workingCopyId: generateNodeId(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };

    // Store working copy
    const workingCopyTable = entityMeta.workingCopyConfig.tableName;
    await this.database.table(workingCopyTable).add(workingCopy);

    return workingCopy;
  }

  async getEntity(nodeId: NodeId, entityMeta: EntityMetadata) {
    if (entityMeta.relationship.type === 'one-to-one') {
      return this.database.table(entityMeta.tableName).get(nodeId);
    } else {
      // For one-to-many relationships, get the first entity with matching foreign key
      return this.database
        .table(entityMeta.tableName)
        .where(entityMeta.relationship.foreignKeyField)
        .equals(nodeId)
        .first();
    }
  }

  /**
   * Commit working copy changes to main entity
   */
  async commit(workingCopyNodeId: NodeId, entityMeta: EntityMetadata): Promise<void> {
    const workingCopy = await this.getEntity(workingCopyNodeId, entityMeta);
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
  async discard(workingCopyNodeId: NodeId, entityMeta: EntityMetadata): Promise<void> {
    const workingCopy = await this.getEntity(workingCopyNodeId, entityMeta);
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
