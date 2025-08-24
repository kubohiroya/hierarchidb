import { generateEntityId, type NodeId, type EntityId, type PeerEntity, type WorkingCopyProperties } from '@hierarchidb/common-core';
import { WorkerErrorCode } from '../command/types';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import type { BaseEntity, WorkingCopy, EntityHandler, GroupEntity } from './types';

/**
 * Base implementation of EntityHandler
 */
export class BaseEntityHandler<
  TEntity extends PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> implements EntityHandler<TEntity, TGroupEntity, TWorkingCopy>
{
  constructor(
    protected coreDB: CoreDB,
    protected ephemeralDB: EphemeralDB,
    protected tableName: string,
    protected groupEntityTableName?: string
  ) {}

  /**
   * Create a new entity
   */
  async createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity> {
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

    // Store in CoreDB
    await this.storeEntity(entity);

    return entity;
  }

  /**
   * Get an entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<TEntity | undefined> {
    // Retrieve from storage (implementation depends on actual table structure)
    return this.retrieveEntity(nodeId);
  }

  /**
   * Update an existing entity
   */
  async updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void> {
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

    await this.storeEntity(updated);
  }

  /**
   * Update entity in working copy context with copy-on-write
   */
  async updateWorkingCopyEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void> {
    // Get working copy metadata
    const workingCopyMeta = await this.getWorkingCopy(nodeId);
    if (!workingCopyMeta) {
      throw new Error('Working copy not found');
    }

    // Check if entity has been copied (copy-on-write)
    if (!workingCopyMeta.hasEntityCopy) {
      // First update - copy the entity from CoreDB to EphemeralDB
      const originalEntity = await this.getEntity(nodeId);
      if (originalEntity) {
        // Create entity copy with new ID
        const entityWorkingCopyId = generateEntityId();
        const entityCopy = {
          ...originalEntity,
          id: entityWorkingCopyId,
          nodeId: nodeId, // Still references the same nodeId
          ...data,
          updatedAt: Date.now(),
          version: 1, // Reset version for working copy
        } as TEntity;
        
        // Store in EphemeralDB
        if (this.ephemeralDB.tables[0]) {
          await this.ephemeralDB.transaction('rw', this.ephemeralDB.tables[0], async () => {
            await this.ephemeralDB.table(this.tableName).add(entityCopy);
          });
        } else {
          await this.ephemeralDB.table(this.tableName).add(entityCopy);
        }
        
        // Update working copy metadata
        workingCopyMeta.hasEntityCopy = true;
        workingCopyMeta.entityWorkingCopyId = entityWorkingCopyId;
        await this.storeWorkingCopy(workingCopyMeta);
      } else if (!(workingCopyMeta as any).workingCopyOf) {
        // New entity (draft mode)
        const entityWorkingCopyId = generateEntityId();
        const newEntity = {
          id: entityWorkingCopyId,
          nodeId: nodeId,
          ...this.getDefaultEntity(),
          ...data,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        } as TEntity;
        
        if (this.ephemeralDB.tables[0]) {
          await this.ephemeralDB.transaction('rw', this.ephemeralDB.tables[0], async () => {
            await this.ephemeralDB.table(this.tableName).add(newEntity);
          });
        } else {
          await this.ephemeralDB.table(this.tableName).add(newEntity);
        }
        
        workingCopyMeta.hasEntityCopy = true;
        workingCopyMeta.entityWorkingCopyId = entityWorkingCopyId;
        await this.storeWorkingCopy(workingCopyMeta);
      }
    } else {
      // Entity already copied - just update it
      const entityCopy = await this.ephemeralDB.table(this.tableName)
        .where('id').equals(workingCopyMeta.entityWorkingCopyId!)
        .first();
      
      if (!entityCopy) {
        throw new Error('Entity copy not found');
      }
      
      const updated = {
        ...entityCopy,
        ...data,
        updatedAt: Date.now(),
        version: entityCopy.version + 1,
      };
      
      if (this.ephemeralDB.tables[0]) {
        await this.ephemeralDB.transaction('rw', this.ephemeralDB.tables[0], async () => {
          await this.ephemeralDB.table(this.tableName).update(workingCopyMeta.entityWorkingCopyId!, updated);
        });
      } else {
        await this.ephemeralDB.table(this.tableName).update(workingCopyMeta.entityWorkingCopyId!, updated);
      }
    }
  }

  /**
   * Update sub-entities in working copy context with copy-on-write
   */
  async updateWorkingCopyGroupEntities(
    nodeId: NodeId, 
    groupEntityType: string,
    groupEntities: TGroupEntity[]
  ): Promise<void> {
    // Get working copy metadata
    const workingCopyMeta = await this.getWorkingCopy(nodeId);
    if (!workingCopyMeta) {
      throw new Error('Working copy not found');
    }

    // Initialize sub-entity tracking if needed
    if (!(workingCopyMeta as any).hasGroupEntityCopy) {
      (workingCopyMeta as any).hasGroupEntityCopy = {};
    }

    // Check if this type of sub-entity has been copied
    if (!(workingCopyMeta as any).hasGroupEntityCopy[groupEntityType]) {
      // First update for this sub-entity type - copy from CoreDB to EphemeralDB
      const originalGroupEntities = await this.getGroupEntities?.(nodeId) || [];
      
      // Delete any existing sub-entities in EphemeralDB (clean slate)
      if (this.groupEntityTableName) {
        await this.ephemeralDB.table(this.groupEntityTableName)
          .where('parentNodeId').equals(nodeId)
          .and(item => item.type === groupEntityType)
          .delete();
      }
      
      // Mark this sub-entity type as copied
      (workingCopyMeta as any).hasGroupEntityCopy[groupEntityType] = true;
    }
    
    // Store new sub-entities in EphemeralDB
    if (this.groupEntityTableName) {
      for (const groupEntity of groupEntities) {
        const groupEntityCopy = {
          ...groupEntity,
          id: groupEntity.id || generateEntityId(),
          parentNodeId: nodeId,
          type: groupEntityType,
          createdAt: groupEntity.createdAt || Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        
        await this.ephemeralDB.table(this.groupEntityTableName).add(groupEntityCopy);
      }
    }
    
    // Update working copy metadata
    await this.storeWorkingCopy(workingCopyMeta);
  }

  /**
   * Delete an entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // Delete entity
    await this.removeEntity(nodeId);

    // Cascade delete sub-entities if applicable
    if (this.groupEntityTableName) {
      await this.deleteGroupEntitiesByParent(nodeId);
    }

    // Also delete any working copies
    await this.discardWorkingCopy(nodeId);
  }

  /**
   * Create a working copy
   */
  async createWorkingCopy(nodeId: NodeId, isDraft?: boolean): Promise<TWorkingCopy> {
    // For new specification: Working copy for TreeNode only, entity is copy-on-write
    // This method now only tracks that a working copy exists, entity copy happens on first update
    
    // Check if working copy tracking exists
    const existing = await this.getWorkingCopy(nodeId);
    if (existing) {
      return existing; // Return existing if already created
    }

    const now = Date.now();
    
    // Create minimal working copy metadata (entity not copied yet)
    const workingCopyMetadata = {
      nodeId,
      workingCopyOf: isDraft ? undefined : nodeId,
      copiedAt: now,
      hasEntityCopy: false, // Entity not copied yet (copy-on-write)
      entityWorkingCopyId: undefined,
    } as unknown as TWorkingCopy;

    // Store metadata in EphemeralDB
    await this.storeWorkingCopy(workingCopyMetadata);
    return workingCopyMetadata;
  }

  /**
   * Get a working copy
   */
  async getWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy | undefined> {
    return this.retrieveWorkingCopy(nodeId);
  }

  /**
   * Commit working copy changes
   */
  async commitWorkingCopy(nodeId: NodeId, workingCopy: TWorkingCopy): Promise<void> {
    // Get working copy metadata
    const workingCopyMeta = await this.getWorkingCopy(nodeId);
    if (!workingCopyMeta) {
      throw new Error('Working copy metadata not found');
    }

    // Only proceed if entity was actually copied (copy-on-write)
    if (workingCopyMeta.hasEntityCopy && workingCopyMeta.entityWorkingCopyId) {
      // Get the entity copy from EphemeralDB
      const entityCopy = await this.ephemeralDB.table(this.tableName)
        .where('id').equals(workingCopyMeta.entityWorkingCopyId)
        .first();
      
      if (!entityCopy) {
        throw new Error('Entity copy not found in EphemeralDB');
      }

      // Check if this is a new entity or update
      const existingEntity = await this.getEntity(nodeId);
      
      // Prepare entity with correct ID for CoreDB
      const finalEntity = {
        ...entityCopy,
        id: existingEntity?.id || generateEntityId(), // Use existing ID or generate new
        nodeId: nodeId, // Ensure correct node reference
        version: existingEntity ? existingEntity.version + 1 : 1,
        updatedAt: Date.now(),
      } as TEntity;

      // Store in CoreDB
      if (existingEntity) {
        // Update existing entity
        await this.coreDB.table(this.tableName).update(existingEntity.id, finalEntity);
      } else {
        // Create new entity
        await this.coreDB.table(this.tableName).add(finalEntity);
      }

      // Delete entity copy from EphemeralDB
      await this.ephemeralDB.table(this.tableName).delete(workingCopyMeta.entityWorkingCopyId);
    }

    // Commit sub-entities if they were copied
    if ((workingCopyMeta as any).hasGroupEntityCopy && this.groupEntityTableName) {
      for (const [groupEntityType, wasCopied] of Object.entries((workingCopyMeta as any).hasGroupEntityCopy)) {
        if (wasCopied) {
          // Get sub-entities from EphemeralDB
          const groupEntitiesInWC = await this.ephemeralDB.table(this.groupEntityTableName)
            .where('parentNodeId').equals(nodeId)
            .and(item => item.type === groupEntityType)
            .toArray();
          
          // Delete existing sub-entities in CoreDB
          await this.coreDB.table(this.groupEntityTableName)
            .where('parentNodeId').equals(nodeId)
            .and(item => item.type === groupEntityType)
            .delete();
          
          // Copy sub-entities to CoreDB
          for (const groupEntity of groupEntitiesInWC) {
            await this.coreDB.table(this.groupEntityTableName).add({
              ...groupEntity,
              updatedAt: Date.now(),
            });
          }
          
          // Delete sub-entities from EphemeralDB
          await this.ephemeralDB.table(this.groupEntityTableName)
            .where('parentNodeId').equals(nodeId)
            .and(item => item.type === groupEntityType)
            .delete();
        }
      }
    }

    // Delete working copy metadata
    await this.removeWorkingCopy(nodeId);
  }

  /**
   * Discard a working copy
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    await this.removeWorkingCopy(nodeId);
  }

  /**
   * Create a sub-entity
   */
  async createGroupEntity(
    nodeId: NodeId,
    groupEntityType: string,
    data: TGroupEntity
  ): Promise<void> {
    if (!this.groupEntityTableName) {
      throw new Error('Sub-entity operations not supported');
    }

    const groupEntityData: TGroupEntity = {
      ...data,
      id: data.id || generateEntityId(),
      parentNodeId: nodeId,
      groupEntityType,
    } as TGroupEntity;

    await this.storeGroupEntity(groupEntityData);
  }

  /**
   * Get sub-entities by parent
   */
  async getGroupEntities?(parentId: NodeId): Promise<TGroupEntity[]> {
    if (!this.groupEntityTableName) {
      return [];
    }

    return this.retrieveGroupEntities(parentId);
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

  protected async retrieveEntity(nodeId: NodeId): Promise<TEntity | undefined> {
    // Retrieve from CoreDB
    const entities = (this.coreDB as any)._entities as Map<NodeId, TEntity> | undefined;
    return entities?.get(nodeId);
  }

  protected async removeEntity(nodeId: NodeId): Promise<void> {
    // Remove from CoreDB
    const entities = (this.coreDB as any)._entities as Map<NodeId, TEntity> | undefined;
    entities?.delete(nodeId);
  }

  protected async storeWorkingCopy(workingCopy: TWorkingCopy): Promise<void> {
    // Store in EphemeralDB
    (this.ephemeralDB as any)._workingCopies =
      (this.ephemeralDB as any)._workingCopies || new Map();
    (this.ephemeralDB as any)._workingCopies.set(workingCopy.nodeId, workingCopy);
  }

  protected async retrieveWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy | undefined> {
    // Retrieve from EphemeralDB
    const workingCopies = (this.ephemeralDB as any)._workingCopies as
      | Map<NodeId, TWorkingCopy>
      | undefined;
    return workingCopies?.get(nodeId);
  }

  protected async removeWorkingCopy(nodeId: NodeId): Promise<void> {
    // Remove from EphemeralDB
    const workingCopies = (this.ephemeralDB as any)._workingCopies as
      | Map<NodeId, TWorkingCopy>
      | undefined;
    workingCopies?.delete(nodeId);
  }

  protected async storeGroupEntity(groupEntityData: TGroupEntity): Promise<void> {
    // Store sub-entity
    (this.coreDB as any)._groupEntities = (this.coreDB as any)._groupEntities || new Map();
    const id = (groupEntityData as any).id || generateEntityId();
    (this.coreDB as any)._groupEntities.set(id, groupEntityData);
  }

  protected async retrieveGroupEntities(parentId: NodeId): Promise<TGroupEntity[]> {
    // Retrieve sub-entities by parent
    const groupEntitiesMap = (this.coreDB as any)._groupEntities as Map<string, TGroupEntity> | undefined;
    if (!groupEntitiesMap) return [];

    const result: TGroupEntity[] = [];
    groupEntitiesMap.forEach((groupEntityItem) => {
      if ((groupEntityItem as any).parentId === parentId) {
        result.push(groupEntityItem);
      }
    });
    return result;
  }

  protected async deleteGroupEntitiesByParent(parentId: NodeId): Promise<void> {
    // Delete all sub-entities of a parent
    const groupEntities = await this.retrieveGroupEntities(parentId);
    const map = (this.coreDB as any)._groupEntities as Map<string, TGroupEntity> | undefined;
    if (map) {
      groupEntities.forEach((groupEntityItem) => {
        const id = (groupEntityItem as any).id;
        if (id) map.delete(id);
      });
    }
  }
}
