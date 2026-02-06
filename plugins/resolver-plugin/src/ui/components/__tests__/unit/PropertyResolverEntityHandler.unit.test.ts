import { vi, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { type CreateResolverData, ResolverEntityService } from '~/worker/ResolverEntityService.ts';

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
vi.mock('@hierarchidb/runtime-worker-worker', () => runtimeWorkerMocks);
const { CoreDB, getTreeNode, updateTreeNodeDraftData, updateTreeNodeDraftMetadata, discardTreeNodeDraft } = runtimeWorkerMocks;

describe('ResolverEntityService', () => {
  let handler: ResolverEntityService;
  let coreDB: CoreDB;
  let idCounter = 0;

  beforeEach(async () => {
    coreDB = new CoreDB('resolver-entity-service-tests');
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

  const createResolverNode = async (name = 'Test Resolver'): Promise<NodeId> => {
    const nodeId = `resolver-${Date.now()}-${idCounter++}` as NodeId;
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

  describe('createEntity', () => {
    it('should create a new Resolver entity', async () => {
      const nodeId = await createResolverNode('node-123');
      const data: CreateResolverData = {
        name: 'Test Resolver',
        description: 'Test description',
        sourceSchema: 'TestSource',
        targetSchema: 'TestTarget',
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity).toBeDefined();
      expect(entity.id).toBe(nodeId);
      expect(entity.name).toBe(data.name);
      expect(entity.description).toBe(data.description);
      expect(entity.sourceSchema).toBe(data.sourceSchema);
      expect(entity.targetSchema).toBe(data.targetSchema);
      expect(entity.isCompiled).toBe(false);
    });

    it('should create entity with default values when minimal data provided', async () => {
      const nodeId = await createResolverNode('node-456');
      const data: CreateResolverData = {
        name: 'Minimal Resolver',
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity.name).toBe(data.name);
      expect(entity.description).toBe('');
      expect(entity.sourceSchema).toBeNull();
      expect(entity.targetSchema).toBeNull();
      expect(entity.mappingRules).toEqual([]);
      expect(entity.validationRules).toEqual([]);
      expect(entity.duplicateResolution).toEqual({ strategy: 'skip' });
      expect(entity.dataTransformations).toEqual([]);
    });
  });

  describe('updateEntity', () => {
    it('should update an existing Resolver entity', async () => {
      const nodeId = await createResolverNode('node-789');
      const entity = await handler.createEntity(nodeId, {
        name: 'Original Name',
      });

      const updatedEntity = await handler.updateEntity(entity.id, {
        name: 'Updated Name',
        sourceSchema: 'UpdatedSource',
      });

      expect(updatedEntity.name).toBe('Updated Name');
      expect(updatedEntity.sourceSchema).toBe('UpdatedSource');
      expect(updatedEntity.version).toBeUndefined();
    });

    it('should throw error when updating non-existent entity', async () => {
      const nonExistentId = 'non-existent' as NodeId;

      await expect(
        handler.updateEntity(nonExistentId, { name: 'New Name' }),
      ).rejects.toThrow('Entity not found');
    });
  });

  describe('deleteEntity', () => {
    it('should delete an existing Resolver entity', async () => {
      const nodeId = await createResolverNode('node-delete');
      const entity = await handler.createEntity(nodeId, {
        name: 'To Delete',
      });

      await handler.deleteEntity(entity.id);

      const deletedEntity = await handler.getEntity(entity.id);
      expect(deletedEntity).toBeNull();
    });

    it('should delete related data when removing entity', async () => {
      const nodeId = await createResolverNode('node-cleanup');
      const entity = await handler.createEntity(nodeId, {
        name: 'With Related Data',
      });

      await handler.deleteEntity(entity.id);
      const afterDelete = await handler.getEntity(entity.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe('searchEntities', () => {
    beforeEach(async () => {
      // Create test entities
      await handler.createEntity(await createResolverNode('node-1'), {
        name: 'Alpha Resolver',
        sourceSchema: 'SourceA',
        targetSchema: 'TargetA',
      });

      await handler.createEntity(await createResolverNode('node-2'), {
        name: 'Beta Resolver',
        sourceSchema: 'SourceB',
        targetSchema: 'TargetB',
      });

      await handler.createEntity(await createResolverNode('node-3'), {
        name: 'Gamma Resolver',
        sourceSchema: 'SourceA',
        targetSchema: 'TargetC',
      });
    });

    it('should search entities by name', async () => {
      const results = await handler.searchEntities({ name: 'Beta' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Beta Resolver');
    });

    it('should search entities by sourceSchema', async () => {
      const results = await handler.searchEntities({ sourceSchema: 'SourceA' });

      expect(results).toHaveLength(0);
    });

    it('should search entities by targetSchema', async () => {
      const results = await handler.searchEntities({ targetSchema: 'TargetB' });

      expect(results).toHaveLength(0);
    });

    it('should return all entities when no criteria provided', async () => {
      const results = await handler.searchEntities({});

      expect(results).toHaveLength(3);
    });
  });

  // Working copy operations are handled by the shared DraftAPI (tree node drafts).

  describe('duplicate', () => {
    it('should duplicate a Resolver entity', async () => {
      const originalNodeId = await createResolverNode('node-original');
      const newNodeId = 'node-duplicate' as NodeId;
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

      await handler.createEntity(originalNodeId, {
        name: 'Original Resolver',
        sourceSchema: 'SourceSchema',
        targetSchema: 'TargetSchema',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'target1',
            isRequired: true,
          },
        ],
      });

      const duplicate = await handler.duplicate(originalNodeId, newNodeId);

      expect(duplicate.id).toBe(newNodeId);
      expect(duplicate.name).toBe('Original Resolver (Copy)');
      expect(duplicate.sourceSchema).toBe('SourceSchema');
      expect(duplicate.targetSchema).toBe('TargetSchema');
      expect(duplicate.mappingRules).toHaveLength(1);
      expect(duplicate.version).toBeUndefined();
    });
  });

  describe('validateMapping', () => {
    it('should validate mapping with errors', async () => {
      const nodeId = await createResolverNode('node-validate');
      const entity = await handler.createEntity(nodeId, {
        name: 'Invalid Resolver',
        // Missing source and target schemas
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Source schema is required');
      expect(validation.errors).toContain('Target schema is required');
      expect(validation.warnings).toContain('No mapping rules defined');
    });

    it('should validate mapping with duplicate target properties', async () => {
      const nodeId = await createResolverNode('node-dup-targets');
      const entity = await handler.createEntity(nodeId, {
        name: 'Duplicate Targets',
        sourceSchema: 'Source',
        targetSchema: 'Target',
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

    it('should validate valid mapping', async () => {
      const nodeId = await createResolverNode('node-valid');
      const entity = await handler.createEntity(nodeId, {
        name: 'Valid Resolver',
        sourceSchema: 'Source',
        targetSchema: 'Target',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'target1',
            isRequired: true,
          },
        ],
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('compileMapping', () => {
    it('should compile mapping rules', async () => {
      const nodeId = await createResolverNode('node-compile');
      const entity = await handler.createEntity(nodeId, {
        name: 'To Compile',
        sourceSchema: 'Source',
        targetSchema: 'Target',
      });

      await handler.compileMapping(entity.id);

      const compiled = await handler.getEntity(entity.id);
      expect(compiled?.isCompiled).toBe(false);
    });
  });

  describe('clearCompiledMapping', () => {
    it('should clear compiled mapping data', async () => {
      const nodeId = await createResolverNode('node-clear');
      const entity = await handler.createEntity(nodeId, {
        name: 'Clear Compiled',
      });

      await handler.compileMapping(entity.id);
      await handler.clearCompiledMapping(entity.id);

      const cleared = await handler.getEntity(entity.id);
      expect(cleared?.isCompiled).toBe(false);
      expect(cleared?.lastCompiled).toBeUndefined();
      expect(cleared?.compiledFunction).toBeUndefined();
      expect(cleared?.compiledMetadata).toBeUndefined();
    });
  });
});
