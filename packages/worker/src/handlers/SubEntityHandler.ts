/**
 * @file SubEntityHandler.ts
 * @description Advanced sub-entity operations handler
 * Provides comprehensive sub-entity management with type safety
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { BaseEntity, BaseSubEntity, BaseWorkingCopy } from '@hierarchidb/core';
import { SimpleEntityHandler } from './SimpleEntityHandler';
import type { SimpleEntity, SimpleSubEntity, SimpleWorkingCopy } from './SimpleEntityHandler';
import Dexie from 'dexie';

/**
 * Extended sub-entity with additional metadata
 */
export interface ExtendedSubEntity extends BaseSubEntity {
  id: string;
  parentNodeId: TreeNodeId;
  subEntityType: string;
  name?: string;
  data: any;
  metadata?: {
    tags?: string[];
    priority?: number;
    visible?: boolean;
  };
  relationships?: {
    relatedTo?: string[];
    dependsOn?: string[];
  };
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Sub-entity query options
 */
export interface SubEntityQueryOptions {
  type?: string;
  parentNodeId?: TreeNodeId;
  tags?: string[];
  priority?: number;
  visible?: boolean;
  createdAfter?: number;
  updatedAfter?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'priority' | 'name';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Sub-entity batch operation result
 */
export interface SubEntityBatchResult {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  total: number;
}

/**
 * Advanced handler for sub-entity operations
 * Extends SimpleEntityHandler with comprehensive sub-entity management
 */
export class SubEntityHandler extends SimpleEntityHandler {
  protected subEntityIndex: Map<string, Set<string>> = new Map(); // type -> Set<id>

  constructor(
    db: Dexie,
    tableName: string,
    workingCopyTableName: string,
    subEntityTableName: string
  ) {
    super(db, tableName, workingCopyTableName, subEntityTableName);
    this.initializeSubEntityIndex();
  }

  /**
   * Initialize sub-entity index for fast lookups
   */
  private async initializeSubEntityIndex(): Promise<void> {
    if (!this.subEntityTableName) return;

    try {
      const allSubEntities = await this.db.table(this.subEntityTableName).toArray();
      for (const subEntity of allSubEntities) {
        const type = (subEntity as any).subEntityType;
        if (!this.subEntityIndex.has(type)) {
          this.subEntityIndex.set(type, new Set());
        }
        this.subEntityIndex.get(type)!.add((subEntity as any).id);
      }
    } catch (error) {
      this.log('Sub-entity index initialization failed', error);
    }
  }

  /**
   * Create a sub-entity with validation
   */
  async createSubEntity(
    nodeId: TreeNodeId,
    subEntityType: string,
    data: ExtendedSubEntity
  ): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    // Validate input data first
    if (data) {
      this.validateSubEntity({ ...data, subEntityType, parentNodeId: nodeId });
    }

    // Validate parent entity exists
    const parentEntity = await this.getEntity(nodeId);
    if (!parentEntity) {
      throw new Error(`Parent entity not found: ${nodeId}`);
    }

    const now = this.now();
    const subEntity: ExtendedSubEntity = {
      id: data.id || this.generateUUID(),
      parentNodeId: nodeId,
      subEntityType,
      type: subEntityType, // Required by ExtendedSubEntity
      name: data.name,
      data: data.data || {},
      metadata: data.metadata || {},
      relationships: data.relationships || {},
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version || 1,
    };

    // Store in database
    await this.db.table(this.subEntityTableName).add(subEntity);

    // Update index
    if (!this.subEntityIndex.has(subEntityType)) {
      this.subEntityIndex.set(subEntityType, new Set());
    }
    this.subEntityIndex.get(subEntityType)!.add(subEntity.id);

    this.log('Sub-entity created', {
      id: subEntity.id,
      type: subEntityType,
      parent: nodeId,
    });
  }

  /**
   * Get sub-entities with filtering
   */
  async getSubEntities(nodeId: TreeNodeId, subEntityType?: string): Promise<ExtendedSubEntity[]> {
    if (!this.subEntityTableName) {
      return [];
    }

    let query = this.db.table(this.subEntityTableName).where('parentNodeId').equals(nodeId);

    const results = await query.toArray();

    // Filter by type if specified
    if (subEntityType) {
      return results.filter((se: any) => se.subEntityType === subEntityType);
    }

    return results as ExtendedSubEntity[];
  }

  /**
   * Get a specific sub-entity by ID
   */
  async getSubEntity(subEntityId: string): Promise<ExtendedSubEntity | undefined> {
    if (!this.subEntityTableName) {
      return undefined;
    }

    const subEntity = await this.db.table(this.subEntityTableName).get(subEntityId);
    return subEntity as ExtendedSubEntity | undefined;
  }

  /**
   * Update a sub-entity
   */
  async updateSubEntity(subEntityId: string, updates: Partial<ExtendedSubEntity>): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const existing = await this.getSubEntity(subEntityId);
    if (!existing) {
      throw new Error(`Sub-entity not found: ${subEntityId}`);
    }

    // Remove system fields
    const { id, parentNodeId, subEntityType, createdAt, version, ...updateData } = updates;

    const updatePayload = {
      ...updateData,
      updatedAt: this.now(),
      version: (existing.version || 0) + 1,
    };

    await this.db.table(this.subEntityTableName).update(subEntityId, updatePayload);

    this.log('Sub-entity updated', { id: subEntityId, updates: updatePayload });
  }

  /**
   * Delete specific sub-entities
   */
  async deleteSubEntity(subEntityId: string): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const existing = await this.getSubEntity(subEntityId);
    if (!existing) {
      return; // Silent return if not found
    }

    await this.db.table(this.subEntityTableName).delete(subEntityId);

    // Update index
    if (this.subEntityIndex.has(existing.subEntityType)) {
      this.subEntityIndex.get(existing.subEntityType)!.delete(subEntityId);
    }

    this.log('Sub-entity deleted', { id: subEntityId });
  }

  /**
   * Delete all sub-entities of a specific type for a node
   */
  async deleteSubEntitiesByType(nodeId: TreeNodeId, subEntityType: string): Promise<number> {
    if (!this.subEntityTableName) {
      return 0;
    }

    const toDelete = await this.getSubEntities(nodeId, subEntityType);

    for (const subEntity of toDelete) {
      await this.deleteSubEntity(subEntity.id);
    }

    return toDelete.length;
  }

  /**
   * Query sub-entities with advanced options
   */
  async querySubEntities(options: SubEntityQueryOptions): Promise<ExtendedSubEntity[]> {
    if (!this.subEntityTableName) {
      return [];
    }

    let query = this.db.table(this.subEntityTableName).toCollection();

    // Apply filters
    if (options.parentNodeId) {
      query = query.filter((se: any) => se.parentNodeId === options.parentNodeId);
    }

    if (options.type) {
      query = query.filter((se: any) => se.subEntityType === options.type);
    }

    if (options.tags && options.tags.length > 0) {
      query = query.filter((se: any) => {
        const seTags = se.metadata?.tags || [];
        return options.tags!.some((tag) => seTags.includes(tag));
      });
    }

    if (options.priority !== undefined) {
      query = query.filter((se: any) => se.metadata?.priority === options.priority);
    }

    if (options.visible !== undefined) {
      query = query.filter((se: any) => se.metadata?.visible === options.visible);
    }

    if (options.createdAfter) {
      query = query.filter((se: any) => se.createdAt > options.createdAfter!);
    }

    if (options.updatedAfter) {
      query = query.filter((se: any) => se.updatedAt > options.updatedAfter!);
    }

    let results = (await query.toArray()) as ExtendedSubEntity[];

    // Apply sorting
    if (options.orderBy) {
      results.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (options.orderBy) {
          case 'priority':
            aVal = a.metadata?.priority || 0;
            bVal = b.metadata?.priority || 0;
            break;
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
          default:
            if (options.orderBy) {
              aVal = (a as any)[options.orderBy];
              bVal = (b as any)[options.orderBy];
            }
        }

        if (options.orderDirection === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      results = results.slice(start, end);
    }

    return results;
  }

  /**
   * Batch create sub-entities
   */
  async batchCreateSubEntities(
    operations: Array<{
      nodeId: TreeNodeId;
      type: string;
      data: Partial<ExtendedSubEntity>;
    }>
  ): Promise<SubEntityBatchResult> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    const result: SubEntityBatchResult = {
      successful: [],
      failed: [],
      total: operations.length,
    };

    // Don't use transaction with nested createSubEntity calls
    // Process operations individually
    for (const op of operations) {
      try {
        await this.createSubEntity(op.nodeId, op.type, {
          ...op.data,
          id: op.data.id || this.generateUUID(),
          parentNodeId: op.nodeId,
          subEntityType: op.type,
          type: op.type,
          createdAt: op.data.createdAt || this.now(),
          updatedAt: op.data.updatedAt || this.now(),
          version: op.data.version || 1,
        } as ExtendedSubEntity);
        result.successful.push(op.data.id || 'generated');
      } catch (error: any) {
        result.failed.push({
          id: op.data.id || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Move sub-entities to a different parent
   */
  async moveSubEntities(subEntityIds: string[], newParentNodeId: TreeNodeId): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity table not configured');
    }

    // Validate new parent exists
    const newParent = await this.getEntity(newParentNodeId);
    if (!newParent) {
      throw new Error(`New parent entity not found: ${newParentNodeId}`);
    }

    await this.db.transaction('rw', this.db.table(this.subEntityTableName), async () => {
      for (const id of subEntityIds) {
        if (!this.subEntityTableName) {
          continue;
        }
        await this.db.table(this.subEntityTableName).update(id, {
          parentNodeId: newParentNodeId,
          updatedAt: this.now(),
        });
      }
    });

    this.log('Sub-entities moved', {
      count: subEntityIds.length,
      newParent: newParentNodeId,
    });
  }

  /**
   * Copy sub-entities to another parent
   */
  async copySubEntities(
    sourceNodeId: TreeNodeId,
    targetNodeId: TreeNodeId,
    subEntityType?: string
  ): Promise<ExtendedSubEntity[]> {
    const sourceSubEntities = await this.getSubEntities(sourceNodeId, subEntityType);
    const copiedEntities: ExtendedSubEntity[] = [];

    for (const subEntity of sourceSubEntities) {
      const { id, parentNodeId, createdAt, updatedAt, version, ...copyData } = subEntity;

      const newSubEntity: ExtendedSubEntity = {
        ...copyData,
        id: this.generateUUID(),
        parentNodeId: targetNodeId,
        name: subEntity.name ? `${subEntity.name} (Copy)` : undefined,
        subEntityType: subEntity.subEntityType,
        type: subEntity.type,
        createdAt: this.now(),
        updatedAt: this.now(),
        version: 1,
      };

      await this.createSubEntity(targetNodeId, subEntity.subEntityType, newSubEntity);
      copiedEntities.push(newSubEntity);
    }

    return copiedEntities;
  }

  /**
   * Get sub-entity count
   */
  async getSubEntityCount(nodeId?: TreeNodeId, subEntityType?: string): Promise<number> {
    if (!this.subEntityTableName) {
      return 0;
    }

    if (nodeId) {
      const subEntities = await this.getSubEntities(nodeId, subEntityType);
      return subEntities.length;
    }

    if (subEntityType && this.subEntityIndex.has(subEntityType)) {
      return this.subEntityIndex.get(subEntityType)!.size;
    }

    return await this.db.table(this.subEntityTableName).count();
  }

  /**
   * Get sub-entity types for a node
   */
  async getSubEntityTypes(nodeId: TreeNodeId): Promise<string[]> {
    const subEntities = await this.getSubEntities(nodeId);
    const types = new Set(subEntities.map((se) => se.subEntityType));
    return Array.from(types);
  }

  /**
   * Validate sub-entity relationships
   */
  async validateSubEntityRelationships(subEntityId: string): Promise<boolean> {
    const subEntity = await this.getSubEntity(subEntityId);
    if (!subEntity) {
      return false;
    }

    // Check if related entities exist
    if (subEntity.relationships?.relatedTo) {
      for (const relatedId of subEntity.relationships.relatedTo) {
        const related = await this.getSubEntity(relatedId);
        if (!related) {
          return false;
        }
      }
    }

    // Check dependencies
    if (subEntity.relationships?.dependsOn) {
      for (const depId of subEntity.relationships.dependsOn) {
        const dependency = await this.getSubEntity(depId);
        if (!dependency) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate sub-entity data
   */
  private validateSubEntity(data: Partial<ExtendedSubEntity>): void {
    if (!data.subEntityType) {
      throw new Error('Sub-entity type is required');
    }

    if (!data.parentNodeId) {
      throw new Error('Parent node ID is required');
    }

    if (data.name !== undefined && typeof data.name !== 'string') {
      throw new Error('Sub-entity name must be a string');
    }

    if (data.metadata?.priority !== undefined) {
      if (typeof data.metadata.priority !== 'number' || data.metadata.priority < 0) {
        throw new Error('Priority must be a non-negative number');
      }
    }

    if (data.version !== undefined && data.version < 1) {
      throw new Error('Version must be positive');
    }
  }

  /**
   * Get sub-entities with parent entity data
   */
  async getSubEntitiesWithParent(
    nodeId: TreeNodeId,
    subEntityType?: string
  ): Promise<Array<ExtendedSubEntity & { parent: SimpleEntity }>> {
    const parent = await this.getEntity(nodeId);
    if (!parent) {
      return [];
    }

    const subEntities = await this.getSubEntities(nodeId, subEntityType);
    return subEntities.map((se) => ({
      ...se,
      parent,
    }));
  }

  /**
   * Export sub-entities to JSON
   */
  async exportSubEntities(nodeId: TreeNodeId, subEntityType?: string): Promise<string> {
    const subEntities = await this.getSubEntities(nodeId, subEntityType);
    // Sort by creation time to ensure consistent order
    subEntities.sort((a, b) => a.createdAt - b.createdAt);
    return JSON.stringify(subEntities, null, 2);
  }

  /**
   * Import sub-entities from JSON
   */
  async importSubEntities(nodeId: TreeNodeId, jsonData: string): Promise<SubEntityBatchResult> {
    let subEntities: Partial<ExtendedSubEntity>[];

    try {
      subEntities = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid JSON data');
    }

    if (!Array.isArray(subEntities)) {
      throw new Error('JSON data must be an array of sub-entities');
    }

    const operations = subEntities.map((se) => {
      // Remove system fields that should be regenerated
      const { id, parentNodeId, createdAt, updatedAt, version, ...importData } = se;

      return {
        nodeId,
        type: se.subEntityType || 'imported',
        data: importData,
      };
    });

    return await this.batchCreateSubEntities(operations);
  }
}
