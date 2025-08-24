/**
 * @file PeerEntityImplHandler.ts
 * @description Concrete implementation of BaseEntityHandler for simple entities
 * Provides basic CRUD operations with Dexie integration
 */

import type { PeerEntity, GroupEntity, WorkingCopyProperties, NodeId, EntityId } from '@hierarchidb/common-core';
import { generateNodeId } from '@hierarchidb/common-core';
import Dexie from 'dexie';
import { workerWarn } from '../utils/workerLogger';
import { BaseEntityHandler } from './BaseEntityHandler';

// Helper function to generate EntityId
const generateEntityId = (): EntityId => {
  return crypto.randomUUID() as EntityId;
};

/**
 * Simple entity for testing and basic usage
 */
export interface PeerEntityImpl extends PeerEntity {
  name: string;
  description?: string;
  value?: number; // For testing purposes
  data?: Record<string, any>;
  // Inherited from BaseEntity: id, createdAt, updatedAt, version
  // Inherited from PeerEntity: nodeId (not referencingNodeId)
}

/**
 * Simple sub-entity
 */
export interface GroupEntityImpl extends GroupEntity {
  parentNodeId: NodeId;
  groupEntityType: string;
  data: any;
  createdAt: number;
  updatedAt: number;
}

/**
 * Simple working copy
 */
export type PeerWorkingCopy = PeerEntityImpl & WorkingCopyProperties;

/**
 * Simple implementation of entity handler
 * Provides complete CRUD operations with automatic timestamp and version management
 */
export class PeerEntityHandler extends BaseEntityHandler<
  PeerEntityImpl,
  GroupEntityImpl,
  PeerWorkingCopy
> {
  /**
   * Create a new entity
   */
  async createEntity(nodeId: NodeId, data?: Partial<PeerEntityImpl>): Promise<PeerEntityImpl> {
    // Validate input data first (before applying defaults)
    if (data) {
      this.validateEntity(data);
    }

    const now = this.now();
    const entity: PeerEntityImpl = {
      // PeerEntity properties
      id: generateEntityId(),
      nodeId: nodeId,
      
      // PeerEntityImpl specific properties
      name: data?.name || 'New Entity',
      description: data?.description,
      data: data?.data || {},
      
      // BaseEntity properties
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
  async getEntity(nodeId: NodeId): Promise<PeerEntityImpl | undefined> {
    if (!nodeId) {
      throw new Error('nodeId is required');
    }

    const entity = await this.db.table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      .first();
    return entity as PeerEntityImpl | undefined;
  }

  /**
   * Update an entity
   */
  async updateEntity(nodeId: NodeId, data: Partial<PeerEntityImpl>): Promise<void> {
    if (!nodeId) {
      throw new Error('nodeId is required');
    }

    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    // Remove system fields that shouldn't be directly updated
    const { id: _, nodeId: __, createdAt, version, ...updateData } = data;

    // Update with new timestamp and incremented version
    const updates = {
      ...updateData,
      updatedAt: this.now(),
      version: (existing.version || 0) + 1,
    };

    // Validate before update
    this.validateEntity({ ...existing, ...updates });

    // Update in database
    await this.db.table(this.tableName).update(existing.id, updates);

    this.log('Entity updated', { nodeId, updates });
  }

  /**
   * Delete an entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
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
    await this.db.table(this.tableName).delete(existing.id);

    // Clean up related resources
    await this.cleanup?.(nodeId);

    this.log('Entity deleted', { nodeId });
  }

  /**
   * Batch create entities
   */
  async batchCreateEntities(
    entities: Array<{ nodeId: NodeId; data?: Partial<PeerEntityImpl> }>
  ): Promise<PeerEntityImpl[]> {
    const now = this.now();
    const createdEntities: PeerEntityImpl[] = [];

    // Use transaction for batch operations
    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const { nodeId, data } of entities) {
        const entity: PeerEntityImpl = {
          // PeerEntity properties
          id: generateEntityId(),
          nodeId: nodeId,
          
          // PeerEntityImpl specific properties
          name: data?.name || 'New Entity',
          description: data?.description,
          data: data?.data || {},
          
          // BaseEntity properties
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
    updates: Array<{ nodeId: NodeId; data: Partial<PeerEntityImpl> }>
  ): Promise<void> {
    const now = this.now();

    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const { nodeId, data } of updates) {
        const existing = await this.getEntity(nodeId);
        if (!existing) {
          workerWarn(`Entity not found for batch update: ${nodeId}`);
          continue;
        }

        const { id: _, nodeId: __, createdAt, version, ...updateData } = data;
        const updatePayload = {
          ...updateData,
          updatedAt: now,
          version: (existing.version || 0) + 1,
        };

        await this.db.table(this.tableName).update(existing.id, updatePayload);
      }
    });

    this.log('Batch entities updated', { count: updates.length });
  }

  /**
   * Batch delete entities
   */
  async batchDeleteEntities(nodeIds: NodeId[]): Promise<void> {
    await this.db.transaction('rw', this.db.table(this.tableName), async () => {
      for (const nodeId of nodeIds) {
        const entity = await this.getEntity(nodeId);
        if (entity) {
          await this.db.table(this.tableName).delete(entity.id);
          await this.cleanup?.(nodeId);
        }
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
  }): Promise<PeerEntityImpl[]> {
    let query = this.db.table(this.tableName).toCollection();

    if (criteria.name) {
      query = query.filter((entity) =>
        (entity as PeerEntityImpl).name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    }

    if (criteria.description) {
      query = query.filter((entity) => {
        const desc = (entity as PeerEntityImpl).description;
        return desc ? desc.toLowerCase().includes(criteria.description!.toLowerCase()) : false;
      });
    }

    if (criteria.createdAfter) {
      query = query.filter((entity) => (entity as PeerEntityImpl).createdAt > criteria.createdAfter!);
    }

    if (criteria.updatedAfter) {
      query = query.filter((entity) => (entity as PeerEntityImpl).updatedAt > criteria.updatedAfter!);
    }

    return (await query.toArray()) as PeerEntityImpl[];
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
  async entityExists(nodeId: NodeId): Promise<boolean> {
    const entity = await this.getEntity(nodeId);
    return entity !== undefined;
  }

  /**
   * Validate entity data
   */
  protected validateEntity(data: Partial<PeerEntityImpl>): void {
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
  async getEntitiesByParent(parentNodeId: NodeId): Promise<PeerEntityImpl[]> {
    // This is a placeholder - actual implementation would depend on
    // how parent-child relationships are stored
    return [];
  }

  /**
   * Move entity to new parent
   */
  async moveEntity(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    // This is a placeholder - actual implementation would depend on
    // how parent-child relationships are managed
    await this.updateEntity(nodeId, {
      data: { parentId: newParentId },
    });
  }

}
