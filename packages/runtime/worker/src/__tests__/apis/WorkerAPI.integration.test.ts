/**
 * @file WorkerAPI.integration.test.ts
 * @description Integration test suite for WorkerAPI and all specialized APIs
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-core';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import { EphemeralDB } from '../../db/EphemeralDB';

describe('WorkerAPI Integration Tests', () => {
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;
  let ephemeralDB: EphemeralDB;

  // Test data
  const testTreeId = 'test-tree' as TreeId;
  const rootNodeId = 'root' as NodeId;

  beforeEach(async () => {
    // Initialize databases
    coreDB = CoreDB.getSingleton();
    ephemeralDB = EphemeralDB.getSingleton();
    await coreDB.open();
    await ephemeralDB.open();
    
    // Clear existing data
    await coreDB.nodes.clear();
    await coreDB.trees.clear();
    await ephemeralDB.workingCopies.clear();
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl(coreDB);
    
    // Create test tree
    await coreDB.trees.add({
      treeId: testTreeId,
      treeRootNodeId: rootNodeId,
      treeTrashRootNodeId: 'trash' as NodeId,
      superRootNodeId: rootNodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Create root node
    await coreDB.nodes.add({
      id: rootNodeId,
      parentId: null as any,
      nodeType: 'folder',
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
  });

  afterEach(async () => {
    await coreDB.close();
    await ephemeralDB.close();
    vi.clearAllMocks();
  });

  describe('API Access', () => {
    it('should provide access to all specialized APIs', () => {
      expect(workerAPI.getQueryAPI()).toBeDefined();
      expect(workerAPI.getMutationAPI()).toBeDefined();
      expect(workerAPI.getSubscriptionAPI()).toBeDefined();
      expect(workerAPI.getNodeTypeAPI()).toBeDefined();
      expect(workerAPI.getPluginTreeAPI()).toBeDefined();
      expect(workerAPI.getPluginManagementAPI()).toBeDefined();
      expect(workerAPI.getPluginRegistryAPI()).toBeDefined();
      expect(workerAPI.getPluginAPI()).toBeDefined();
    });
  });

  describe('Cross-API Workflow: Node Management', () => {
    it('should support complete node lifecycle', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      const subscriptionAPI = workerAPI.getSubscriptionAPI();
      
      const events: any[] = [];
      
      // 1. Subscribe to changes
      const subscriptionId = await subscriptionAPI.subscribeNode(
        rootNodeId,
        (event) => events.push(event)
      );
      
      // 2. Create node
      const newNode = await mutationAPI.createNode({
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'Test Document',
        description: 'Integration test document',
      });
      
      // 3. Query the node
      const queriedNode = await queryAPI.getNode(newNode.nodeId);
      expect(queriedNode).toBeDefined();
      expect(queriedNode?.name).toBe('Test Document');
      
      // 4. Update the node
      const updatedNode = await mutationAPI.updateNode(newNode.nodeId, {
        name: 'Updated Document',
      });
      expect(updatedNode.name).toBe('Updated Document');
      expect(updatedNode.version).toBe(2);
      
      // 5. Query children
      const children = await queryAPI.getChildren(rootNodeId);
      expect(children).toHaveLength(1);
      expect(children[0].nodeId).toBe(newNode.nodeId);
      
      // 6. Delete node
      const deleteResult = await mutationAPI.deleteNode(newNode.nodeId);
      expect(deleteResult.success).toBe(true);
      
      // 7. Verify deletion
      const deletedNode = await queryAPI.getNode(newNode.nodeId);
      expect(deletedNode).toBeNull();
      
      // 8. Cleanup subscription
      await subscriptionAPI.unsubscribe(subscriptionId);
    });
  });

  describe('Cross-API Workflow: Working Copy Operations', () => {
    it('should support working copy workflow', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      
      // 1. Create initial node
      const node = await mutationAPI.createNode({
        parentId: rootNodeId,
        nodeType: 'folder',
        name: 'Original Folder',
      });
      
      // 2. Create working copy
      const workingCopyId = await mutationAPI.createWorkingCopy(node.nodeId);
      expect(workingCopyId).toBeDefined();
      
      // 3. Update working copy
      await mutationAPI.updateWorkingCopy(workingCopyId, {
        name: 'Modified in Working Copy',
        description: 'Added description',
      });
      
      // 4. Original node should be unchanged
      const originalNode = await queryAPI.getNode(node.nodeId);
      expect(originalNode?.name).toBe('Original Folder');
      expect(originalNode?.description).toBeUndefined();
      
      // 5. Commit working copy
      const committedNode = await mutationAPI.commitWorkingCopy(workingCopyId);
      expect(committedNode.name).toBe('Modified in Working Copy');
      expect(committedNode.description).toBe('Added description');
      
      // 6. Verify changes are persisted
      const updatedNode = await queryAPI.getNode(node.nodeId);
      expect(updatedNode?.name).toBe('Modified in Working Copy');
      expect(updatedNode?.version).toBe(2);
    });
  });

  describe('Cross-API Workflow: Plugin Integration', () => {
    it('should integrate node types with plugins', async () => {
      const nodeTypeAPI = workerAPI.getNodeTypeAPI();
      const pluginManagementAPI = workerAPI.getPluginManagementAPI();
      const pluginTreeAPI = workerAPI.getPluginTreeAPI();
      
      // 1. Register a node type
      await nodeTypeAPI.registerNodeType({
        nodeType: 'custom',
        displayName: 'Custom Node',
        icon: '🔧',
        description: 'A custom node type',
        allowedChildTypes: [],
        entityHandler: {
          async create(nodeId, data) { return { id: nodeId, ...data }; },
          async read(nodeId) { return { id: nodeId }; },
          async update(nodeId, data) { return { id: nodeId, ...data }; },
          async delete(nodeId) { return true; },
          async validate(data) { return { valid: true, errors: [] }; },
        },
      });
      
      // 2. Install a mock plugin
      await pluginManagementAPI.installPlugin({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        author: 'Test',
        license: 'MIT',
        main: 'index.js',
        capabilities: ['node-processing'],
        permissions: ['read', 'write'],
      });
      
      // 3. Enable plugin for tree
      await pluginTreeAPI.enablePluginForTree(testTreeId, 'test-plugin', {
        config: { setting: 'value' }
      });
      
      // 4. Verify integrations
      const nodeTypes = await nodeTypeAPI.listNodeTypes();
      expect(nodeTypes).toContain('custom');
      
      const plugins = await pluginTreeAPI.getEnabledPluginsForTree(testTreeId);
      expect(plugins).toContain('test-plugin');
      
      const pluginConfig = await pluginTreeAPI.getPluginConfigForTree(testTreeId, 'test-plugin');
      expect(pluginConfig).toEqual({ setting: 'value' });
    });
  });

  describe('Cross-API Workflow: Search and Subscription', () => {
    it('should combine search with real-time updates', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      const subscriptionAPI = workerAPI.getSubscriptionAPI();
      
      const events: any[] = [];
      
      // 1. Create some test nodes
      const folder1 = await mutationAPI.createNode({
        parentId: rootNodeId,
        nodeType: 'folder',
        name: 'Project Alpha',
        description: 'Alpha project folder',
      });
      
      const doc1 = await mutationAPI.createNode({
        parentId: folder1.nodeId,
        nodeType: 'document',
        name: 'Alpha Design',
        description: 'Design document for alpha',
      });
      
      // 2. Subscribe to subtree changes
      const subscriptionId = await subscriptionAPI.subscribeSubtree(
        rootNodeId,
        (event) => events.push(event)
      );
      
      // 3. Search for nodes
      const searchResults = await queryAPI.searchNodes('Alpha', {
        searchInDescription: true,
      });
      
      expect(searchResults).toHaveLength(2);
      expect(searchResults.map(n => n.name)).toContain('Project Alpha');
      expect(searchResults.map(n => n.name)).toContain('Alpha Design');
      
      // 4. Update node (should trigger subscription)
      await mutationAPI.updateNode(doc1.nodeId, {
        name: 'Alpha Design v2',
      });
      
      // 5. Search again
      const updatedResults = await queryAPI.searchNodes('Alpha Design v2');
      expect(updatedResults).toHaveLength(1);
      expect(updatedResults[0].name).toBe('Alpha Design v2');
      
      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 6. Verify subscription received updates
      expect(events.length).toBeGreaterThan(0);
      
      await subscriptionAPI.unsubscribe(subscriptionId);
    });
  });

  describe('Cross-API Workflow: Bulk Operations', () => {
    it('should handle bulk operations across APIs', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      const subscriptionAPI = workerAPI.getSubscriptionAPI();
      
      const events: any[] = [];
      
      // 1. Subscribe to tree changes
      const subscriptionId = await subscriptionAPI.subscribeTree(
        testTreeId,
        (event) => events.push(event)
      );
      
      // 2. Create multiple nodes
      const nodes = await Promise.all([
        mutationAPI.createNode({
          parentId: rootNodeId,
          nodeType: 'document',
          name: 'Doc 1',
        }),
        mutationAPI.createNode({
          parentId: rootNodeId,
          nodeType: 'document',
          name: 'Doc 2',
        }),
        mutationAPI.createNode({
          parentId: rootNodeId,
          nodeType: 'folder',
          name: 'Folder 1',
        }),
      ]);
      
      // 3. Query all children
      const allChildren = await queryAPI.getChildren(rootNodeId);
      expect(allChildren).toHaveLength(3);
      
      // 4. Move multiple nodes to folder
      const folderNode = nodes[2];
      const docNodes = nodes.slice(0, 2);
      
      await mutationAPI.moveNodes(
        docNodes.map(n => n.nodeId),
        folderNode.nodeId
      );
      
      // 5. Verify move
      const folderChildren = await queryAPI.getChildren(folderNode.nodeId);
      expect(folderChildren).toHaveLength(2);
      
      const rootChildren = await queryAPI.getChildren(rootNodeId);
      expect(rootChildren).toHaveLength(1); // Only the folder remains
      
      // 6. Delete multiple nodes
      const deleteResult = await mutationAPI.deleteNodes([folderNode.nodeId]);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedCount).toBe(3); // Folder + 2 documents (cascaded)
      
      await subscriptionAPI.unsubscribe(subscriptionId);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle errors gracefully across APIs', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      
      // 1. Test non-existent operations
      await expect(queryAPI.getNode('non-existent' as NodeId)).resolves.toBeNull();
      await expect(mutationAPI.updateNode('non-existent' as NodeId, {})).rejects.toThrow();
      
      // 2. Test constraint violations
      await expect(
        mutationAPI.createNode({
          parentId: 'non-existent' as NodeId,
          nodeType: 'document',
          name: 'Orphan',
        })
      ).rejects.toThrow();
      
      // 3. Test working copy conflicts
      const node = await mutationAPI.createNode({
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'Conflict Test',
      });
      
      const workingCopy1 = await mutationAPI.createWorkingCopy(node.nodeId);
      const workingCopy2 = await mutationAPI.createWorkingCopy(node.nodeId);
      
      await mutationAPI.updateWorkingCopy(workingCopy1, { name: 'Version 1' });
      await mutationAPI.updateWorkingCopy(workingCopy2, { name: 'Version 2' });
      
      // First commit should succeed
      await mutationAPI.commitWorkingCopy(workingCopy1);
      
      // Second commit should fail due to version conflict
      await expect(
        mutationAPI.commitWorkingCopy(workingCopy2, { expectedVersion: 1 })
      ).rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      
      const startTime = Date.now();
      
      // 1. Create many nodes
      const nodeCount = 100;
      const promises = [];
      
      for (let i = 0; i < nodeCount; i++) {
        promises.push(
          mutationAPI.createNode({
            parentId: rootNodeId,
            nodeType: i % 2 === 0 ? 'folder' : 'document',
            name: `Node ${i}`,
            description: `Description for node ${i}`,
          })
        );
      }
      
      const nodes = await Promise.all(promises);
      expect(nodes).toHaveLength(nodeCount);
      
      // 2. Query operations should be efficient
      const queryStart = Date.now();
      
      const allChildren = await queryAPI.getChildren(rootNodeId);
      expect(allChildren).toHaveLength(nodeCount);
      
      const searchResults = await queryAPI.searchNodes('Node', {
        searchInDescription: false,
      });
      expect(searchResults).toHaveLength(nodeCount);
      
      const queryTime = Date.now() - queryStart;
      
      // 3. Bulk operations should be efficient
      const bulkStart = Date.now();
      
      const nodeStats = await queryAPI.getNodeCount({
        treeId: testTreeId,
      });
      expect(nodeStats).toBe(nodeCount + 1); // +1 for root
      
      const treeStats = await queryAPI.getTreeStats(testTreeId);
      expect(treeStats.totalNodes).toBe(nodeCount + 1);
      expect(treeStats.nodesByType.folder).toBeGreaterThan(0);
      expect(treeStats.nodesByType.document).toBeGreaterThan(0);
      
      const bulkTime = Date.now() - bulkStart;
      
      const totalTime = Date.now() - startTime;
      
      console.log('Performance metrics:', {
        totalTime: `${totalTime}ms`,
        queryTime: `${queryTime}ms`,
        bulkTime: `${bulkTime}ms`,
        nodesPerSecond: Math.round((nodeCount * 1000) / totalTime),
      });
      
      // Reasonable performance expectations
      expect(totalTime).toBeLessThan(5000); // 5 seconds total
      expect(queryTime).toBeLessThan(1000); // 1 second for queries
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistency across operations', async () => {
      const queryAPI = workerAPI.getQueryAPI();
      const mutationAPI = workerAPI.getMutationAPI();
      
      // 1. Create hierarchical structure
      const folder1 = await mutationAPI.createNode({
        parentId: rootNodeId,
        nodeType: 'folder',
        name: 'Folder 1',
      });
      
      const folder2 = await mutationAPI.createNode({
        parentId: folder1.nodeId,
        nodeType: 'folder',
        name: 'Folder 2',
      });
      
      const doc = await mutationAPI.createNode({
        parentId: folder2.nodeId,
        nodeType: 'document',
        name: 'Document',
      });
      
      // 2. Verify relationships
      const ancestors = await queryAPI.getAncestors(doc.nodeId);
      expect(ancestors).toHaveLength(2);
      expect(ancestors.map(a => a.nodeId)).toEqual([folder2.nodeId, folder1.nodeId]);
      
      const descendants = await queryAPI.listDescendants(rootNodeId);
      expect(descendants).toHaveLength(3);
      
      const path = await queryAPI.getPath(doc.nodeId);
      expect(path).toHaveLength(4); // root -> folder1 -> folder2 -> doc
      
      // 3. Move operations should maintain consistency
      await mutationAPI.moveNodes([doc.nodeId], rootNodeId);
      
      const newAncestors = await queryAPI.getAncestors(doc.nodeId);
      expect(newAncestors).toHaveLength(0); // Now direct child of root
      
      const newPath = await queryAPI.getPath(doc.nodeId);
      expect(newPath).toHaveLength(2); // root -> doc
      
      // 4. Delete operations should maintain consistency
      await mutationAPI.deleteNodes([folder1.nodeId], { recursive: true });
      
      const remainingChildren = await queryAPI.getChildren(rootNodeId);
      expect(remainingChildren).toHaveLength(1); // Only the moved document
      expect(remainingChildren[0].nodeId).toBe(doc.nodeId);
    });
  });
});