/**
import type { NodeId, TreeId, TreeNode, SubscriptionId, TreeNodeEvent } from '@hierarchidb/common-type';
 * @file TreeSubscriptionAPI.test.ts  
 * @description Comprehensive test suite for TreeSubscriptionAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import type { TreeSubscriptionAPI } from '@hierarchidb/common-api';

describe('TreeSubscriptionAPI', () => {
  let api: TreeSubscriptionAPI;
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
    {
      id: 'node1-1' as NodeId,
      parentId: 'node1' as NodeId,
      nodeType: 'document',
      name: 'Nested Document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
  ];

  beforeEach(async () => {
    // Initialize database
    coreDB = CoreDB.getSingleton();
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
    api = workerAPI.getSubscriptionAPI();
  });

  afterEach(async () => {
    // Clean up all subscriptions
    await api.unsubscribeAll();
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('subscribeNode', () => {
    it('should subscribe to node changes', async () => {
      const events: TreeNodeEvent[] = [];
      
      const subscriptionId = await api.subscribeNode(
        'node1' as NodeId,
        (event) => {
          events.push(event);
        }
      );
      
      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
      
      // Trigger an update
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'Updated Name',
          version: node.version + 1,
        });
      }
      
      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updated');
      expect(events[0].nodeId).toBe('node1');
    });

    it('should provide initial value when requested', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeNode(
        'node1' as NodeId,
        (event) => {
          events.push(event);
        },
        { includeMetadata: true }
      );
      
      // Wait for initial event
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updated');
      expect(events[0].node).toBeDefined();
      expect(events[0].node?.name).toBe('Folder 1');
    });

    it('should handle node deletion', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeNode(
        'node2' as NodeId,
        (event) => {
          events.push(event);
        }
      );
      
      // Delete the node
      await coreDB.nodes.delete('node2' as NodeId);
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('deleted');
      expect(events[0].nodeId).toBe('node2');
    });
  });

  describe('subscribeSubtree', () => {
    it('should subscribe to all changes in subtree', async () => {
      const events: TreeNodeEvent[] = [];
      
      const subscriptionId = await api.subscribeSubtree(
        rootNodeId,
        (event) => {
          events.push(event);
        }
      );
      
      expect(subscriptionId).toBeDefined();
      
      // Update multiple nodes in subtree
      const node1 = await coreDB.nodes.get('node1' as NodeId);
      if (node1) {
        await coreDB.updateNode({
          ...node1,
          name: 'Updated Folder',
          version: node1.version + 1,
        });
      }
      
      const node11 = await coreDB.nodes.get('node1-1' as NodeId);
      if (node11) {
        await coreDB.updateNode({
          ...node11,
          name: 'Updated Nested',
          version: node11.version + 1,
        });
      }
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events).toHaveLength(2);
      expect(events.map(e => e.nodeId).sort()).toEqual(['node1', 'node1-1'].sort());
    });

    it('should respect depth limit', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeSubtree(
        rootNodeId,
        (event) => {
          events.push(event);
        },
        { depth: 1 }
      );
      
      // Update node at depth 1
      const node1 = await coreDB.nodes.get('node1' as NodeId);
      if (node1) {
        await coreDB.updateNode({
          ...node1,
          name: 'Depth 1 Update',
          version: node1.version + 1,
        });
      }
      
      // Update node at depth 2 (should not trigger event)
      const node11 = await coreDB.nodes.get('node1-1' as NodeId);
      if (node11) {
        await coreDB.updateNode({
          ...node11,
          name: 'Depth 2 Update',
          version: node11.version + 1,
        });
      }
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events).toHaveLength(1);
      expect(events[0].nodeId).toBe('node1');
    });

    it('should filter by node types', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeSubtree(
        rootNodeId,
        (event) => {
          events.push(event);
        },
        { includeTypes: ['document'] }
      );
      
      // Update folder-plugin (should not trigger)
      const folder = await coreDB.nodes.get('node1' as NodeId);
      if (folder) {
        await coreDB.updateNode({
          ...folder,
          name: 'Updated Folder',
          version: folder.version + 1,
        });
      }
      
      // Update document (should trigger)
      const doc = await coreDB.nodes.get('node2' as NodeId);
      if (doc) {
        await coreDB.updateNode({
          ...doc,
          name: 'Updated Document',
          version: doc.version + 1,
        });
      }
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events).toHaveLength(1);
      expect(events[0].nodeId).toBe('node2');
    });
  });

  describe('subscribeTree', () => {
    it('should subscribe to all changes in tree', async () => {
      const events: TreeNodeEvent[] = [];
      
      const subscriptionId = await api.subscribeTree(
        testTreeId,
        (event) => {
          events.push(event);
        }
      );
      
      expect(subscriptionId).toBeDefined();
      
      // Update any node in tree
      const node = await coreDB.nodes.get('node2' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'TreeTypes Update',
          version: node.version + 1,
        });
      }
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updated');
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', async () => {
      const events: TreeNodeEvent[] = [];
      
      const subscriptionId = await api.subscribeNode(
        'node1' as NodeId,
        (event) => {
          events.push(event);
        }
      );
      
      // First update should be received
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'First Update',
          version: node.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(events).toHaveLength(1);
      
      // Unsubscribe
      await api.unsubscribe(subscriptionId);
      
      // Second update should not be received
      const updatedNode = await coreDB.nodes.get('node1' as NodeId);
      if (updatedNode) {
        await coreDB.updateNode({
          ...updatedNode,
          name: 'Second Update',
          version: updatedNode.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(events).toHaveLength(1); // Still only 1 event
    });
  });

  describe('unsubscribeNode', () => {
    it('should remove all subscriptions for a node', async () => {
      const events1: TreeNodeEvent[] = [];
      const events2: TreeNodeEvent[] = [];
      
      // Create multiple subscriptions for same node
      await api.subscribeNode('node1' as NodeId, (e) => events1.push(e));
      await api.subscribeNode('node1' as NodeId, (e) => events2.push(e));
      
      // Remove all subscriptions for the node
      const removed = await api.unsubscribeNode('node1' as NodeId);
      expect(removed).toBe(2);
      
      // Update should not trigger any events
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'After Unsubscribe',
          version: node.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(events1).toHaveLength(0);
      expect(events2).toHaveLength(0);
    });
  });

  describe('unsubscribeTree', () => {
    it('should remove all subscriptions for a tree', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeTree(testTreeId, (e) => events.push(e));
      
      const removed = await api.unsubscribeTree(testTreeId);
      expect(removed).toBeGreaterThan(0);
      
      // Updates should not trigger events
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'After TreeTypes Unsubscribe',
          version: node.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(events).toHaveLength(0);
    });
  });

  describe('unsubscribeAll', () => {
    it('should remove all active subscriptions', async () => {
      // Create multiple subscriptions
      await api.subscribeNode('node1' as NodeId, () => {});
      await api.subscribeNode('node2' as NodeId, () => {});
      await api.subscribeSubtree(rootNodeId, () => {});
      
      const removed = await api.unsubscribeAll();
      expect(removed).toBe(3);
      
      // Verify no active subscriptions
      const active = await api.listActiveSubscriptions();
      expect(active).toHaveLength(0);
    });
  });

  describe('listActiveSubscriptions', () => {
    it('should return list of active subscription IDs', async () => {
      const id1 = await api.subscribeNode('node1' as NodeId, () => {});
      const id2 = await api.subscribeNode('node2' as NodeId, () => {});
      
      const active = await api.listActiveSubscriptions();
      
      expect(active).toHaveLength(2);
      expect(active).toContain(id1);
      expect(active).toContain(id2);
    });
  });

  describe('isSubscriptionActive', () => {
    it('should check if subscription is active', async () => {
      const subscriptionId = await api.subscribeNode('node1' as NodeId, () => {});
      
      const isActive = await api.isSubscriptionActive(subscriptionId);
      expect(isActive).toBe(true);
      
      await api.unsubscribe(subscriptionId);
      
      const isActiveAfter = await api.isSubscriptionActive(subscriptionId);
      expect(isActiveAfter).toBe(false);
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return subscription statistics', async () => {
      // Create various subscriptions
      await api.subscribeNode('node1' as NodeId, () => {});
      await api.subscribeNode('node2' as NodeId, () => {});
      await api.subscribeSubtree(rootNodeId, () => {});
      await api.subscribeTree(testTreeId, () => {});
      
      const stats = await api.getSubscriptionStats();
      
      expect(stats.totalActive).toBe(4);
      expect(stats.nodeSubscriptions).toBe(2);
      expect(stats.subtreeSubscriptions).toBe(1);
      expect(stats.treeSubscriptions).toBe(1);
      expect(stats.eventsProcessedToday).toBeGreaterThanOrEqual(0);
      expect(stats.averageEventLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRecentEvents', () => {
    it('should retrieve recent events for a node', async () => {
      // Subscribe and generate events
      await api.subscribeNode('node1' as NodeId, () => {});
      
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        // Generate multiple events
        for (let i = 0; i < 5; i++) {
          await coreDB.updateNode({
            ...node,
            name: `Update ${i}`,
            version: node.version + i + 1,
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const recentEvents = await api.getRecentEvents('node1' as NodeId, 3);
      
      expect(recentEvents).toHaveLength(3);
      expect(recentEvents[0].timestamp).toBeLessThanOrEqual(recentEvents[1].timestamp);
    });
  });

  describe('getEventHistory', () => {
    it('should retrieve events within time range', async () => {
      const startTime = Date.now();
      
      // Subscribe and generate events
      await api.subscribeNode('node1' as NodeId, () => {});
      
      const node = await coreDB.nodes.get('node1' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          name: 'Event in Range',
          version: node.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const endTime = Date.now();
      
      const events = await api.getEventHistory(
        startTime,
        endTime,
        'node1' as NodeId
      );
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].nodeId).toBe('node1');
      expect(events[0].timestamp).toBeGreaterThanOrEqual(startTime);
      expect(events[0].timestamp).toBeLessThanOrEqual(endTime);
    });

    it('should return empty array for no events in range', async () => {
      const events = await api.getEventHistory(
        Date.now() - 1000000,
        Date.now() - 900000
      );
      
      expect(events).toEqual([]);
    });
  });

  describe('Event Types', () => {
    it('should handle created event', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeSubtree(
        rootNodeId,
        (event) => {
          events.push(event);
        }
      );
      
      // Create new node
      await coreDB.nodes.add({
        id: 'new-node' as NodeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'New Node',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('created');
      expect(events[0].nodeId).toBe('new-node');
    });

    it('should handle moved event', async () => {
      const events: TreeNodeEvent[] = [];
      
      await api.subscribeNode(
        'node2' as NodeId,
        (event) => {
          events.push(event);
        }
      );
      
      // Move node
      const node = await coreDB.nodes.get('node2' as NodeId);
      if (node) {
        await coreDB.updateNode({
          ...node,
          parentId: 'node1' as NodeId,
          version: node.version + 1,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('moved');
      expect(events[0].parentId).toBe('node1');
      expect(events[0].previousParentNodeId).toBe(rootNodeId);
    });
  });
});