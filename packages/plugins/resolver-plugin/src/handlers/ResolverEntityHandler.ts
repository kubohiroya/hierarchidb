import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import type { Table } from 'dexie';
import { BaseEntityHandler, createDraftWorkingCopyBase, markWorkingCopyUpdated } from '@hierarchidb/plugins-base-plugin';
import { resolverDB } from '../database/ResolverDatabase.js';
import type {
  DataTransformation,
  DuplicateResolutionStrategy,
  PropertyMappingRule,
  ResolverEntity,
  ResolverWorkingCopy,
  ValidationRule,
} from '../types/index.js';

/**
 * Search criteria specific to Resolver entities
 */
export interface ResolverSearchCriteria {
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
 * Data required to create a Resolver entity
 */
export interface CreateResolverData {
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
 * EntityHandler implementation for Resolver plugin
 * Extends BaseEntityHandler for common CRUD operations
 */
export class ResolverEntityHandler extends BaseEntityHandler<
  ResolverEntity,
  CreateResolverData,
  ResolverSearchCriteria
> {
  protected table: Table<ResolverEntity, NodeId> = resolverDB.resolvers;

  /**
   * Build a Resolver entity from creation data
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: NodeId,
    data: CreateResolverData,
  ): ResolverEntity {
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
   * Apply Resolver-specific search criteria
   */
  protected applyAdditionalSearchCriteria(
    query: any,
    criteria: ResolverSearchCriteria,
  ): any {
    if (criteria.sourceSchema) {
      query = query.filter((entity: ResolverEntity) =>
        entity.sourceSchema?.toLowerCase().includes(criteria.sourceSchema!.toLowerCase()),
      );
    }

    if (criteria.targetSchema) {
      query = query.filter((entity: ResolverEntity) =>
        entity.targetSchema?.toLowerCase().includes(criteria.targetSchema!.toLowerCase()),
      );
    }

    if (criteria.isCompiled !== undefined) {
      query = query.filter((entity: ResolverEntity) =>
        entity.isCompiled === criteria.isCompiled,
      );
    }

    return query;
  }

  /**
   * Clean up Resolver-specific data when entity is deleted
   */
  protected async cleanupEntityData(entity: ResolverEntity): Promise<void> {
    // Delete working copies associated with this entity
    await resolverDB.workingCopies.delete(entity.id);

    // Additional cleanup for compiled functions or cached data could go here
  }

  /**
   * Create a working copy for editing
   */
  async createWorkingCopy(nodeId: NodeId): Promise<ResolverWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Resolver entity not found for nodeId: ${nodeId}`);
    }

    const draftPayload: ResolverDraftPayload = { ...entity };

    const base = createDraftWorkingCopyBase<ResolverEntity>({
      draft: draftPayload,
      meta: {
        treeNodeId: entity.nodeId,
        createdAt: entity.createdAt as Timestamp,
        updatedAt: entity.updatedAt as Timestamp,
        originalVersion: entity.version,
      },
    });

    const workingCopy: ResolverWorkingCopy = {
      ...base,
      ...draftPayload,
    };

    await resolverDB.workingCopies.put(workingCopy, workingCopy.treeNodeId);
    return workingCopy;
  }

  /**
   * Get working copy by node ID
   */
  async getWorkingCopy(nodeId: NodeId): Promise<ResolverWorkingCopy | null> {
    const existing = await resolverDB.workingCopies.get(nodeId);
    return existing ?? null;
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    treeNodeId: NodeId,
    updates: Partial<ResolverEntity>,
  ): Promise<ResolverWorkingCopy> {
    const workingCopy = await resolverDB.workingCopies.get(treeNodeId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${treeNodeId}`);
    }

    const merged = markWorkingCopyUpdated(workingCopy, updates, Date.now() as Timestamp);

    await resolverDB.workingCopies.put(merged, merged.treeNodeId);
    return merged;
  }

  /**
   * Commit working copy changes back to the entity
   */
  async commitWorkingCopy(workingCopyId: NodeId): Promise<ResolverEntity> {
    const workingCopy = await resolverDB.workingCopies.get(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }
    const entityId = workingCopy.draft.id ?? workingCopy.treeNodeId;
    if (!entityId) {
      throw new Error('Working copy missing entity id');
    }

    const entityData: Partial<ResolverEntity> = {
      ...workingCopy.draft,
      updatedAt: Date.now(),
    };

    const updatedEntity = await this.updateEntity(entityId as NodeId, entityData);

    await resolverDB.workingCopies.delete(workingCopyId);

    return updatedEntity;
  }

  /**
   * Discard working copy changes
   */
  async discardWorkingCopy(workingCopyId: NodeId): Promise<void> {
    await resolverDB.workingCopies.delete(workingCopyId);
  }

  /**
   * Duplicate a Resolver entity
   */
  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<ResolverEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Resolver entity not found for nodeId: ${nodeId}`);
    }

    const duplicateData: CreateResolverData = {
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
   * Compile the Resolver mapping rules
   */
  async compileMapping(entityId: NodeId): Promise<void> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      throw new Error(`Resolver entity not found: ${entityId}`);
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
  async clearCompiledMapping(entityId: NodeId): Promise<void> {
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
  async validateMapping(entityId: NodeId): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      throw new Error(`Resolver entity not found: ${entityId}`);
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
