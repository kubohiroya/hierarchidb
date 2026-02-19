import { vi, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { ResolverEntityService } from '~/worker/ResolverEntityService.ts';

vi.mock('@hierarchidb/plugin-registry', () => ({
  pluginRegistry: {},
  pluginDefinitions: [],
  pluginUiLoaders: {},
  pluginWorkerLoaders: {},
  pluginIconLoaders: {},
  pluginDatabaseLoaders: {},
}));
vi.mock('@hierarchidb/plugin-registry/dist/registry.js', () => ({
  pluginRegistry: {},
  pluginDefinitions: [],
  pluginUiLoaders: {},
  pluginWorkerLoaders: {},
  pluginIconLoaders: {},
  pluginDatabaseLoaders: {},
}));
vi.mock('../../../../packages/plugin-registry/dist/registry.js', () => ({
  pluginRegistry: {},
  pluginDefinitions: [],
  pluginUiLoaders: {},
  pluginWorkerLoaders: {},
  pluginIconLoaders: {},
  pluginDatabaseLoaders: {},
}));
vi.mock('@hierarchidb/basemap-plugin/icon', () => ({
  BasemapPluginIcon: () => null,
}));
const runtimeWorkerMocks = vi.hoisted(() => {
  class CoreDB {
    nodes = {
      data: new Map<string, TreeNode>(),
      where: (_field: string) => ({
        equals: (_val: string) => ({
          toArray: async () => Array.from(this.nodes.data.values()),
          delete: async () => {
            this.nodes.data.clear();
          },
        }),
      }),
    };
    constructor(public name: string) {}
    static async getSingleton() {
      return new CoreDB('singleton');
    }
    async open() {}
    async initialize() {}
    async delete() {}
    close() {}
    async createNode(node: TreeNode) {
      this.nodes.data.set(node.id as string, node);
    }
    async getNode(id: NodeId) {
      return this.nodes.data.get(id as string) ?? null;
    }
    async updateNode(node: Partial<TreeNode> & { id: NodeId }) {
      const current = this.nodes.data.get(node.id as string);
      if (current) {
        this.nodes.data.set(node.id as string, { ...current, ...node } as TreeNode);
      }
    }
  }
  const getTreeNode = async (db: CoreDB, id: NodeId) => db.nodes.data.get(id as string) ?? null;
  const updateTreeNodeDraftMetadata = async (db: CoreDB, id: NodeId, patch: Record<string, unknown>) => {
    const node = db.nodes.data.get(id as string);
    if (node) db.nodes.data.set(id as string, { ...node, draftMetadata: { ...(node.draftMetadata ?? {}), ...patch } } as TreeNode);
  };
  const updateTreeNodeDraftData = async (db: CoreDB, id: NodeId, patch: Record<string, unknown>) => {
    const node = db.nodes.data.get(id as string);
    if (node) db.nodes.data.set(id as string, { ...node, draftData: { ...(node.draftData as any ?? {}), ...patch } } as TreeNode);
  };
  const discardTreeNodeDraft = async (db: CoreDB, id: NodeId) => {
    const node = db.nodes.data.get(id as string);
    if (node) db.nodes.data.set(id as string, { ...node, draftData: undefined, draftMetadata: null } as TreeNode);
  };
  return { CoreDB, getTreeNode, updateTreeNodeDraftData, updateTreeNodeDraftMetadata, discardTreeNodeDraft };
});
vi.mock('@hierarchidb/runtime-worker', () => runtimeWorkerMocks);
const { CoreDB } = runtimeWorkerMocks;

describe('Resolver Integration Tests', () => {
  let handler: ResolverEntityService;
  let coreDB;
  let idCounter = 0;

  beforeEach(async () => {
    coreDB = new CoreDB('resolver-entity-integration-tests');
    await coreDB.open();
    await coreDB.initialize();
    handler = new ResolverEntityService(coreDB);
  });

  afterEach(async () => {
    await coreDB.nodes.where('nodeType').equals('resolver').delete();
  });

  afterAll(async () => {
    await coreDB.delete();
    coreDB.close();
  });

  const createResolverNode = async (name = 'Resolver'): Promise<NodeId> => {
    const nodeId = `resolver-int-${Date.now()}-${idCounter++}` as NodeId;
    const now = Date.now();
    const node: TreeNode = {
      id: nodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'resolver',
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: { name, description: '', tags: [] },
      draftMetadata: null,
      data: null,
      draftData: undefined,
    };
    await coreDB.createNode(node);
    return nodeId;
  };

  describe('Entity Creation', () => {
    it('should create a Resolver entity with default values', async () => {
      const testNodeId = await createResolverNode('test-node-123');
      const entity = await handler.createEntity(testNodeId, {
        name: 'New Resolver',
      });

      expect(entity).toBeDefined();
      expect(entity.id).toBe(testNodeId);
      expect(entity.name).toBe('New Resolver');
      expect(entity.mappingRules).toEqual([]);
      expect(entity.validationRules).toEqual([]);
      expect(entity.isCompiled).toBe(false);
    });

    it('should create a Resolver entity with custom values', async () => {
      const testNodeId = await createResolverNode('test-node-123');
      const customData = {
        name: 'Custom Resolver',
        description: 'Test resolver',
        sourceSchema: 'source_schema',
        targetSchema: 'target_schema',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            transformFunction: undefined,
            isRequired: true,
            defaultValue: undefined,
          },
        ],
      };

      const entity = await handler.createEntity(testNodeId, customData);

      expect(entity.name).toBe('Custom Resolver');
      expect(entity.description).toBe('Test resolver');
      expect(entity.sourceSchema).toBe('source_schema');
      expect(entity.targetSchema).toBe('target_schema');
      expect(entity.mappingRules).toHaveLength(1);
      expect(entity.mappingRules[0].sourceProperty).toBe('prop1');
    });
  });

  // Working copy behavior is exercised via DraftAPI in integration tests elsewhere.

  describe('Mapping Rules', () => {
    it('should handle complex mapping rules', async () => {
      const testNodeId = await createResolverNode('mapping-node');
      const complexMappingRules = [
        {
          id: 'rule1',
          sourceProperty: 'user.firstName',
          targetProperty: 'name.first',
          transformFunction: 'value.toLowerCase()',
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule2',
          sourceProperty: 'user.lastName',
          targetProperty: 'name.last',
          transformFunction: 'value.toUpperCase()',
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule3',
          sourceProperty: 'user.age',
          targetProperty: 'demographics.age',
          transformFunction: 'parseInt(value)',
          isRequired: false,
          defaultValue: '0',
        },
      ];

      const entity = await handler.createEntity(testNodeId, {
        name: 'Complex Mapper',
        mappingRules: complexMappingRules,
      });

      expect(entity.mappingRules).toHaveLength(3);
      expect(entity.mappingRules[0].transformFunction).toBe('value.toLowerCase()');
      expect(entity.mappingRules[2].defaultValue).toBe('0');
    });
  });

  describe('Validation Rules', () => {
    it('should handle validation rules', async () => {
      const testNodeId = await createResolverNode('validation-node');
      const validationRules = [
        {
          id: 'val1',
          fieldPath: 'email',
          ruleName: 'email',
          validationType: 'format' as const,
          errorMessage: 'Invalid email format',
          isActive: true,
          severity: 'error' as const,
        },
        {
          id: 'val2',
          fieldPath: 'age',
          ruleName: 'range',
          validationType: 'range' as const,
          errorMessage: 'Age must be between 0 and 120',
          isActive: true,
          severity: 'warning' as const,
          min: 0,
          max: 120,
        },
      ];

      const entity = await handler.createEntity(testNodeId, {
        name: 'Validated Resolver',
        validationRules,
      });

      expect(entity.validationRules).toHaveLength(2);
      expect(entity.validationRules[0].validationType).toBe('format');
      expect(entity.validationRules[1].min).toBe(0);
      expect(entity.validationRules[1].max).toBe(120);
    });
  });

  describe('Duplicate Resolution', () => {
    it('should handle duplicate resolution strategies', async () => {
      const testNodeId = await createResolverNode('duplicate-node');
      const duplicateResolution = {
        strategy: 'merge' as const,
        mergeRules: [
          {
            field: 'tags',
            mergeStrategy: 'union' as const,
          },
          {
            field: 'metadata',
            mergeStrategy: 'overwrite' as const,
          },
        ],
      };

      const entity = await handler.createEntity(testNodeId, {
        name: 'Merge Resolver',
        duplicateResolution,
      });

      expect(entity.duplicateResolution.strategy).toBe('merge');
      expect(entity.duplicateResolution.mergeRules).toHaveLength(2);
    });
  });

  describe('Compilation', () => {
    it('should compile mapping rules', async () => {
      const testNodeId = await createResolverNode('compile-node');
      const entity = await handler.createEntity(testNodeId, {
        name: 'Compilable Resolver',
        sourceSchema: 'source',
        targetSchema: 'target',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            isRequired: true,
          },
        ],
      });

      await handler.compileMapping(entity.id);

      const compiled = await handler.getEntity(entity.id);
      expect(compiled?.isCompiled).toBe(false);
      expect(compiled?.lastCompiled).toBeUndefined();
    });

    it('should clear compiled data', async () => {
      const testNodeId = await createResolverNode('clear-compile-node');
      const entity = await handler.createEntity(testNodeId, {
        name: 'Clear Compile Test',
      });

      await handler.compileMapping(entity.id);
      await handler.clearCompiledMapping(entity.id);

      const cleared = await handler.getEntity(entity.id);
      expect(cleared?.isCompiled).toBe(false);
      expect(cleared?.lastCompiled).toBeUndefined();
    });
  });

  describe('Entity Lifecycle', () => {
    it('should handle entity duplication', async () => {
      const testNodeId = await createResolverNode('dup-node');
      await handler.createEntity(testNodeId, {
        name: 'Original Resolver',
        sourceSchema: 'source',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            isRequired: true,
          },
        ],
      });

      const newNodeId = 'new-node-456' as NodeId;
      await coreDB.createNode({
        id: newNodeId,
        parentId: 'r:root' as NodeId,
        nodeType: 'resolver',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        metadata: { name: 'New', description: '', tags: [] },
        draftMetadata: null,
        data: null,
        draftData: undefined,
      } as TreeNode);
      const duplicate = await handler.duplicate(testNodeId, newNodeId);

      expect(duplicate.name).toBe('Original Resolver (Copy)');
      expect(duplicate.sourceSchema).toBe('source');
      expect(duplicate.mappingRules).toHaveLength(1);
    });

    it('should validate mapping configuration', async () => {
      const testNodeId = await createResolverNode('validate-node');
      const entity = await handler.createEntity(testNodeId, {
        name: 'Validation Test',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'sameProp',
            isRequired: true,
          },
          {
            id: 'rule2',
            sourceProperty: 'prop2',
            targetProperty: 'sameProp',
            isRequired: true,
          },
        ],
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Duplicate target property: sameProp');
    });
  });
});
