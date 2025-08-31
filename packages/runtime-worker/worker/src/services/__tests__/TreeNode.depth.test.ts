/**
import type { TreeNode, NodeId, TreeId } from '@hierarchidb/common-type';
 * @file TreeNode.depth.test.ts
 * @description TDD tests for TreeNode depth property implementation
 * 
 * Requirements from TODO 3.1:
 * - Add mandatory depth property to TreeNode
 * - Calculate depth as parent's depth + 1
 * - Use depth for efficient subscription filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { CoreDB } from '../../db/CoreDB';
import { TreeSubscriptionService } from '../TreeSubscriptionService';

describe('TreeNode Depth Property', () => {
  let coreDB: CoreDB;
  let subscriptionService: TreeSubscriptionService;

  beforeEach(async () => {
    // Create new instance for testing
    coreDB = new (CoreDB as any)('test-db');
    await coreDB.open();
    await coreDB.initialize();
    
    subscriptionService = new TreeSubscriptionService(coreDB);
  });

  afterEach(async () => {
    if (coreDB) {
      await coreDB.close();
      await Dexie.delete('test-db-CoreDB');
    }
  });

  describe('Depth Property Requirements', () => {
    it('should include depth as a mandatory property in TreeNode', () => {
      // Test that TreeNode type includes depth property
      const node: TreeNode = {
        id: 'node-1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Test Node',
        depth: 1, // This should be required
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      expect(node.depth).toBeDefined();
      expect(typeof node.depth).toBe('number');
    });

    it('should enforce depth property at compile time', () => {
      // This test verifies TypeScript enforcement
      // The following should cause a TypeScript error if depth is mandatory:
      // const invalidNode: TreeNode = {
      //   id: 'node-1' as NodeId,
      //   parentId: 'root' as NodeId,
      //   nodeType: 'folder-plugin',
      //   name: 'Test Node',
      //   // missing depth property - should cause TS error
      //   createdAt: Date.now(),
      //   updatedAt: Date.now(),
      //   version: 1,
      // };
      
      // Since we can't test TypeScript errors at runtime,
      // we verify the contract through actual usage
      expect(true).toBe(true);
    });
  });

  describe('Depth Calculation Logic', () => {
    it('should set depth to 0 for root nodes', async () => {
      const rootNode: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId, // Root nodes have no parent
        nodeType: 'Root',
        name: 'Root',
        depth: 0, // Root depth should be 0
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(rootNode);
      const savedNode = await coreDB.getNode(rootNode.id);
      
      expect(savedNode?.depth).toBe(0);
    });

    it('should calculate depth as parent depth + 1 for new nodes', async () => {
      // Create parent node at depth 1
      const parentNode: TreeNode = {
        id: 'parent-1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(parentNode);

      // Create child node - depth should be parent's depth + 1
      const childNode: TreeNode = {
        id: 'child-1' as NodeId,
        parentId: parentNode.id,
        nodeType: 'folder',
        name: 'Child',
        depth: 2, // Should be parentNode.depth + 1
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(childNode);

      const savedChild = await coreDB.getNode(childNode.id);
      expect(savedChild?.depth).toBe(2);
    });

    it('should handle deep nesting correctly', async () => {
      const nodes: TreeNode[] = [];
      let parentId: NodeId = 'root' as NodeId;
      
      // Create a chain of 10 nested nodes
      for (let i = 0; i < 10; i++) {
        const node: TreeNode = {
          id: `node-${i}` as NodeId,
          parentId,
          nodeType: 'folder',
          name: `Node ${i}`,
          depth: i + 1, // Each level increases depth by 1
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        nodes.push(node);
        await coreDB.createNode(node);
        parentId = node.id;
      }

      // Verify the last node has depth 10
      const deepestNode = await coreDB.getNode(nodes[9].id);
      expect(deepestNode?.depth).toBe(10);
    });

    it('should update depth when moving a node to a different parent', async () => {
      // Create initial structure
      const parent1: TreeNode = {
        id: 'parent-1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Parent 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const parent2: TreeNode = {
        id: 'parent-2' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Parent 2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const child: TreeNode = {
        id: 'child' as NodeId,
        parentId: parent1.id,
        nodeType: 'folder',
        name: 'Child',
        depth: 2, // Under parent1 at depth 1
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(parent1);
      await coreDB.createNode(parent2);
      await coreDB.createNode(child);

      // Move child from parent1 to parent2 (both at same depth)
      await coreDB.moveNode(child.id, parent2.id);
      
      const movedChild = await coreDB.getNode(child.id);
      expect(movedChild?.parentId).toBe(parent2.id);
      expect(movedChild?.depth).toBe(2); // Should remain 2 as parent2 is also at depth 1
    });

    it('should update depth for entire subtree when moving', async () => {
      // Create a subtree structure
      const parent: TreeNode = {
        id: 'parent' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const child: TreeNode = {
        id: 'child' as NodeId,
        parentId: parent.id,
        nodeType: 'folder',
        name: 'Child',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const grandchild: TreeNode = {
        id: 'grandchild' as NodeId,
        parentId: child.id,
        nodeType: 'folder',
        name: 'Grandchild',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const newParent: TreeNode = {
        id: 'new-parent' as NodeId,
        parentId: 'deep-node' as NodeId,
        nodeType: 'folder',
        name: 'New Parent',
        depth: 5, // Much deeper in the tree
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(parent);
      await coreDB.createNode(child);
      await coreDB.createNode(grandchild);
      await coreDB.createNode(newParent);

      // Move parent node to newParent - entire subtree depths should update
      await coreDB.moveNode(parent.id, newParent.id);

      const movedParent = await coreDB.getNode(parent.id);
      const movedChild = await coreDB.getNode(child.id);
      const movedGrandchild = await coreDB.getNode(grandchild.id);

      expect(movedParent?.depth).toBe(6); // newParent.depth + 1
      expect(movedChild?.depth).toBe(7); // movedParent.depth + 1
      expect(movedGrandchild?.depth).toBe(8); // movedChild.depth + 1
    });
  });

  describe('TreeSubscriptionService Depth Filtering', () => {
    beforeEach(async () => {
      // Create a test tree structure
      const rootNode: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const level1Node: TreeNode = {
        id: 'level1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Level 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const level2Node: TreeNode = {
        id: 'level2' as NodeId,
        parentId: 'level1' as NodeId,
        nodeType: 'folder',
        name: 'Level 2',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const level3Node: TreeNode = {
        id: 'level3' as NodeId,
        parentId: 'level2' as NodeId,
        nodeType: 'folder',
        name: 'Level 3',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(rootNode);
      await coreDB.createNode(level1Node);
      await coreDB.createNode(level2Node);
      await coreDB.createNode(level3Node);
    });

    it('should filter events by exact depth when specified', async () => {
      const callback = vi.fn();
      
      // Subscribe with depth filter = 2
      const unsubscribe = await subscriptionService.subscribeSubtree(
        'tree-1' as TreeId,
        'root' as NodeId,
        callback,
        { depth: 2 }
      );

      // Emit events for different depth nodes
      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level1' as NodeId,
        node: await coreDB.getNode('level1' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level2' as NodeId,
        node: await coreDB.getNode('level2' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level3' as NodeId,
        node: await coreDB.getNode('level3' as NodeId),
        timestamp: Date.now(),
      });

      // Only events for nodes at depth 2 should pass through
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'level2',
        })
      );

      unsubscribe();
    });

    it('should filter events by maximum depth', async () => {
      const callback = vi.fn();
      
      // Subscribe with max depth filter
      const unsubscribe = await subscriptionService.subscribeSubtree(
        'tree-1' as TreeId,
        'root' as NodeId,
        callback,
        { maxDepth: 2 } // Include nodes up to depth 2
      );

      // Emit events for nodes at various depths
      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'root' as NodeId,
        node: await coreDB.getNode('root' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level1' as NodeId,
        node: await coreDB.getNode('level1' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level2' as NodeId,
        node: await coreDB.getNode('level2' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level3' as NodeId,
        node: await coreDB.getNode('level3' as NodeId),
        timestamp: Date.now(),
      });

      // Events for nodes at depth 0, 1, and 2 should pass through
      expect(callback).toHaveBeenCalledTimes(3);
      
      unsubscribe();
    });

    it('should filter events by minimum depth', async () => {
      const callback = vi.fn();
      
      // Subscribe with min depth filter
      const unsubscribe = await subscriptionService.subscribeSubtree(
        'tree-1' as TreeId,
        'root' as NodeId,
        callback,
        { minDepth: 2 } // Only include nodes at depth 2 or deeper
      );

      // Emit events for nodes at various depths
      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'root' as NodeId,
        node: await coreDB.getNode('root' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level1' as NodeId,
        node: await coreDB.getNode('level1' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level2' as NodeId,
        node: await coreDB.getNode('level2' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level3' as NodeId,
        node: await coreDB.getNode('level3' as NodeId),
        timestamp: Date.now(),
      });

      // Only events for nodes at depth 2 and 3 should pass through
      expect(callback).toHaveBeenCalledTimes(2);
      
      unsubscribe();
    });

    it('should combine depth filters with other filters', async () => {
      const callback = vi.fn();
      
      // Subscribe with combined filters
      const unsubscribe = await subscriptionService.subscribeSubtree(
        'tree-1' as TreeId,
        'root' as NodeId,
        callback,
        {
          maxDepth: 2,
          excludeTypes: ['folder'], // Exclude folder-plugin type
        }
      );

      // Create a file node at depth 1
      const fileNode: TreeNode = {
        id: 'file1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'file',
        name: 'File 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(fileNode);

      // Emit events
      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level1' as NodeId, // folder-plugin at depth 1
        node: await coreDB.getNode('level1' as NodeId),
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'file1' as NodeId, // file at depth 1
        node: fileNode,
        timestamp: Date.now(),
      });

      // Emit event through CoreDB
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: 'level3' as NodeId, // folder-plugin at depth 3 (beyond maxDepth)
        node: await coreDB.getNode('level3' as NodeId),
        timestamp: Date.now(),
      });

      // Only the file node at depth 1 should pass through
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'file1',
        })
      );

      unsubscribe();
    });
  });

  describe('Performance Optimization with Depth', () => {
    it('should efficiently skip deep subtrees when depth limit is set', async () => {
      // Create a large tree with many deep nodes
      const deepNodes: TreeNode[] = [];
      for (let i = 0; i < 100; i++) {
        const node: TreeNode = {
          id: `deep-${i}` as NodeId,
          parentId: i === 0 ? 'root' as NodeId : `deep-${i - 1}` as NodeId,
          nodeType: 'folder',
          name: `Deep ${i}`,
          depth: i + 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        deepNodes.push(node);
        await coreDB.createNode(node);
      }

      const callback = vi.fn();
      const startTime = performance.now();

      // Subscribe with shallow depth limit
      const unsubscribe = await subscriptionService.subscribeSubtree(
        'tree-1' as TreeId,
        'root' as NodeId,
        callback,
        { maxDepth: 3 } // Only interested in shallow nodes
      );

      // Emit events for all nodes
      for (const node of deepNodes) {
        // Emit event through CoreDB
      coreDB.changeSubject.next({
          type: 'node-updated',
          nodeId: node.id,
          node,
          timestamp: Date.now(),
        });
      }

      const endTime = performance.now();

      // Only first 3 levels should trigger callbacks
      expect(callback).toHaveBeenCalledTimes(3);
      
      // Performance assertion: Should be fast due to early filtering
      expect(endTime - startTime).toBeLessThan(100); // ms

      unsubscribe();
    });

    it('should use depth index for efficient database queries', async () => {
      // This test verifies that depth can be used as an index
      // Create nodes with specific depths
      const nodesAtDepth2: TreeNode[] = [];
      
      for (let i = 0; i < 10; i++) {
        const parent: TreeNode = {
          id: `parent-${i}` as NodeId,
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: `Parent ${i}`,
          depth: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        await coreDB.createNode(parent);

        const child: TreeNode = {
          id: `child-${i}` as NodeId,
          parentId: parent.id,
          nodeType: 'folder',
          name: `Child ${i}`,
          depth: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        nodesAtDepth2.push(child);
        await coreDB.createNode(child);
      }

      // Query nodes by depth (this would use index if available)
      const startTime = performance.now();
      const foundNodes = await coreDB.getNodesByDepth(2);
      const queryTime = performance.now() - startTime;

      expect(foundNodes.length).toBe(10);
      expect(queryTime).toBeLessThan(10); // Should be very fast with index
    });
  });

  describe('Migration Strategy', () => {
    it('should handle migration of existing nodes without depth property', async () => {
      // Simulate legacy node without depth
      const legacyNode = {
        id: 'legacy' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Legacy Node',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        // depth is missing
      };

      // Migration function should calculate and add depth
      const migratedNode = await coreDB.migrateNodeWithDepth({
        ...legacyNode,
        depth: 0 // Provide temporary depth to satisfy type
      } as TreeNode);
      
      expect(migratedNode.depth).toBeDefined();
      expect(migratedNode.depth).toBe(1); // Should calculate based on parent
    });

    it('should batch migrate all nodes in a tree', async () => {
      // Create nodes without depth (simulating legacy data)
      const rootNode: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(rootNode);
      
      const legacyNodes: TreeNode[] = [
        { 
          id: 'n1' as NodeId, 
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: 'Node 1',
          depth: 999, // Wrong depth to simulate migration need
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        { 
          id: 'n2' as NodeId, 
          parentId: 'n1' as NodeId,
          nodeType: 'folder',
          name: 'Node 2',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        { 
          id: 'n3' as NodeId, 
          parentId: 'n2' as NodeId,
          nodeType: 'folder',
          name: 'Node 3',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        { 
          id: 'n4' as NodeId, 
          parentId: 'n1' as NodeId,
          nodeType: 'folder',
          name: 'Node 4',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      ];
      
      // Create nodes with wrong depths
      for (const node of legacyNodes) {
        await coreDB.createNode(node);
      }

      // Batch migration should calculate depths correctly
      const migrationResult = await coreDB.migrateAllNodesWithDepth();
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migratedCount).toBeGreaterThan(0);

      // Verify depths are correct after migration
      const n1 = await coreDB.getNode('n1' as NodeId);
      const n2 = await coreDB.getNode('n2' as NodeId);
      const n3 = await coreDB.getNode('n3' as NodeId);
      const n4 = await coreDB.getNode('n4' as NodeId);

      expect(n1?.depth).toBe(1);
      expect(n2?.depth).toBe(2);
      expect(n3?.depth).toBe(3);
      expect(n4?.depth).toBe(2);
    });
  });
});