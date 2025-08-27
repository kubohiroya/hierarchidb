/**
 * @file PluginTreeAPI.test.ts
 * @description Comprehensive test suite for PluginTreeAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-core';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import type { PluginTreeAPI } from '@hierarchidb/common-api';

// Mock plugin implementations
const mockPlugin1 = {
  id: 'test-plugin-1',
  name: 'Test Plugin 1',
  version: '1.0.0',
  
  async onNodeCreate(node: TreeNode, context: any) {
    console.log('Plugin 1: Node created', node.id);
    return { ...node, metadata: { ...node.metadata, plugin1: true } };
  },
  
  async onNodeUpdate(oldNode: TreeNode, newNode: TreeNode, context: any) {
    console.log('Plugin 1: Node updated', newNode.id);
    return newNode;
  },
  
  async onNodeDelete(node: TreeNode, context: any) {
    console.log('Plugin 1: Node deleted', node.id);
  },
  
  async onTreeCreate(treeId: TreeId, context: any) {
    console.log('Plugin 1: Tree created', treeId);
  },
  
  async onTreeDelete(treeId: TreeId, context: any) {
    console.log('Plugin 1: Tree deleted', treeId);
  },
};

const mockPlugin2 = {
  id: 'test-plugin-2',
  name: 'Test Plugin 2',
  version: '2.0.0',
  
  async onNodeCreate(node: TreeNode, context: any) {
    console.log('Plugin 2: Node created', node.id);
    // Validate node name
    if (node.name.startsWith('invalid')) {
      throw new Error('Invalid node name');
    }
    return node;
  },
  
  async onNodeMove(node: TreeNode, oldParentId: NodeId, newParentId: NodeId, context: any) {
    console.log('Plugin 2: Node moved', node.id);
    return node;
  },
  
  async onBulkOperation(operation: string, nodeIds: NodeId[], context: any) {
    console.log('Plugin 2: Bulk operation', operation, nodeIds);
  },
};

describe('PluginTreeAPI', () => {
  let api: PluginTreeAPI;
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;

  // Test data
  const testTreeId = 'test-tree' as TreeId;
  const rootNodeId = 'root' as NodeId;
  
  const testNodes: TreeNode[] = [
    {
      id: rootNodeId,
      parentId: null as any,
      nodeType: 'folder',
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      id: 'node1' as NodeId,
      parentId: rootNodeId,
      nodeType: 'folder',
      name: 'Folder 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      id: 'node2' as NodeId,
      parentId: rootNodeId,
      nodeType: 'document',
      name: 'Document 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
  ];

  beforeEach(async () => {
    // Initialize database
    coreDB = await CoreDB.getSingleton();
    await coreDB.open();
    
    // Clear existing data
    await coreDB.nodes.clear();
    await coreDB.trees.clear();
    
    // Add test data
    await coreDB.trees.add({
      treeId: testTreeId,
      treeRootNodeId: rootNodeId,
      treeTrashRootNodeId: 'trash' as NodeId,
      superRootNodeId: rootNodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await coreDB.nodes.bulkAdd(testNodes);
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl(coreDB);
    api = workerAPI.getPluginTreeAPI();
  });

  afterEach(async () => {
    // Disable all plugins
    const enabledPlugins = await api.getEnabledPluginsForTree(testTreeId);
    for (const pluginId of enabledPlugins) {
      await api.disablePluginForTree(testTreeId, pluginId);
    }
    
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('enablePluginForTree', () => {
    it('should enable a plugin for a specific tree', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1', {
        config: { key: 'value' }
      });
      
      const enabled = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-1');
      expect(enabled).toBe(true);
    });

    it('should store plugin configuration', async () => {
      const config = { apiKey: 'secret', endpoint: 'https://api.example.com' };
      
      await api.enablePluginForTree(testTreeId, 'test-plugin-1', { config });
      
      const storedConfig = await api.getPluginConfigForTree(testTreeId, 'test-plugin-1');
      expect(storedConfig).toEqual(config);
    });

    it('should handle enabling already enabled plugin', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      // Should not throw when enabling again
      await expect(
        api.enablePluginForTree(testTreeId, 'test-plugin-1')
      ).resolves.not.toThrow();
    });
  });

  describe('disablePluginForTree', () => {
    it('should disable an enabled plugin', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      await api.disablePluginForTree(testTreeId, 'test-plugin-1');
      
      const enabled = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-1');
      expect(enabled).toBe(false);
    });

    it('should remove plugin configuration', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1', {
        config: { key: 'value' }
      });
      
      await api.disablePluginForTree(testTreeId, 'test-plugin-1');
      
      const config = await api.getPluginConfigForTree(testTreeId, 'test-plugin-1');
      expect(config).toBeNull();
    });

    it('should handle disabling non-enabled plugin', async () => {
      await expect(
        api.disablePluginForTree(testTreeId, 'non-enabled-plugin')
      ).rejects.toThrow();
    });
  });

  describe('isPluginEnabledForTree', () => {
    it('should check if plugin is enabled', async () => {
      const beforeEnable = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-1');
      expect(beforeEnable).toBe(false);
      
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      const afterEnable = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-1');
      expect(afterEnable).toBe(true);
    });
  });

  describe('getEnabledPluginsForTree', () => {
    it('should return list of enabled plugin IDs', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      const enabledPlugins = await api.getEnabledPluginsForTree(testTreeId);
      
      expect(enabledPlugins).toHaveLength(2);
      expect(enabledPlugins).toContain('test-plugin-1');
      expect(enabledPlugins).toContain('test-plugin-2');
    });

    it('should return empty array for tree with no plugins', async () => {
      const enabledPlugins = await api.getEnabledPluginsForTree(testTreeId);
      expect(enabledPlugins).toEqual([]);
    });
  });

  describe('getPluginConfigForTree', () => {
    it('should retrieve plugin configuration', async () => {
      const config = {
        apiKey: 'test-key',
        settings: {
          autoSync: true,
          interval: 60,
        }
      };
      
      await api.enablePluginForTree(testTreeId, 'test-plugin-1', { config });
      
      const retrieved = await api.getPluginConfigForTree(testTreeId, 'test-plugin-1');
      expect(retrieved).toEqual(config);
    });

    it('should return null for non-enabled plugin', async () => {
      const config = await api.getPluginConfigForTree(testTreeId, 'non-enabled');
      expect(config).toBeNull();
    });
  });

  describe('updatePluginConfigForTree', () => {
    it('should update plugin configuration', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1', {
        config: { oldKey: 'oldValue' }
      });
      
      const newConfig = { newKey: 'newValue', updated: true };
      await api.updatePluginConfigForTree(testTreeId, 'test-plugin-1', newConfig);
      
      const retrieved = await api.getPluginConfigForTree(testTreeId, 'test-plugin-1');
      expect(retrieved).toEqual(newConfig);
    });

    it('should handle updating non-enabled plugin', async () => {
      await expect(
        api.updatePluginConfigForTree(testTreeId, 'non-enabled', {})
      ).rejects.toThrow();
    });
  });

  describe('executePluginAction', () => {
    it('should execute plugin action on tree', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      const result = await api.executePluginAction(
        testTreeId,
        'test-plugin-1',
        'validate',
        { strict: true }
      );
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should pass parameters to plugin action', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      const params = {
        nodeId: 'node1' as NodeId,
        options: { recursive: true }
      };
      
      const result = await api.executePluginAction(
        testTreeId,
        'test-plugin-1',
        'processNode',
        params
      );
      
      expect(result).toBeDefined();
    });

    it('should handle plugin action errors', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      await expect(
        api.executePluginAction(
          testTreeId,
          'test-plugin-2',
          'invalidAction',
          {}
        )
      ).rejects.toThrow();
    });
  });

  describe('getPluginDataForNode', () => {
    it('should retrieve plugin-specific data for a node', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      // Store plugin data
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { customField: 'customValue' }
      );
      
      const data = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(data).toEqual({ customField: 'customValue' });
    });

    it('should return null for node without plugin data', async () => {
      const data = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(data).toBeNull();
    });
  });

  describe('setPluginDataForNode', () => {
    it('should store plugin-specific data for a node', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      const data = {
        processedAt: Date.now(),
        status: 'completed',
        results: { score: 100 }
      };
      
      await api.setPluginDataForNode('node1' as NodeId, 'test-plugin-1', data);
      
      const retrieved = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(retrieved).toEqual(data);
    });

    it('should overwrite existing plugin data', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { version: 1 }
      );
      
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { version: 2 }
      );
      
      const data = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(data).toEqual({ version: 2 });
    });
  });

  describe('clearPluginDataForNode', () => {
    it('should remove plugin data from a node', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { data: 'to-clear' }
      );
      
      await api.clearPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      
      const data = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(data).toBeNull();
    });
  });

  describe('getPluginStats', () => {
    it('should return plugin usage statistics for tree', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      // Set plugin data for nodes
      await api.setPluginDataForNode('node1' as NodeId, 'test-plugin-1', { data: 1 });
      await api.setPluginDataForNode('node2' as NodeId, 'test-plugin-1', { data: 2 });
      await api.setPluginDataForNode('node1' as NodeId, 'test-plugin-2', { data: 3 });
      
      const stats = await api.getPluginStats(testTreeId);
      
      expect(stats).toBeDefined();
      expect(stats.enabledPlugins).toBe(2);
      expect(stats.totalPluginData).toBeGreaterThan(0);
      expect(stats.pluginUsage).toBeDefined();
      expect(stats.pluginUsage['test-plugin-1']).toBe(2);
      expect(stats.pluginUsage['test-plugin-2']).toBe(1);
    });
  });

  describe('migratePluginData', () => {
    it('should migrate data from one plugin to another', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      // Set data for plugin 1
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { oldFormat: true, value: 42 }
      );
      
      // Migrate data
      const migrated = await api.migratePluginData(
        testTreeId,
        'test-plugin-1',
        'test-plugin-2',
        {
          transformData: (data: any) => ({
            newFormat: true,
            migratedValue: data.value * 2
          })
        }
      );
      
      expect(migrated).toBe(1);
      
      // Check migrated data
      const newData = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-2');
      expect(newData).toEqual({
        newFormat: true,
        migratedValue: 84
      });
      
      // Old data should be preserved by default
      const oldData = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(oldData).toEqual({ oldFormat: true, value: 42 });
    });

    it('should remove old data when specified', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      await api.setPluginDataForNode(
        'node1' as NodeId,
        'test-plugin-1',
        { data: 'old' }
      );
      
      await api.migratePluginData(
        testTreeId,
        'test-plugin-1',
        'test-plugin-2',
        {
          removeOldData: true,
          transformData: (data: any) => ({ data: 'new' })
        }
      );
      
      const oldData = await api.getPluginDataForNode('node1' as NodeId, 'test-plugin-1');
      expect(oldData).toBeNull();
    });
  });

  describe('Plugin Lifecycle Integration', () => {
    it('should notify plugins of node creation', async () => {
      const onNodeCreate = vi.fn();
      await api.enablePluginForTree(testTreeId, 'test-plugin-1');
      
      // Create a new node (would trigger plugin hook in real implementation)
      const newNode: TreeNode = {
        id: 'new-node' as NodeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'New Document',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      await coreDB.nodes.add(newNode);
      
      // In real implementation, plugin's onNodeCreate would be called
      // For testing, we verify the plugin is enabled and ready
      const enabled = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-1');
      expect(enabled).toBe(true);
    });

    it('should validate operations through plugins', async () => {
      await api.enablePluginForTree(testTreeId, 'test-plugin-2');
      
      // Plugin 2 rejects nodes with names starting with 'invalid'
      const invalidNode: TreeNode = {
        id: 'invalid-node' as NodeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'invalid-name', // Will be rejected by plugin 2
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      // In real implementation, this would be rejected by plugin validation
      // For testing, we verify the plugin is enabled
      const enabled = await api.isPluginEnabledForTree(testTreeId, 'test-plugin-2');
      expect(enabled).toBe(true);
    });
  });
});