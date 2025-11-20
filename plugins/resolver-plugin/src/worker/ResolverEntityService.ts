import type { NodeId } from '@hierarchidb/common-types';
import type { Collection, IndexableType, Table } from 'dexie';
import { BaseEntityService } from '@hierarchidb/plugin-runtime-services';
import { resolverEntitiesDB } from './database/index.js';
import type {
  DataTransformation,
  DuplicateResolutionStrategy,
  PropertyMappingRule,
  ResolverEntity,
  ValidationRule,
} from '../common/types/index.js';

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
 * Built on top of the shared BaseEntityService to avoid plugin-ui-sdk runtime dependency.
 */
export class ResolverEntityService extends BaseEntityService<
  ResolverEntity,
  CreateResolverData,
  ResolverSearchCriteria
> {
  protected table: Table<ResolverEntity, NodeId> = resolverEntitiesDB.resolvers;

  /**
   * Build a Resolver entity from creation data
   */
  public buildEntity(
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
    query: Collection<ResolverEntity, IndexableType, ResolverEntity>,
    criteria: ResolverSearchCriteria,
  ): Collection<ResolverEntity, IndexableType, ResolverEntity> {
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
  protected async cleanupEntityData(_entity: ResolverEntity): Promise<void> {
    // No-op for now; working copies are stored via TreeNode drafts.
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

// Backwards compat: downstream code may still import the old handler symbol.
export { ResolverEntityService as ResolverEntityHandler };
