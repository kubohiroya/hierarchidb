import type { NodeId, TreeNode, TreeNodeMetadata } from '@hierarchidb/common-types';
import {
  CoreDB,
  discardTreeNodeDraft,
  getTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from '@hierarchidb/runtime-worker';
import type {
  DataTransformation,
  DuplicateResolutionStrategy,
  PropertyMappingRule,
  ResolverEntity,
  SchemaInfo,
  ValidationRule,
} from '../common/types/index.js';

/**
 * Search criteria specific to Resolver entities.
 */
export interface ResolverSearchCriteria {
  name?: string;
  sourceSchema?: string;
  targetSchema?: string;
  isCompiled?: boolean;
}

/**
 * Data required to create or update a Resolver entity.
 */
export interface CreateResolverData extends Record<string, unknown> {
  name: string;
  description?: string;
  sourceSchema?: SchemaInfo | null;
  targetSchema?: SchemaInfo | null;
  mappingRules?: PropertyMappingRule[];
  validationRules?: ValidationRule[];
  duplicateResolution?: DuplicateResolutionStrategy;
  dataTransformations?: DataTransformation[];
}

/**
 * Resolver entity handler backed by TreeNode payloads (data/draftData + metadata/draftMetadata).
 */
export class ResolverEntityService {
  private coreDBPromise: Promise<CoreDB>;

  constructor(coreDB?: CoreDB) {
    this.coreDBPromise = coreDB ? Promise.resolve(coreDB) : CoreDB.getSingleton();
  }

  private async ensureCoreDB(): Promise<CoreDB> {
    return this.coreDBPromise;
  }

  private buildEntity(nodeId: NodeId, payload: CreateResolverData, base?: ResolverEntity): ResolverEntity {
    const now = Date.now();
    return {
      id: nodeId,
      nodeId,
      name: payload.name ?? base?.name ?? '',
      description: payload.description ?? base?.description ?? '',
      sourceSchema: payload.sourceSchema ?? base?.sourceSchema ?? null,
      targetSchema: payload.targetSchema ?? base?.targetSchema ?? null,
      mappingRules: payload.mappingRules ?? base?.mappingRules ?? [],
      validationRules: payload.validationRules ?? base?.validationRules ?? [],
      duplicateResolution: payload.duplicateResolution ?? base?.duplicateResolution ?? { strategy: 'skip' },
      dataTransformations: payload.dataTransformations ?? base?.dataTransformations ?? [],
      isCompiled: base?.isCompiled ?? false,
      lastCompiled: base?.lastCompiled,
      compiledFunction: base?.compiledFunction,
      compiledMetadata: base?.compiledMetadata,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
      version: base?.version ?? 0,
      lastValidation: base?.lastValidation ?? null,
      tags: base?.tags,
    };
  }

  private async readNode(nodeId: NodeId): Promise<TreeNode | null> {
    const coreDB = await this.ensureCoreDB();
    return getTreeNode(coreDB, nodeId);
  }

  private toPayload(node: TreeNode | null): ResolverEntity | null {
    if (!node) return null;
    const draft = (node as { draftData?: unknown }).draftData as ResolverEntity | undefined;
    const data = (node as { data?: unknown }).data as ResolverEntity | undefined;
    return draft ?? data ?? null;
  }

  private async writeDraft(
    nodeId: NodeId,
    payload: ResolverEntity,
    metadataPatch?: Partial<TreeNodeMetadata>,
  ): Promise<void> {
    // Avoid persisting TreeNode-managed fields (version/timestamps) into draftData.
    const { version: _omitVersion, createdAt: _omitCreatedAt, updatedAt: _omitUpdatedAt, ...payloadWithoutVersion } =
      payload as ResolverEntity & { createdAt?: number; updatedAt?: number; version?: number };
    const coreDB = await this.ensureCoreDB();
    if (metadataPatch && Object.keys(metadataPatch).length > 0) {
      await updateTreeNodeDraftMetadata(coreDB, nodeId, metadataPatch);
    }
    await updateTreeNodeDraftData(coreDB, nodeId, payloadWithoutVersion as unknown as Record<string, unknown>);
  }

  /**
   * Build and persist resolver draft payload to the TreeNode.
   */
  public async createEntity(nodeId: NodeId, data: CreateResolverData): Promise<ResolverEntity> {
    const baseNode = await this.readNode(nodeId);
    if (!baseNode) {
      throw new Error(`TreeNode not found: ${String(nodeId)}`);
    }
    const basePayload = this.toPayload(baseNode) ?? undefined;
    const entity = this.buildEntity(nodeId, data, basePayload);
    await this.writeDraft(nodeId, entity, {
      name: data.name ?? baseNode.metadata.name,
      description: data.description ?? baseNode.metadata.description,
    });
    return entity;
  }

  /**
   * Get resolver payload (prefers draftData, fallback to data).
   */
  public async getEntity(nodeId: NodeId): Promise<ResolverEntity | null> {
    const node = await this.readNode(nodeId);
    return this.toPayload(node);
  }

  /**
   * Update resolver draft payload; metadata(name/description) is optionally synced to draftMetadata.
   */
  public async updateEntity(
    nodeId: NodeId,
    update: Partial<CreateResolverData>,
  ): Promise<ResolverEntity> {
    const current = await this.getEntity(nodeId);
    if (!current) throw new Error('Entity not found');
    const entity = this.buildEntity(nodeId, { ...current, ...update }, current);
    await this.writeDraft(nodeId, entity, {
      name: update.name,
      description: update.description,
    });
    return entity;
  }

  /**
   * Delete resolver payload (draft/data cleared).
   */
  public async deleteEntity(nodeId: NodeId): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await this.readNode(nodeId);
    if (!node) return;
    await coreDB.updateNode({ id: nodeId, draftData: null, data: null });
    await discardTreeNodeDraft(coreDB, nodeId);
  }

  /**
   * Search resolver payloads on TreeNodes (resolver nodeType only).
   */
  public async searchEntities(criteria: ResolverSearchCriteria): Promise<ResolverEntity[]> {
    const coreDB = await this.ensureCoreDB();
    const nodes = await coreDB.nodes.where('nodeType').equals('resolver').toArray();
    const entities: ResolverEntity[] = [];
    nodes.forEach((node) => {
      const payload = this.toPayload(node as TreeNode);
      if (!payload) return;
      entities.push(payload);
    });

    return entities.filter((entity) => {
      if (criteria.name && !entity.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.sourceSchema) {
        const schemaName = entity.sourceSchema?.name ?? '';
        if (!schemaName.toLowerCase().includes(criteria.sourceSchema.toLowerCase())) return false;
      }
      if (criteria.targetSchema) {
        const schemaName = entity.targetSchema?.name ?? '';
        if (!schemaName.toLowerCase().includes(criteria.targetSchema.toLowerCase())) return false;
      }
      if (criteria.isCompiled !== undefined && entity.isCompiled !== criteria.isCompiled) {
        return false;
      }
      return true;
    });
  }

  /**
   * Duplicate resolver payload into another node (draft).
   */
  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<ResolverEntity> {
    const entity = await this.getEntity(nodeId);
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

    const coreDB = await this.ensureCoreDB();
    const targetNode = await coreDB.getNode(newNodeId);
    if (!targetNode) {
      throw new Error(`Target TreeNode not found for duplicate: ${newNodeId}`);
    }

    const duplicate = this.buildEntity(newNodeId, duplicateData, {
      ...entity,
      version: 0,
    } as ResolverEntity);
    await this.writeDraft(newNodeId, duplicate, {
      name: duplicateData.name,
      description: duplicateData.description,
    });
    return duplicate;
  }

  /**
   * Compile the Resolver mapping rules.
   */
  async compileMapping(entityId: NodeId): Promise<void> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      throw new Error(`Resolver entity not found: ${entityId}`);
    }

    const now = Date.now();
    await this.updateEntity(entityId, {
      isCompiled: true,
      lastCompiled: now,
      compiledMetadata: {
        compiledBy: 'system',
        compilationTime: now,
      },
    });
  }

  /**
   * Clear compiled mapping data.
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
   * Validate mapping rules.
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

    if (!entity.sourceSchema) {
      errors.push('Source schema is required');
    }

    if (!entity.targetSchema) {
      errors.push('Target schema is required');
    }

    if (entity.mappingRules.length === 0) {
      warnings.push('No mapping rules defined');
    }

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
