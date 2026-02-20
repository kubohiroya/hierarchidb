import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type {
  DataTransformation,
  DuplicateResolutionStrategy,
  MappingValidationResult,
  PropertyMappingRule,
  ResolverEntity,
  SchemaInfo,
  ValidationRule,
} from '~/common/entities/ResolverEntity';
import { CoreDB } from '@hierarchidb/runtime-worker';

type ResolverEntityPayload = ResolverEntity & {
  name: string;
  description: string;
};

export type CreateResolverData = {
  name: string;
  description?: string;
  sourceSchema?: SchemaInfo | string | null;
  targetSchema?: SchemaInfo | string | null;
  mappingRules?: PropertyMappingRule[];
  validationRules?: ValidationRule[];
  duplicateResolution?: DuplicateResolutionStrategy;
  dataTransformations?: DataTransformation[];
};

type ResolverSearchCriteria = {
  name?: string;
  sourceSchema?: string;
  targetSchema?: string;
};

const defaultDuplicateResolution: DuplicateResolutionStrategy = { strategy: 'skip' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const mergeMetadata = (base: TreeNodeMetadata, updates?: Partial<TreeNodeMetadata>): TreeNodeMetadata => ({
  ...base,
  ...(updates ?? {}),
});

export class ResolverEntityService {
  private coreDBPromise: Promise<CoreDB>;

  constructor(coreDB?: CoreDB) {
    this.coreDBPromise = coreDB ? Promise.resolve(coreDB) : CoreDB.getSingleton();
  }

  private async ensureCoreDB(): Promise<CoreDB> {
    return this.coreDBPromise;
  }

  private resolveTargetField(node: TreeNode): 'data' | 'draftData' {
    const hasDraft = typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    return hasDraft ? 'draftData' : 'data';
  }

  private resolveMetadata(node: TreeNode): TreeNodeMetadata {
    const hasDraft = (node as { draftMetadata?: unknown }).draftMetadata !== null &&
      typeof (node as { draftMetadata?: unknown }).draftMetadata !== 'undefined';
    return hasDraft && node.draftMetadata ? node.draftMetadata : node.metadata;
  }

  private toPayload(
    _nodeId: NodeId,
    metadata: TreeNodeMetadata,
    data: ResolverEntity | null
  ): ResolverEntityPayload | null {
    if (!data || !isRecord(data)) {
      return null;
    }
    return { ...(data as ResolverEntity), name: metadata.name, description: metadata.description };
  }

  async getEntity(nodeId: NodeId): Promise<ResolverEntityPayload | null> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      return null;
    }
    const targetField = this.resolveTargetField(node);
    const data = (node as unknown as Record<string, unknown>)[targetField] as ResolverEntity | null;
    return this.toPayload(nodeId, this.resolveMetadata(node), data);
  }

  async createEntity(nodeId: NodeId, data: CreateResolverData): Promise<ResolverEntityPayload> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      throw new Error('Entity not found');
    }
    const targetField = this.resolveTargetField(node);
    const metadataPatch: Partial<TreeNodeMetadata> = {
      name: data.name,
      description: data.description ?? '',
    };
    const baseData: ResolverEntity = {
      id: nodeId,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
      sourceSchema: (data.sourceSchema ?? null) as SchemaInfo | null,
      targetSchema: (data.targetSchema ?? null) as SchemaInfo | null,
      mappingRules: data.mappingRules ?? [],
      validationRules: data.validationRules ?? [],
      duplicateResolution: data.duplicateResolution ?? defaultDuplicateResolution,
      dataTransformations: data.dataTransformations ?? [],
      isCompiled: false,
    };
    await coreDB.updateNode({
      id: nodeId,
      [targetField]: baseData,
      ...(targetField === 'draftData'
        ? { draftMetadata: mergeMetadata(node.draftMetadata ?? node.metadata, metadataPatch) }
        : { metadata: mergeMetadata(node.metadata, metadataPatch) }),
    });
    const updated = await this.getEntity(nodeId);
    if (!updated) {
      throw new Error('Entity not found');
    }
    return updated;
  }

  async updateEntity(
    nodeId: NodeId,
    updates: Partial<ResolverEntityPayload>
  ): Promise<ResolverEntityPayload> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      throw new Error('Entity not found');
    }
    const targetField = this.resolveTargetField(node);
    const existing = (node as unknown as Record<string, unknown>)[targetField];
    if (!isRecord(existing)) {
      throw new Error('Entity not found');
    }
    const metadataPatch: Partial<TreeNodeMetadata> = {};
    if (typeof updates.name === 'string') {
      metadataPatch.name = updates.name;
    }
    if (typeof updates.description === 'string') {
      metadataPatch.description = updates.description;
    }
    const { name: _name, description: _description, id: _id, ...dataUpdates } =
      updates as Partial<ResolverEntityPayload> & { id?: NodeId };
    const nextData: ResolverEntity = {
      ...(existing as unknown as ResolverEntity),
      ...dataUpdates,
      id: nodeId,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
    };
    await coreDB.updateNode({
      id: nodeId,
      [targetField]: nextData,
      ...(targetField === 'draftData'
        ? { draftMetadata: mergeMetadata(node.draftMetadata ?? node.metadata, metadataPatch) }
        : { metadata: mergeMetadata(node.metadata, metadataPatch) }),
    });
    const updated = await this.getEntity(nodeId);
    if (!updated) {
      throw new Error('Entity not found');
    }
    return updated;
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      return;
    }
    const targetField = this.resolveTargetField(node);
    await coreDB.updateNode({
      id: nodeId,
      [targetField]: null,
    });
  }

  async searchEntities(criteria: ResolverSearchCriteria): Promise<ResolverEntityPayload[]> {
    if (criteria.sourceSchema || criteria.targetSchema) {
      return [];
    }
    const coreDB = await this.ensureCoreDB();
    const nodes = await coreDB.nodes.where('nodeType').equals('resolver').toArray();
    const normalized = criteria.name?.toLowerCase().trim();
    const results: ResolverEntityPayload[] = [];
    for (const node of nodes) {
      const targetField = this.resolveTargetField(node as TreeNode);
      const data = (node as unknown as Record<string, unknown>)[targetField] as ResolverEntity | null;
      const payload = this.toPayload(node.id, this.resolveMetadata(node as TreeNode), data);
      if (!payload) {
        continue;
      }
      if (normalized) {
        if (!payload.name.toLowerCase().includes(normalized)) {
          continue;
        }
      }
      results.push(payload);
    }
    return results;
  }

  async duplicate(sourceId: NodeId, newNodeId: NodeId): Promise<ResolverEntityPayload> {
    const original = await this.getEntity(sourceId);
    if (!original) {
      throw new Error('Entity not found');
    }
    const duplicateData: CreateResolverData = {
      name: `${original.name} (Copy)`,
      description: original.description,
      sourceSchema: original.sourceSchema,
      targetSchema: original.targetSchema,
      mappingRules: original.mappingRules,
      validationRules: original.validationRules,
      duplicateResolution: original.duplicateResolution,
      dataTransformations: original.dataTransformations,
    };
    return this.createEntity(newNodeId, duplicateData);
  }

  async validateMapping(nodeId: NodeId): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return { isValid: false, errors: ['Entity not found'], warnings: [] };
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!entity.sourceSchema) {
      errors.push('Source schema is required');
    }
    if (!entity.targetSchema) {
      errors.push('Target schema is required');
    }
    if (!entity.mappingRules || entity.mappingRules.length === 0) {
      warnings.push('No mapping rules defined');
    }
    const targetCounts = new Map<string, number>();
    for (const rule of entity.mappingRules ?? []) {
      const key = rule.targetProperty;
      targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
    }
    for (const [target, count] of targetCounts.entries()) {
      if (count > 1) {
        errors.push(`Duplicate target property: ${target}`);
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async compileMapping(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Entity not found');
    }
    await this.updateEntity(nodeId, { isCompiled: false });
  }

  async clearCompiledMapping(nodeId: NodeId): Promise<void> {
    await this.updateEntity(nodeId, {
      isCompiled: false,
      lastCompiled: undefined,
      compiledFunction: undefined,
      compiledMetadata: undefined,
    });
  }
}

export type { MappingValidationResult };
