import type {
  EntityHandler,
  GroupEntity,
  NodeId,
  EntityId,
  EntityBackup,
  NodeType,
} from '@hierarchidb/common-type';
import { propertyResolverDB } from '../database/PropertyResolverDatabase';
import type { PropertyResolverEntity, PropertyResolverWorkingCopyEntity as PropertyResolverWorkingCopy } from '../types';

/**
 * EntityHandler implementation for PropertyResolver plugin
 */
export class PropertyResolverEntityHandler
  implements EntityHandler<PropertyResolverEntity, GroupEntity, PropertyResolverWorkingCopy>
{
  /**
   * Create a new PropertyResolver entity
   */
  async createEntity(nodeId: NodeId, data?: Partial<PropertyResolverEntity>): Promise<PropertyResolverEntity> {
    const entityId = crypto.randomUUID() as EntityId;
    const now = Date.now();
    
    const entity: PropertyResolverEntity = {
      id: entityId,
      nodeId,
      name: data?.name || 'New PropertyResolver',
      description: data?.description || '',
      sourceSchema: data?.sourceSchema || '',
      targetSchema: data?.targetSchema || '',
      mappingRules: data?.mappingRules || [],
      validationRules: data?.validationRules || [],
      duplicateResolution: data?.duplicateResolution || { strategy: 'skip' },
      dataTransformations: data?.dataTransformations || [],
      isCompiled: false,
      lastCompiled: undefined,
      compiledFunction: undefined,
      compiledMetadata: undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    
    await propertyResolverDB.propertyResolvers.add(entity);
    return entity;
  }

  /**
   * Get a PropertyResolver entity by nodeId
   */
  async getEntity(nodeId: NodeId): Promise<PropertyResolverEntity | undefined> {
    return await propertyResolverDB.propertyResolvers
      .where('nodeId')
      .equals(nodeId)
      .first();
  }

  /**
   * Update a PropertyResolver entity
   */
  async updateEntity(nodeId: NodeId, data: Partial<PropertyResolverEntity>): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }
    
    await propertyResolverDB.propertyResolvers.update(entity.id, {
      ...data,
      updatedAt: Date.now(),
      version: (entity.version || 0) + 1,
    });
  }

  /**
   * Delete a PropertyResolver entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return; // Already deleted
    }
    
    await propertyResolverDB.propertyResolvers.delete(entity.id);
  }

  /**
   * Create a working copy for editing
   */
  async createWorkingCopy(nodeId: NodeId): Promise<PropertyResolverWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }
    
    const workingCopy: PropertyResolverWorkingCopy = {
      ...entity,
      copiedAt: Date.now(),
      isDirty: false,
      originalVersion: entity.version,
      modifiedFields: [],
    };
    
    // Store in working copies table
    await propertyResolverDB.workingCopies.put(workingCopy);
    
    return workingCopy;
  }

  /**
   * Commit working copy changes back to the entity
   */
  async commitWorkingCopy(nodeId: NodeId, workingCopy: PropertyResolverWorkingCopy): Promise<void> {
    const { copiedAt, isDirty, originalVersion, modifiedFields, ...entityData } = workingCopy;
    
    // Update the main entity
    await this.updateEntity(nodeId, entityData);
    
    // Clear the working copy
    await propertyResolverDB.workingCopies.delete(workingCopy.id);
  }

  /**
   * Discard working copy changes
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity) {
      await propertyResolverDB.workingCopies.delete(entity.id);
    }
  }

  /**
   * Duplicate a PropertyResolver entity
   */
  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }
    
    const newEntity: PropertyResolverEntity = {
      ...entity,
      id: crypto.randomUUID() as EntityId,
      nodeId: newNodeId,
      name: `${entity.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await propertyResolverDB.propertyResolvers.add(newEntity);
  }

  /**
   * Create a backup of the entity
   */
  async backup(nodeId: NodeId): Promise<EntityBackup<PropertyResolverEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }
    
    return {
      entity,
      metadata: {
        backupDate: Date.now(),
        version: String(entity.version),
        nodeType: 'propertyresolver-plugin' as NodeType,
      },
    };
  }

  /**
   * Restore entity from backup
   */
  async restore(nodeId: NodeId, backup: EntityBackup<PropertyResolverEntity>): Promise<void> {
    const { entity } = backup;
    
    // Update entity with backup data, preserving nodeId
    await propertyResolverDB.propertyResolvers.put({
      ...entity,
      nodeId,
      updatedAt: Date.now(),
      version: (entity.version || 0) + 1,
    });
  }

  /**
   * Cleanup any related data when entity is deleted
   */
  async cleanup(nodeId: NodeId): Promise<void> {
    // Delete any working copies
    const entity = await this.getEntity(nodeId);
    if (entity) {
      await propertyResolverDB.workingCopies.delete(entity.id);
    }
    
    // Delete any compiled functions or cached data
    // This would be implemented based on caching strategy
  }
}