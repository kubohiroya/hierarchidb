/**
 * @file SimpleEntityHandler.ts
 * @description Concrete implementation of BaseEntityHandler for simple entities
 * Provides basic CRUD operations with Dexie integration
 */

import type { BaseEntity, BaseSubEntity, BaseWorkingCopy, TreeNodeId } from '@hierarchidb/core';
import Dexie from 'dexie';
import { workerWarn } from '../utils/workerLogger';
import { BaseEntityHandler } from './BaseEntityHandler';

/**
 * Simple entity for testing and basic usage
 */
export interface SimpleEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  value?: number; // For testing purposes
  data?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Simple sub-entity
 */
export interface SimpleSubEntity extends BaseSubEntity {
  id: string;
  parentNodeId: TreeNodeId;
  subEntityType: string;
  data: any;
  createdAt: number;
  updatedAt: number;
}

/**
 * Simple working copy
 */
export interface SimpleWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  value?: number; // For testing purposes
  data?: Record<string, any>;
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Simple implementation of entity handler
 * Provides complete CRUD operations with automatic timestamp and version management
 */
export class SimpleEntityHandler extends BaseEntityHandler<
  SimpleEntity,
  SimpleSubEntity,
  SimpleWorkingCopy
> {
  /**
   * Create a new entity
   */
  async createEntity(nodeId: TreeNodeId, data?: Partial<SimpleEntity>): Promise<SimpleEntity> {
    // Validate input data first (before applying defaults)
    if (data) {
      this.validateEntity(data);
    }

    const now = this.now();
    const entity: SimpleEntity = {
      nodeId,
      name: data?.name || 'New Entity',
      description: data?.description,
      data: data?.data || {},
      createdAt: data?.createdAt || now,
      updatedAt: data?.updatedAt || now,
      version: data?.version || 1,
    };

    // Store in database
    await this.db.table(this.tableName).add(entity);

    this.log('Entity created', { nodeId, name: entity.name });
    return entity;
  }

  /**
   * Get an entity by node ID
   */
  async getEntity(nodeId: TreeNodeId): Promise<SimpleEntity | undefined> {
    if (!nodeId) {
      throw new Error('nodeId is required');
    }

    const entity = await this.db.table(this.tableName).get(nodeId);
    return entity as SimpleEntity | undefined;
  }

  /**
   * Update an entity
   */
  async updateEntity(nodeId: TreeNodeId, data: Partial<SimpleEntity>): Promise<void> {
    if (!nodeId) {
      throw new Error('nodeId is required');
    }

    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    // Remove system fields that shouldn't be directly updated
    const { nodeId: _, createdAt, version, ...updateData } = data;

    // Update with new timestamp and incremented version
    const updates = {
      ...updateData,
      updatedAt: this.now(),
      version: (existing.version || 0) + 1,
    };

    // Validate before update
    this.validateEntity({ ...existing, ...updates });

    // Update in database
    await this.db.table(this.tableName).update(nodeId, updates);

    this.log('Entity updated', { nodeId, updates });
  }

  /**
   * Delete an entity
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    if (!nodeId) {
      throw new Error('nodeId is required');
    }

    // Check if entity exists
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      // Silent return if entity doesn't exist
      return;
    }

    // Delete from database
    await this.db.table(this.tableName).delete(nodeId);

    // Clean up related resources
    await this.cleanup?.(nodeId);

    this.log('Entity deleted', { nodeId });
  }

  /**
   * Batch create entities
   */
  async batchCreateEntities(
    entities: Array<{ nodeId: TreeNodeId; data?: Partial<SimpleEntity> }>
  ): Promise<SimpleEntity[]> {
    const now = this.now();
    const createdEntities: SimpleEntity[] = [];

    // Use transaction for batch operations
    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const { nodeId, data } of entities) {
        const entity: SimpleEntity = {
          nodeId,
          name: data?.name || 'New Entity',
          description: data?.description,
          data: data?.data || {},
          createdAt: data?.createdAt || now,
          updatedAt: data?.updatedAt || now,
          version: 1,
        };

        this.validateEntity(entity);
        await this.db.table(this.tableName).add(entity);
        createdEntities.push(entity);
      }
    });

    this.log('Batch entities created', { count: createdEntities.length });
    return createdEntities;
  }

  /**
   * Batch update entities
   */
  async batchUpdateEntities(
    updates: Array<{ nodeId: TreeNodeId; data: Partial<SimpleEntity> }>
  ): Promise<void> {
    const now = this.now();

    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const { nodeId, data } of updates) {
        const existing = await this.getEntity(nodeId);
        if (!existing) {
          workerWarn(`Entity not found for batch update: ${nodeId}`);
          continue;
        }

        const { nodeId: _, createdAt, version, ...updateData } = data;
        const updatePayload = {
          ...updateData,
          updatedAt: now,
          version: (existing.version || 0) + 1,
        };

        await this.db.table(this.tableName).update(nodeId, updatePayload);
      }
    });

    this.log('Batch entities updated', { count: updates.length });
  }

  /**
   * Batch delete entities
   */
  async batchDeleteEntities(nodeIds: TreeNodeId[]): Promise<void> {
    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const nodeId of nodeIds) {
        await this.db.table(this.tableName).delete(nodeId);
        await this.cleanup?.(nodeId);
      }
    });

    this.log('Batch entities deleted', { count: nodeIds.length });
  }

  /**
   * Query entities by criteria
   */
  async queryEntities(criteria: {
    name?: string;
    description?: string;
    createdAfter?: number;
    updatedAfter?: number;
  }): Promise<SimpleEntity[]> {
    let query = this.db.table(this.tableName).toCollection();

    if (criteria.name) {
      query = query.filter((entity) =>
        (entity as SimpleEntity).name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    }

    if (criteria.description) {
      query = query.filter((entity) => {
        const desc = (entity as SimpleEntity).description;
        return desc ? desc.toLowerCase().includes(criteria.description!.toLowerCase()) : false;
      });
    }

    if (criteria.createdAfter) {
      query = query.filter((entity) => (entity as SimpleEntity).createdAt > criteria.createdAfter!);
    }

    if (criteria.updatedAfter) {
      query = query.filter((entity) => (entity as SimpleEntity).updatedAt > criteria.updatedAfter!);
    }

    return (await query.toArray()) as SimpleEntity[];
  }

  /**
   * Get entity count
   */
  async getEntityCount(): Promise<number> {
    return await this.db.table(this.tableName).count();
  }

  /**
   * Check if entity exists
   */
  async entityExists(nodeId: TreeNodeId): Promise<boolean> {
    const entity = await this.getEntity(nodeId);
    return entity !== undefined;
  }

  /**
   * Validate entity data
   */
  protected validateEntity(data: Partial<SimpleEntity>): void {
    // Basic validation
    if (data.name !== undefined) {
      if (typeof data.name !== 'string') {
        throw new Error('Entity name must be a string');
      }
      if (data.name.trim().length === 0) {
        throw new Error('Entity name cannot be empty');
      }
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      throw new Error('Entity description must be a string');
    }

    if (data.version !== undefined && data.version < 1) {
      throw new Error('Entity version must be positive');
    }
  }

  /**
   * Get entities by parent (for hierarchical relationships)
   */
  async getEntitiesByParent(parentNodeId: TreeNodeId): Promise<SimpleEntity[]> {
    // This is a placeholder - actual implementation would depend on
    // how parent-child relationships are stored
    return [];
  }

  /**
   * Move entity to new parent
   */
  async moveEntity(nodeId: TreeNodeId, newParentId: TreeNodeId): Promise<void> {
    // This is a placeholder - actual implementation would depend on
    // how parent-child relationships are managed
    await this.updateEntity(nodeId, {
      data: { parentId: newParentId },
    });
  }
}
