import type { BaseSubEntity, TreeNodeId, UUID } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { WorkerErrorCode } from '../command/types';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import type { BaseEntity, BaseWorkingCopy, EntityHandler } from './types';

/**
 * Base implementation of EntityHandler
 */
export class BaseEntityHandler<
  TEntity extends BaseEntity,
  TSubEntity extends BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy,
> implements EntityHandler<TEntity, TSubEntity, TWorkingCopy>
{
  constructor(
    protected coreDB: CoreDB,
    protected ephemeralDB: EphemeralDB,
    protected tableName: string,
    protected subEntityTableName?: string
  ) {}

  /**
   * Create a new entity
   */
  async createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity> {
    // Check if entity already exists
    const existing = await this.getEntity(nodeId);
    if (existing) {
      throw new Error('Entity already exists');
    }

    const now = Date.now();
    const entity: TEntity = {
      ...this.getDefaultEntity(),
      ...data,
      nodeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    } as TEntity;

    // Store in CoreDB (using generic table approach for now)
    if (this.coreDB.tables[0]) {
      await this.coreDB.transaction('rw', this.coreDB.tables[0], async () => {
        await this.storeEntity(entity);
      });
    } else {
      await this.storeEntity(entity);
    }

    return entity;
  }

  /**
   * Get an entity by node ID
   */
  async getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined> {
    // Retrieve from storage (implementation depends on actual table structure)
    return this.retrieveEntity(nodeId);
  }

  /**
   * Update an existing entity
   */
  async updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    const updated: TEntity = {
      ...entity,
      ...data,
      nodeId, // Ensure nodeId is not overwritten
      updatedAt: Date.now(),
      version: entity.version + 1,
    };

    if (this.coreDB.tables[0]) {
      await this.coreDB.transaction('rw', this.coreDB.tables[0], async () => {
        await this.storeEntity(updated);
      });
    } else {
      await this.storeEntity(updated);
    }
  }

  /**
   * Delete an entity
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // Delete entity
    await this.removeEntity(nodeId);

    // Cascade delete sub-entities if applicable
    if (this.subEntityTableName) {
      await this.deleteSubEntitiesByParent(nodeId);
    }

    // Also delete any working copies
    await this.discardWorkingCopy(nodeId);
  }

  /**
   * Create a working copy
   */
  async createWorkingCopy(nodeId: TreeNodeId, isDraft?: boolean): Promise<TWorkingCopy> {
    // Check if working copy already exists
    const existing = await this.getWorkingCopy(nodeId);
    if (existing) {
      throw new Error('Working copy already exists');
    }

    const now = Date.now();
    let workingCopy: TWorkingCopy;

    if (isDraft) {
      // Create draft working copy (no source entity)
      workingCopy = {
        workingCopyId: generateUUID(),
        nodeId,
        isDirty: false,
        workingCopyOf: nodeId,
        copiedAt: now,
        updatedAt: now,
        createdAt: now,
        version: 1,
        ...this.getDefaultWorkingCopy(),
      } as unknown as TWorkingCopy;
    } else {
      // Create working copy from existing entity
      const entity = await this.getEntity(nodeId);
      if (!entity) {
        throw new Error('Source entity not found');
      }

      workingCopy = {
        ...this.entityToWorkingCopy(entity),
        workingCopyId: generateUUID(),
        nodeId,
        workingCopyOf: nodeId,
        copiedAt: now,
        updatedAt: now,
      } as TWorkingCopy;
    }

    // Store in EphemeralDB
    await this.storeWorkingCopy(workingCopy);
    return workingCopy;
  }

  /**
   * Get a working copy
   */
  async getWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy | undefined> {
    return this.retrieveWorkingCopy(nodeId);
  }

  /**
   * Commit working copy changes
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: TWorkingCopy): Promise<void> {
    // Verify working copy exists
    const existing = await this.getWorkingCopy(nodeId);
    if (!existing) {
      throw new Error('Working copy not found');
    }

    // Check if this is a draft (no existing entity)
    const existingEntity = await this.getEntity(nodeId);

    if (!existingEntity) {
      // Create new entity from draft
      const entity = this.workingCopyToEntity(workingCopy);
      await this.storeEntity(entity);
    } else {
      // Update existing entity
      const updated = {
        ...this.workingCopyToEntity(workingCopy),
        version: existingEntity.version + 1,
        updatedAt: Date.now(),
      };

      await this.storeEntity(updated);
    }

    // Delete working copy after successful commit
    await this.removeWorkingCopy(nodeId);
  }

  /**
   * Discard a working copy
   */
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    await this.removeWorkingCopy(nodeId);
  }

  /**
   * Create a sub-entity
   */
  async createSubEntity(
    nodeId: TreeNodeId,
    subEntityType: string,
    data: TSubEntity
  ): Promise<void> {
    if (!this.subEntityTableName) {
      throw new Error('Sub-entity operations not supported');
    }

    const subEntity: TSubEntity = {
      ...data,
      id: data.id || generateUUID(),
      parentNodeId: nodeId,
      subEntityType,
    } as TSubEntity;

    await this.storeSubEntity(subEntity);
  }

  /**
   * Get sub-entities by parent
   */
  async getSubEntities?(parentId: TreeNodeId): Promise<TSubEntity[]> {
    if (!this.subEntityTableName) {
      return [];
    }

    return this.retrieveSubEntities(parentId);
  }

  // Protected helper methods for storage operations
  // These would be implemented based on actual database structure

  protected getDefaultEntity(): Partial<TEntity> {
    return {} as Partial<TEntity>;
  }

  protected getDefaultWorkingCopy(): Partial<TWorkingCopy> {
    return {} as Partial<TWorkingCopy>;
  }

  protected entityToWorkingCopy(entity: TEntity): Partial<TWorkingCopy> {
    // Convert entity to working copy format
    const { nodeId, createdAt, updatedAt, version, ...rest } = entity;
    return rest as unknown as Partial<TWorkingCopy>;
  }

  protected workingCopyToEntity(workingCopy: TWorkingCopy): TEntity {
    // Convert working copy to entity format
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...rest } = workingCopy as any;
    return {
      ...rest,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as unknown as TEntity;
  }

  // Storage abstraction methods - to be overridden or implemented
  protected async storeEntity(entity: TEntity): Promise<void> {
    // Store in CoreDB - implementation depends on actual table structure
    // For now, using a mock implementation
    (this.coreDB as any)._entities = (this.coreDB as any)._entities || new Map();
    (this.coreDB as any)._entities.set(entity.nodeId, entity);
  }

  protected async retrieveEntity(nodeId: TreeNodeId): Promise<TEntity | undefined> {
    // Retrieve from CoreDB
    const entities = (this.coreDB as any)._entities as Map<TreeNodeId, TEntity> | undefined;
    return entities?.get(nodeId);
  }

  protected async removeEntity(nodeId: TreeNodeId): Promise<void> {
    // Remove from CoreDB
    const entities = (this.coreDB as any)._entities as Map<TreeNodeId, TEntity> | undefined;
    entities?.delete(nodeId);
  }

  protected async storeWorkingCopy(workingCopy: TWorkingCopy): Promise<void> {
    // Store in EphemeralDB
    (this.ephemeralDB as any)._workingCopies =
      (this.ephemeralDB as any)._workingCopies || new Map();
    (this.ephemeralDB as any)._workingCopies.set(workingCopy.nodeId, workingCopy);
  }

  protected async retrieveWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy | undefined> {
    // Retrieve from EphemeralDB
    const workingCopies = (this.ephemeralDB as any)._workingCopies as
      | Map<TreeNodeId, TWorkingCopy>
      | undefined;
    return workingCopies?.get(nodeId);
  }

  protected async removeWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    // Remove from EphemeralDB
    const workingCopies = (this.ephemeralDB as any)._workingCopies as
      | Map<TreeNodeId, TWorkingCopy>
      | undefined;
    workingCopies?.delete(nodeId);
  }

  protected async storeSubEntity(subEntity: TSubEntity): Promise<void> {
    // Store sub-entity
    (this.coreDB as any)._subEntities = (this.coreDB as any)._subEntities || new Map();
    const id = (subEntity as any).id || generateUUID();
    (this.coreDB as any)._subEntities.set(id, subEntity);
  }

  protected async retrieveSubEntities(parentId: TreeNodeId): Promise<TSubEntity[]> {
    // Retrieve sub-entities by parent
    const subEntities = (this.coreDB as any)._subEntities as Map<string, TSubEntity> | undefined;
    if (!subEntities) return [];

    const result: TSubEntity[] = [];
    subEntities.forEach((subEntity) => {
      if ((subEntity as any).parentId === parentId) {
        result.push(subEntity);
      }
    });
    return result;
  }

  protected async deleteSubEntitiesByParent(parentId: TreeNodeId): Promise<void> {
    // Delete all sub-entities of a parent
    const subEntities = await this.retrieveSubEntities(parentId);
    const map = (this.coreDB as any)._subEntities as Map<string, TSubEntity> | undefined;
    if (map) {
      subEntities.forEach((subEntity) => {
        const id = (subEntity as any).id;
        if (id) map.delete(id);
      });
    }
  }
}
