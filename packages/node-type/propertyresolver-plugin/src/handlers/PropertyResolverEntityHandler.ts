import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { BaseEntityHandler } from '@hierarchidb/base-plugin';
import { propertyResolverDB } from '../database/PropertyResolverDatabase';
import type { 
  PropertyResolverEntity, 
  PropertyResolverWorkingCopy,
  PropertyMappingRule,
  ValidationRule,
  DuplicateResolutionStrategy,
  DataTransformation
} from '../types';

/**
 * Search criteria specific to PropertyResolver entities
 */
export interface PropertyResolverSearchCriteria {
  name?: string;
  sourceSchema?: string;
  targetSchema?: string;
  isCompiled?: boolean;
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
}

/**
 * Data required to create a PropertyResolver entity
 */
export interface CreatePropertyResolverData {
  name: string;
  description?: string;
  sourceSchema?: string;
  targetSchema?: string;
  mappingRules?: PropertyMappingRule[];
  validationRules?: ValidationRule[];
  duplicateResolution?: DuplicateResolutionStrategy;
  dataTransformations?: DataTransformation[];
}

/**
 * EntityHandler implementation for PropertyResolver plugin
 * Extends BaseEntityHandler for common CRUD operations
 */
export class PropertyResolverEntityHandler extends BaseEntityHandler<
  PropertyResolverEntity,
  any, // PropertyResolverWorkingCopy doesn't extend WorkingCopy base type
  CreatePropertyResolverData,
  PropertyResolverSearchCriteria
> {
  protected table = propertyResolverDB.propertyResolvers;

  /**
   * Build a PropertyResolver entity from creation data
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: CreatePropertyResolverData
  ): PropertyResolverEntity {
    const now = Date.now();
    
    return {
      id: entityId,
      nodeId,
      name: data.name,
      description: data.description || '',
      sourceSchema: data.sourceSchema || '',
      targetSchema: data.targetSchema || '',
      mappingRules: data.mappingRules || [],
      validationRules: data.validationRules || [],
      duplicateResolution: data.duplicateResolution || { strategy: 'skip' },
      dataTransformations: data.dataTransformations || [],
      isCompiled: false,
      lastCompiled: undefined,
      compiledFunction: undefined,
      compiledMetadata: undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  /**
   * Apply PropertyResolver-specific search criteria
   */
  protected applyAdditionalSearchCriteria(
    query: any,
    criteria: PropertyResolverSearchCriteria
  ): any {
    if (criteria.sourceSchema) {
      query = query.filter((entity: PropertyResolverEntity) =>
        entity.sourceSchema?.toLowerCase().includes(criteria.sourceSchema!.toLowerCase())
      );
    }

    if (criteria.targetSchema) {
      query = query.filter((entity: PropertyResolverEntity) =>
        entity.targetSchema?.toLowerCase().includes(criteria.targetSchema!.toLowerCase())
      );
    }

    if (criteria.isCompiled !== undefined) {
      query = query.filter((entity: PropertyResolverEntity) =>
        entity.isCompiled === criteria.isCompiled
      );
    }

    return query;
  }

  /**
   * Clean up PropertyResolver-specific data when entity is deleted
   */
  protected async cleanupEntityData(entity: PropertyResolverEntity): Promise<void> {
    // Delete working copies associated with this entity
    await propertyResolverDB.workingCopies.delete(entity.id);
    
    // Additional cleanup for compiled functions or cached data could go here
  }

  /**
   * Create a working copy for editing
   */
  async createWorkingCopy(nodeId: NodeId): Promise<PropertyResolverWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }
    
    const workingCopyId = crypto.randomUUID() as EntityId;
    const workingCopy: PropertyResolverWorkingCopy = {
      ...entity,
      id: workingCopyId, // Use id as primary key for database
      workingCopyId: workingCopyId,
      originalId: entity.id,
      isDirty: false,
      modifiedFields: [],
    };
    
    await propertyResolverDB.workingCopies.put(workingCopy);
    return workingCopy;
  }

  /**
   * Get working copy by node ID
   */
  async getWorkingCopy(nodeId: NodeId): Promise<PropertyResolverWorkingCopy | null> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      return null;
    }

    const workingCopy = await propertyResolverDB.workingCopies
      .where('originalId')
      .equals(entity.id)
      .first();

    return workingCopy || null;
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    workingCopyId: EntityId,
    updates: Partial<PropertyResolverWorkingCopy>
  ): Promise<PropertyResolverWorkingCopy> {
    const workingCopy = await propertyResolverDB.workingCopies.get(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    const updatedWorkingCopy: PropertyResolverWorkingCopy = {
      ...workingCopy,
      ...updates,
      isDirty: true,
      modifiedFields: Array.from(new Set([
        ...workingCopy.modifiedFields,
        ...Object.keys(updates)
      ])),
    };

    await propertyResolverDB.workingCopies.put(updatedWorkingCopy);
    return updatedWorkingCopy;
  }

  /**
   * Commit working copy changes back to the entity
   */
  async commitWorkingCopy(workingCopyId: EntityId): Promise<PropertyResolverEntity> {
    const workingCopy = await propertyResolverDB.workingCopies.get(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    // Remove working copy specific fields
    const { id: _, workingCopyId: __, originalId, isDirty, modifiedFields, ...entityData } = workingCopy;
    
    // Update the main entity using the original entity id
    const updatedEntity = await this.updateEntity(originalId, entityData);
    
    // Delete the working copy
    await propertyResolverDB.workingCopies.delete(workingCopyId);
    
    return updatedEntity;
  }

  /**
   * Discard working copy changes
   */
  async discardWorkingCopy(workingCopyId: EntityId): Promise<void> {
    await propertyResolverDB.workingCopies.delete(workingCopyId);
  }

  /**
   * Duplicate a PropertyResolver entity
   */
  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<PropertyResolverEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found for nodeId: ${nodeId}`);
    }

    const duplicateData: CreatePropertyResolverData = {
      name: `${entity.name} (Copy)`,
      description: entity.description,
      sourceSchema: entity.sourceSchema,
      targetSchema: entity.targetSchema,
      mappingRules: [...entity.mappingRules],
      validationRules: [...entity.validationRules],
      duplicateResolution: { ...entity.duplicateResolution },
      dataTransformations: [...entity.dataTransformations],
    };

    return await this.createEntity(newNodeId, duplicateData);
  }

  /**
   * Compile the PropertyResolver mapping rules
   */
  async compileMapping(entityId: EntityId): Promise<void> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found: ${entityId}`);
    }

    // Compilation logic would go here
    // For now, just mark as compiled
    await this.updateEntity(entityId, {
      isCompiled: true,
      lastCompiled: Date.now(),
      compiledMetadata: {
        compiledBy: 'system',
        compilationTime: Date.now(),
      },
    });
  }

  /**
   * Clear compiled mapping data
   */
  async clearCompiledMapping(entityId: EntityId): Promise<void> {
    await this.updateEntity(entityId, {
      isCompiled: false,
      lastCompiled: undefined,
      compiledFunction: undefined,
      compiledMetadata: undefined,
    });
  }

  /**
   * Validate mapping rules
   */
  async validateMapping(entityId: EntityId): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      throw new Error(`PropertyResolver entity not found: ${entityId}`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation checks
    if (!entity.sourceSchema) {
      errors.push('Source schema is required');
    }

    if (!entity.targetSchema) {
      errors.push('Target schema is required');
    }

    if (entity.mappingRules.length === 0) {
      warnings.push('No mapping rules defined');
    }

    // Check for duplicate target properties
    const targetProperties = new Set<string>();
    for (const rule of entity.mappingRules) {
      if (targetProperties.has(rule.targetProperty)) {
        errors.push(`Duplicate target property: ${rule.targetProperty}`);
      }
      targetProperties.add(rule.targetProperty);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}