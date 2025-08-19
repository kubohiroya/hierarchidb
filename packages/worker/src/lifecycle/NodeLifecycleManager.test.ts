import type { TreeNode, TreeNodeId, TreeNodeType } from '@hierarchidb/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { SimpleNodeTypeRegistry } from '~/registry';
import type { NodeTypeDefinition } from './types';

// Mock implementations
class MockCoreDB {
  nodes = new Map<TreeNodeId, TreeNode>();

  async transaction(mode: string, tables: any, fn: Function) {
    return fn();
  }

  async createNode(nodeData: Partial<TreeNode>): Promise<TreeNodeId> {
    const nodeId = `node-${Date.now()}-${Math.random()}` as TreeNodeId;
    this.nodes.set(nodeId, { ...nodeData, treeNodeId: nodeId } as TreeNode);
    return nodeId;
  }

  async getNode(nodeId: TreeNodeId): Promise<TreeNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async updateNode(nodeId: TreeNodeId, data: Partial<TreeNode>): Promise<void> {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      this.nodes.set(nodeId, { ...existing, ...data });
    }
  }

  async deleteNode(nodeId: TreeNodeId): Promise<void> {
    this.nodes.delete(nodeId);
  }
}

describe('NodeLifecycleManager', () => {
  let lifecycleManager: NodeLifecycleManager;
  let registry: SimpleNodeTypeRegistry;
  let coreDB: MockCoreDB;
  let ephemeralDB: any;

  // Track hook calls
  const hookCalls = {
    beforeCreate: vi.fn(),
    afterCreate: vi.fn(),
    beforeUpdate: vi.fn(),
    afterUpdate: vi.fn(),
    beforeDelete: vi.fn(),
    afterDelete: vi.fn(),
    beforeMove: vi.fn(),
    afterMove: vi.fn(),
    onLoad: vi.fn(),
    onUnload: vi.fn(),
  };

  beforeEach(() => {
    // Reset mocks
    Object.values(hookCalls).map((fn) => fn.mockClear());

    coreDB = new MockCoreDB();
    ephemeralDB = {};
    registry = new SimpleNodeTypeRegistry();

    lifecycleManager = new NodeLifecycleManager(registry, coreDB as any, ephemeralDB as any);
  });

  describe('executeLifecycleHook', () => {
    it('should execute hook when defined', async () => {
      const nodeType = 'testType' as TreeNodeType;

      // Register node type with hooks
      const definition: Partial<NodeTypeDefinition> = {
        nodeType,
        lifecycle: {
          beforeCreate: hookCalls.beforeCreate,
          afterCreate: hookCalls.afterCreate,
        },
      };

      registry.registerNodeType(nodeType, {
        lifecycle: definition.lifecycle,
      } as any);

      // Execute hook
      const parentId = 'parent-1' as TreeNodeId;
      const nodeData = { name: 'Test Node' };

      await lifecycleManager.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);

      expect(hookCalls.beforeCreate).toHaveBeenCalledWith(parentId, nodeData);
      expect(hookCalls.afterCreate).not.toHaveBeenCalled();
    });

    it('should not throw when hook is not defined', async () => {
      const nodeType = 'noHooks' as TreeNodeType;

      // Register without hooks
      registry.registerNodeType(nodeType, {});

      await expect(
        lifecycleManager.executeLifecycleHook(
          'beforeCreate',
          nodeType,
          'parent-1' as TreeNodeId,
          {}
        )
      ).resolves.not.toThrow();
    });

    it('should not throw when node type is not registered', async () => {
      await expect(
        lifecycleManager.executeLifecycleHook(
          'beforeCreate',
          'unregistered' as TreeNodeType,
          'parent-1' as TreeNodeId,
          {}
        )
      ).resolves.not.toThrow();
    });
  });

  describe('handleNodeCreation', () => {
    it('should execute beforeCreate and afterCreate hooks', async () => {
      const nodeType = 'folder' as TreeNodeType;
      const parentId = 'parent-1' as TreeNodeId;
      const nodeData = {
        name: 'New Folder',
        treeNodeType: nodeType,
      };

      // Register with hooks
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: hookCalls.beforeCreate,
          afterCreate: hookCalls.afterCreate,
        },
      } as any);

      const nodeId = await lifecycleManager.handleNodeCreation(parentId, nodeData, nodeType);

      expect(nodeId).toBeDefined();
      expect(hookCalls.beforeCreate).toHaveBeenCalledWith(parentId, nodeData);
      expect(hookCalls.afterCreate).toHaveBeenCalledWith(nodeId);

      // Verify node was created
      const node = await coreDB.getNode(nodeId);
      expect(node).toBeDefined();
      expect(node?.name).toBe('New Folder');
    });

    it('should create node even if hooks fail', async () => {
      const nodeType = 'folder' as TreeNodeType;
      const failingHook = vi.fn().mockRejectedValue(new Error('Hook failed'));

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: failingHook,
        },
      } as any);

      const nodeId = await lifecycleManager.handleNodeCreation(
        'parent-1' as TreeNodeId,
        { name: 'Test', treeNodeType: nodeType },
        nodeType
      );

      expect(nodeId).toBeDefined();
      expect(failingHook).toHaveBeenCalled();
    });
  });

  describe('handleNodeUpdate', () => {
    it('should execute beforeUpdate and afterUpdate hooks', async () => {
      const nodeType = 'file' as TreeNodeType;

      // Create initial node and get its ID
      const nodeId = await coreDB.createNode({
        name: 'Original',
        treeNodeType: nodeType,
      });

      // Register with hooks
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeUpdate: hookCalls.beforeUpdate,
          afterUpdate: hookCalls.afterUpdate,
        },
      } as any);

      const updates = { name: 'Updated' };
      await lifecycleManager.handleNodeUpdate(nodeId, updates, nodeType);

      expect(hookCalls.beforeUpdate).toHaveBeenCalledWith(nodeId, updates);
      expect(hookCalls.afterUpdate).toHaveBeenCalledWith(nodeId, updates);

      // Verify update
      const node = await coreDB.getNode(nodeId);
      expect(node?.name).toBe('Updated');
    });
  });

  describe('handleNodeDeletion', () => {
    it('should execute beforeDelete and afterDelete hooks', async () => {
      const nodeType = 'file' as TreeNodeType;
      const nodeId = 'node-2' as TreeNodeId;

      // Create node
      await coreDB.createNode({
        treeNodeId: nodeId,
        name: 'To Delete',
        treeNodeType: nodeType,
      });

      // Register with hooks
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeDelete: hookCalls.beforeDelete,
          afterDelete: hookCalls.afterDelete,
        },
      } as any);

      await lifecycleManager.handleNodeDeletion(nodeId, nodeType);

      expect(hookCalls.beforeDelete).toHaveBeenCalledWith(nodeId);
      expect(hookCalls.afterDelete).toHaveBeenCalledWith(nodeId);

      // Verify deletion
      const node = await coreDB.getNode(nodeId);
      expect(node).toBeUndefined();
    });

    it('should handle cascading deletes', async () => {
      const parentType = 'folder' as TreeNodeType;
      const childType = 'file' as TreeNodeType;

      const parentId = await coreDB.createNode({
        name: 'Parent',
        treeNodeType: parentType,
      });

      const childId = await coreDB.createNode({
        name: 'Child',
        parentTreeNodeId: parentId,
        treeNodeType: childType,
      });

      // Register with cascade delete
      registry.registerNodeType(parentType, {
        lifecycle: {
          beforeDelete: async (nodeId: TreeNodeId) => {
            // Cascade delete children
            hookCalls.beforeDelete(nodeId);
            // In real implementation, this would find and delete children
          },
        },
      } as any);

      await lifecycleManager.handleNodeDeletion(parentId, parentType);

      expect(hookCalls.beforeDelete).toHaveBeenCalledWith(parentId);
    });
  });

  describe('handleNodeMove', () => {
    it('should execute beforeMove and afterMove hooks', async () => {
      const nodeType = 'folder' as TreeNodeType;
      const oldParentId = 'old-parent' as TreeNodeId;
      const newParentId = 'new-parent' as TreeNodeId;

      // Create node
      const nodeId = await coreDB.createNode({
        parentTreeNodeId: oldParentId,
        name: 'Moving Node',
        treeNodeType: nodeType,
      });

      // Register with hooks
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeMove: hookCalls.beforeMove,
          afterMove: hookCalls.afterMove,
        },
      } as any);

      await lifecycleManager.handleNodeMove(nodeId, oldParentId, newParentId, nodeType);

      expect(hookCalls.beforeMove).toHaveBeenCalledWith(nodeId, oldParentId, newParentId);
      expect(hookCalls.afterMove).toHaveBeenCalledWith(nodeId, oldParentId, newParentId);

      // Verify move
      const node = await coreDB.getNode(nodeId);
      expect(node?.parentTreeNodeId).toBe(newParentId);
    });

    it('should validate move operation', async () => {
      const nodeType = 'file' as TreeNodeType;
      const nodeId = 'node-4' as TreeNodeId;

      // Register with validation hook and stopOnError
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeMove: async (id: TreeNodeId, oldParent: TreeNodeId, newParent: TreeNodeId) => {
            if (newParent === ('invalid' as TreeNodeId)) {
              throw new Error('Invalid target');
            }
          },
          stopOnError: true,
        },
      } as any);

      await expect(
        lifecycleManager.handleNodeMove(
          nodeId,
          'old-parent' as TreeNodeId,
          'invalid' as TreeNodeId,
          nodeType
        )
      ).rejects.toThrow('Invalid target');
    });
  });

  describe('handleNodeLoad/Unload', () => {
    it('should execute onLoad hook when node is loaded', async () => {
      const nodeType = 'document' as TreeNodeType;
      const nodeId = 'node-5' as TreeNodeId;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          onLoad: hookCalls.onLoad,
        },
      } as any);

      await lifecycleManager.handleNodeLoad(nodeId, nodeType);

      expect(hookCalls.onLoad).toHaveBeenCalledWith(nodeId);
    });

    it('should execute onUnload hook when node is unloaded', async () => {
      const nodeType = 'document' as TreeNodeType;
      const nodeId = 'node-6' as TreeNodeId;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          onUnload: hookCalls.onUnload,
        },
      } as any);

      await lifecycleManager.handleNodeUnload(nodeId, nodeType);

      expect(hookCalls.onUnload).toHaveBeenCalledWith(nodeId);
    });
  });

  describe('batch operations', () => {
    it('should handle batch creates with hooks', async () => {
      const nodeType = 'file' as TreeNodeType;
      const parentId = 'parent-1' as TreeNodeId;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: hookCalls.beforeCreate,
          afterCreate: hookCalls.afterCreate,
        },
      } as any);

      const nodes = [
        { name: 'File 1', treeNodeType: nodeType },
        { name: 'File 2', treeNodeType: nodeType },
        { name: 'File 3', treeNodeType: nodeType },
      ];

      const nodeIds = await lifecycleManager.handleBatchCreate(parentId, nodes, nodeType);

      expect(nodeIds).toHaveLength(3);
      expect(hookCalls.beforeCreate).toHaveBeenCalledTimes(3);
      expect(hookCalls.afterCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle batch deletes with hooks', async () => {
      const nodeType = 'file' as TreeNodeType;

      // Create nodes
      const nodeIds = await Promise.all([
        coreDB.createNode({ name: 'File 1', treeNodeType: nodeType }),
        coreDB.createNode({ name: 'File 2', treeNodeType: nodeType }),
        coreDB.createNode({ name: 'File 3', treeNodeType: nodeType }),
      ]);

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeDelete: hookCalls.beforeDelete,
          afterDelete: hookCalls.afterDelete,
        },
      } as any);

      await lifecycleManager.handleBatchDelete(nodeIds, nodeType);

      expect(hookCalls.beforeDelete).toHaveBeenCalledTimes(3);
      expect(hookCalls.afterDelete).toHaveBeenCalledTimes(3);

      // Verify all deleted
      for (const nodeId of nodeIds) {
        const node = await coreDB.getNode(nodeId);
        expect(node).toBeUndefined();
      }
    });
  });

  describe('error handling', () => {
    it('should continue processing on hook errors by default', async () => {
      const nodeType = 'file' as TreeNodeType;
      const errorHook = vi.fn().mockRejectedValue(new Error('Hook error'));

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: errorHook,
          afterCreate: hookCalls.afterCreate,
        },
      } as any);

      const nodeId = await lifecycleManager.handleNodeCreation(
        'parent-1' as TreeNodeId,
        { name: 'Test', treeNodeType: nodeType },
        nodeType
      );

      expect(nodeId).toBeDefined();
      expect(errorHook).toHaveBeenCalled();
      expect(hookCalls.afterCreate).toHaveBeenCalled();
    });

    it('should stop on critical errors when configured', async () => {
      const nodeType = 'critical' as TreeNodeType;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: async () => {
            throw new Error('Critical validation failed');
          },
          stopOnError: true,
        },
      } as any);

      // Create a lifecycle manager that will handle critical errors
      const strictManager = new NodeLifecycleManager(registry, coreDB as any, ephemeralDB as any);

      await expect(
        strictManager.handleNodeCreation(
          'parent-1' as TreeNodeId,
          { name: 'Test', treeNodeType: nodeType },
          nodeType
        )
      ).rejects.toThrow('Critical validation failed');
    });
  });
});
