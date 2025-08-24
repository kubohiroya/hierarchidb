import type { TreeNode, NodeId, NodeType } from '@hierarchidb/common-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { SimpleNodeTypeRegistry } from '~/registry';
import type { NodeTypeDefinition } from './types';

// Mock implementations
class MockCoreDB {
  nodes = new Map<NodeId, TreeNode>();

  async transaction(mode: string, tables: any, fn: Function) {
    return fn();
  }

  async createNode(nodeData: Partial<TreeNode>): Promise<NodeId> {
    const nodeId = `node-${Date.now()}-${Math.random()}` as NodeId;
    this.nodes.set(nodeId, { ...nodeData, id: nodeId } as TreeNode);
    return nodeId;
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async updateNode(nodeId: NodeId, data: Partial<TreeNode>): Promise<void> {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      this.nodes.set(nodeId, { ...existing, ...data });
    }
  }

  async deleteNode(nodeId: NodeId): Promise<void> {
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
      const nodeType = 'testType' as NodeType;

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
      const parentId = 'parent-1' as NodeId;
      const nodeData = { name: 'Test Node' };

      await lifecycleManager.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);

      expect(hookCalls.beforeCreate).toHaveBeenCalledWith(parentId, nodeData);
      expect(hookCalls.afterCreate).not.toHaveBeenCalled();
    });

    it('should not throw when hook is not defined', async () => {
      const nodeType = 'noHooks' as NodeType;

      // Register without hooks
      registry.registerNodeType(nodeType, {});

      await expect(
        lifecycleManager.executeLifecycleHook('beforeCreate', nodeType, 'parent-1' as NodeId, {})
      ).resolves.not.toThrow();
    });

    it('should not throw when node type is not registered', async () => {
      await expect(
        lifecycleManager.executeLifecycleHook(
          'beforeCreate',
          'unregistered' as NodeType,
          'parent-1' as NodeId,
          {}
        )
      ).resolves.not.toThrow();
    });
  });

  describe('handleNodeCreation', () => {
    it('should execute beforeCreate and afterCreate hooks', async () => {
      const nodeType = 'folder' as NodeType;
      const parentId = 'parent-1' as NodeId;
      const nodeData = {
        name: 'New Folder',
        nodeType: nodeType,
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
      const nodeType = 'folder' as NodeType;
      const failingHook = vi.fn().mockRejectedValue(new Error('Hook failed'));

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: failingHook,
        },
      } as any);

      const nodeId = await lifecycleManager.handleNodeCreation(
        'parent-1' as NodeId,
        { name: 'Test', nodeType: nodeType },
        nodeType
      );

      expect(nodeId).toBeDefined();
      expect(failingHook).toHaveBeenCalled();
    });
  });

  describe('handleNodeUpdate', () => {
    it('should execute beforeUpdate and afterUpdate hooks', async () => {
      const nodeType = 'file' as NodeType;

      // Create initial node and get its ID
      const nodeId = await coreDB.createNode({
        name: 'Original',
        nodeType: nodeType,
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
      const nodeType = 'file' as NodeType;
      const nodeId = 'node-2' as NodeId;

      // Create node
      await coreDB.createNode({
        id: nodeId,
        name: 'To Delete',
        nodeType: nodeType,
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
      const parentType = 'folder' as NodeType;
      const childType = 'file' as NodeType;

      const parentId = await coreDB.createNode({
        name: 'Parent',
        nodeType: parentType,
      });

      const childId = await coreDB.createNode({
        name: 'Child',
        parentId: parentId,
        nodeType: childType,
      });

      // Register with cascade delete
      registry.registerNodeType(parentType, {
        lifecycle: {
          beforeDelete: async (nodeId: NodeId) => {
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
      const nodeType = 'folder' as NodeType;
      const oldParentId = 'old-parent' as NodeId;
      const newParentId = 'new-parent' as NodeId;

      // Create node
      const nodeId = await coreDB.createNode({
        parentId: oldParentId,
        name: 'Moving Node',
        nodeType: nodeType,
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
      expect(node?.parentId).toBe(newParentId);
    });

    it('should validate move operation', async () => {
      const nodeType = 'file' as NodeType;
      const nodeId = 'node-4' as NodeId;

      // Register with validation hook and stopOnError
      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeMove: async (id: NodeId, oldParent: NodeId, newParent: NodeId) => {
            if (newParent === ('invalid' as NodeId)) {
              throw new Error('Invalid target');
            }
          },
          stopOnError: true,
        },
      } as any);

      await expect(
        lifecycleManager.handleNodeMove(
          nodeId,
          'old-parent' as NodeId,
          'invalid' as NodeId,
          nodeType
        )
      ).rejects.toThrow('Invalid target');
    });
  });

  describe('handleNodeLoad/Unload', () => {
    it('should execute onLoad hook when node is loaded', async () => {
      const nodeType = 'document' as NodeType;
      const nodeId = 'node-5' as NodeId;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          onLoad: hookCalls.onLoad,
        },
      } as any);

      await lifecycleManager.handleNodeLoad(nodeId, nodeType);

      expect(hookCalls.onLoad).toHaveBeenCalledWith(nodeId);
    });

    it('should execute onUnload hook when node is unloaded', async () => {
      const nodeType = 'document' as NodeType;
      const nodeId = 'node-6' as NodeId;

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
      const nodeType = 'file' as NodeType;
      const parentId = 'parent-1' as NodeId;

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: hookCalls.beforeCreate,
          afterCreate: hookCalls.afterCreate,
        },
      } as any);

      const nodes = [
        { name: 'File 1', nodeType: nodeType },
        { name: 'File 2', nodeType: nodeType },
        { name: 'File 3', nodeType: nodeType },
      ];

      const nodeIds = await lifecycleManager.handleBatchCreate(parentId, nodes, nodeType);

      expect(nodeIds).toHaveLength(3);
      expect(hookCalls.beforeCreate).toHaveBeenCalledTimes(3);
      expect(hookCalls.afterCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle batch deletes with hooks', async () => {
      const nodeType = 'file' as NodeType;

      // Create nodes
      const nodeIds = await Promise.all([
        coreDB.createNode({ name: 'File 1', nodeType: nodeType }),
        coreDB.createNode({ name: 'File 2', nodeType: nodeType }),
        coreDB.createNode({ name: 'File 3', nodeType: nodeType }),
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
      const nodeType = 'file' as NodeType;
      const errorHook = vi.fn().mockRejectedValue(new Error('Hook error'));

      registry.registerNodeType(nodeType, {
        lifecycle: {
          beforeCreate: errorHook,
          afterCreate: hookCalls.afterCreate,
        },
      } as any);

      const nodeId = await lifecycleManager.handleNodeCreation(
        'parent-1' as NodeId,
        { name: 'Test', nodeType: nodeType },
        nodeType
      );

      expect(nodeId).toBeDefined();
      expect(errorHook).toHaveBeenCalled();
      expect(hookCalls.afterCreate).toHaveBeenCalled();
    });

    it('should stop on critical errors when configured', async () => {
      const nodeType = 'critical' as NodeType;

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
          'parent-1' as NodeId,
          { name: 'Test', nodeType: nodeType },
          nodeType
        )
      ).rejects.toThrow('Critical validation failed');
    });
  });
});
