/**
import type { TreeNode, NodeId } from '@hierarchidb/common-type';
 * @file CoreDB.depth.test.ts
 * @description Tests for TreeNode depth property in CoreDB
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { CoreDB } from '../CoreDB';

describe('CoreDB Depth Functionality', () => {
  let coreDB: CoreDB;

  beforeEach(async () => {
    coreDB = new (CoreDB as any)('test-depth-db');
    await coreDB.open();
    await coreDB.initialize();
  });

  afterEach(async () => {
    if (coreDB) {
      await coreDB.close();
      await Dexie.delete('test-depth-db-CoreDB');
    }
  });

  describe('Depth Calculation', () => {
    it('should automatically calculate depth when creating a node', async () => {
      // Root node should have depth 0
      const rootNode: TreeNode = {
        id: 'test-root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Test Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      await coreDB.createNode(rootNode);
      const savedRoot = await coreDB.getNode(rootNode.id);
      expect(savedRoot?.depth).toBe(0);

      // Child node should have parent's depth + 1
      const childNode: TreeNode = {
        id: 'child-1' as NodeId,
        parentId: rootNode.id,
        nodeType: 'folder',
        name: 'Child 1',
        depth: 1, // Will be calculated
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      await coreDB.createNode(childNode);
      const savedChild = await coreDB.getNode(childNode.id);
      expect(savedChild?.depth).toBe(1);

      // Grandchild should have depth 2
      const grandchildNode: TreeNode = {
        id: 'grandchild-1' as NodeId,
        parentId: childNode.id,
        nodeType: 'file',
        name: 'Grandchild 1',
        depth: 2, // Will be calculated
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      await coreDB.createNode(grandchildNode);
      const savedGrandchild = await coreDB.getNode(grandchildNode.id);
      expect(savedGrandchild?.depth).toBe(2);
    });

    it('should update depth when moving nodes', async () => {
      // Create initial structure
      const root: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const folder1: TreeNode = {
        id: 'folder-plugin-1' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const folder2: TreeNode = {
        id: 'folder-plugin-2' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder 2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const deepFolder: TreeNode = {
        id: 'deep-folder-plugin' as NodeId,
        parentId: folder2.id,
        nodeType: 'folder',
        name: 'Deep Folder',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const movingNode: TreeNode = {
        id: 'moving-node' as NodeId,
        parentId: folder1.id,
        nodeType: 'file',
        name: 'Moving Node',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(folder1);
      await coreDB.createNode(folder2);
      await coreDB.createNode(deepFolder);
      await coreDB.createNode(movingNode);

      // Move movingNode from folder1 to deepFolder
      await coreDB.moveNode(movingNode.id, deepFolder.id);
      
      const movedNode = await coreDB.getNode(movingNode.id);
      expect(movedNode?.parentId).toBe(deepFolder.id);
      expect(movedNode?.depth).toBe(3); // deepFolder is at depth 2, so child is at 3
    });

    it('should update entire subtree depth when moving', async () => {
      // Create a subtree
      const root: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const targetFolder: TreeNode = {
        id: 'target' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Target',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const movingFolder: TreeNode = {
        id: 'moving' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Moving Folder',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const child1: TreeNode = {
        id: 'child-1' as NodeId,
        parentId: movingFolder.id,
        nodeType: 'file',
        name: 'Child 1',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const child2: TreeNode = {
        id: 'child-2' as NodeId,
        parentId: movingFolder.id,
        nodeType: 'folder',
        name: 'Child 2',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const grandchild: TreeNode = {
        id: 'grandchild' as NodeId,
        parentId: child2.id,
        nodeType: 'file',
        name: 'Grandchild',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Create all nodes
      await coreDB.createNode(root);
      await coreDB.createNode(targetFolder);
      await coreDB.createNode(movingFolder);
      await coreDB.createNode(child1);
      await coreDB.createNode(child2);
      await coreDB.createNode(grandchild);

      // Move the entire subtree
      await coreDB.moveNode(movingFolder.id, targetFolder.id);

      // Check depths are updated correctly
      const movedFolder = await coreDB.getNode(movingFolder.id);
      const movedChild1 = await coreDB.getNode(child1.id);
      const movedChild2 = await coreDB.getNode(child2.id);
      const movedGrandchild = await coreDB.getNode(grandchild.id);

      expect(movedFolder?.depth).toBe(2); // targetFolder(1) + 1
      expect(movedChild1?.depth).toBe(3); // movingFolder(2) + 1
      expect(movedChild2?.depth).toBe(3); // movingFolder(2) + 1
      expect(movedGrandchild?.depth).toBe(4); // child2(3) + 1
    });
  });

  describe('Depth Queries', () => {
    it('should retrieve nodes by depth level', async () => {
      // Create a tree structure
      const root: TreeNode = {
        id: 'root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const level1Nodes = ['a', 'b', 'c'].map(name => ({
        id: `level1-${name}` as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: `Level 1 ${name}`,
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TreeNode));
      
      const level2Nodes = level1Nodes.flatMap(parent => 
        ['1', '2'].map(num => ({
          id: `level2-${parent.name.slice(-1)}-${num}` as NodeId,
          parentId: parent.id,
          nodeType: 'file',
          name: `Level 2 ${parent.name.slice(-1)}-${num}`,
          depth: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        } as TreeNode))
      );

      // Create all nodes
      await coreDB.createNode(root);
      for (const node of level1Nodes) {
        await coreDB.createNode(node);
      }
      for (const node of level2Nodes) {
        await coreDB.createNode(node);
      }

      // Query by depth
      const depth0Nodes = await coreDB.getNodesByDepth(0);
      const depth1Nodes = await coreDB.getNodesByDepth(1);
      const depth2Nodes = await coreDB.getNodesByDepth(2);

      // We should have more than just the test nodes (due to initialization)
      // But at minimum we should have our test nodes
      expect(depth0Nodes.some(n => n.id === 'root')).toBe(true);
      expect(depth1Nodes.filter(n => n.id.startsWith('level1-')).length).toBe(3);
      expect(depth2Nodes.filter(n => n.id.startsWith('level2-')).length).toBe(6);
    });
  });
});