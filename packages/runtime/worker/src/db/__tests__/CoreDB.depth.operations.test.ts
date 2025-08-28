/**
 * @file CoreDB.depth.operations.test.ts
 * @description Comprehensive TDD tests for depth consistency in all operations
 * Tests: Import/Export, Duplicate, Restore from Trash, Copy/Paste, Undo/Redo
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { CoreDB } from '../CoreDB';
import { serializeTreeNode, deserializeTreeNode } from '@hierarchidb/common-core';
import type { TreeNode, NodeId } from '@hierarchidb/common-core';

describe('CoreDB Depth Operations Consistency', () => {
  let coreDB: CoreDB;

  beforeEach(async () => {
    coreDB = new (CoreDB as any)('test-operations-db');
    await coreDB.open();
    await coreDB.initialize();
  });

  afterEach(async () => {
    if (coreDB) {
      await coreDB.close();
      await Dexie.delete('test-operations-db-CoreDB');
    }
  });

  describe('Import/Export Depth Consistency', () => {
    it('should preserve depth information during export/import cycle', async () => {
      // Create a complex tree structure
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

      const level1: TreeNode = {
        id: 'level1' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Level 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const level2: TreeNode = {
        id: 'level2' as NodeId,
        parentId: level1.id,
        nodeType: 'folder',
        name: 'Level 2',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const level3: TreeNode = {
        id: 'level3' as NodeId,
        parentId: level2.id,
        nodeType: 'file',
        name: 'Level 3',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Create all nodes
      await coreDB.createNode(root);
      await coreDB.createNode(level1);
      await coreDB.createNode(level2);
      await coreDB.createNode(level3);

      // Export nodes
      const nodes = [root, level1, level2, level3];
      const serializedNodes = nodes.map(serializeTreeNode);

      // Simulate export/import cycle
      const exportedJson = JSON.stringify(serializedNodes);
      const importedData = JSON.parse(exportedJson);

      // Import and validate
      const deserializedNodes = importedData.map((data: any) => {
        // Ensure IDs are strings
        if (!data.id || typeof data.id !== 'string') {
          throw new Error('Invalid node ID in serialized data');
        }
        // Allow empty parentId for root nodes
        if (typeof data.parentId !== 'string') {
          throw new Error('Invalid parent ID in serialized data');
        }
        return deserializeTreeNode(data);
      });
      
      // Verify depths are preserved
      expect(deserializedNodes[0].depth).toBe(0); // root
      expect(deserializedNodes[1].depth).toBe(1); // level1
      expect(deserializedNodes[2].depth).toBe(2); // level2
      expect(deserializedNodes[3].depth).toBe(3); // level3
    });

    it('should recalculate depths correctly when importing nodes with incorrect depth data', async () => {
      // Create nodes with intentionally wrong depths
      const nodesWithWrongDepths: TreeNode[] = [
        {
          id: 'root' as NodeId,
          parentId: '' as NodeId,
          nodeType: 'Root',
          name: 'Root',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'child' as NodeId,
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: 'Child',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'grandchild' as NodeId,
          parentId: 'child' as NodeId,
          nodeType: 'file',
          name: 'Grandchild',
          depth: 999, // Wrong depth
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      ];

      // Import with depth validation
      await coreDB.importNodesWithDepthValidation(nodesWithWrongDepths);

      // Verify depths are corrected
      const rootNode = await coreDB.nodes.get('root' as NodeId);
      const childNode = await coreDB.nodes.get('child' as NodeId);
      const grandchildNode = await coreDB.nodes.get('grandchild' as NodeId);

      expect(rootNode?.depth).toBe(0);
      expect(childNode?.depth).toBe(1);
      expect(grandchildNode?.depth).toBe(2);
    });

    it('should handle backward compatibility with nodes missing depth property', async () => {
      // Simulate old export data without depth
      const legacyExportData = JSON.stringify([
        {
          id: 'legacy-root',
          parentId: '',
          nodeType: 'Root',
          name: 'Legacy Root',
          // No depth property
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'legacy-child',
          parentId: 'legacy-root',
          nodeType: 'folder',
          name: 'Legacy Child',
          // No depth property
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      ]);

      const importedData = JSON.parse(legacyExportData);
      const deserializedNodes = importedData.map((data: any) => {
        // Ensure IDs are strings for legacy data
        if (!data.id || typeof data.id !== 'string') {
          throw new Error('Invalid node ID in legacy data');
        }
        // Allow empty parentId for root nodes in legacy data
        if (typeof data.parentId !== 'string') {
          throw new Error('Invalid parent ID in legacy data');
        }
        return deserializeTreeNode(data);
      });

      // Verify default depths are assigned
      expect(deserializedNodes[0].depth).toBe(0); // Default for missing depth
      expect(deserializedNodes[1].depth).toBe(0); // Default for missing depth

      // Import and verify recalculation works
      await coreDB.importNodesWithDepthValidation(deserializedNodes);

      const rootNode = await coreDB.nodes.get('legacy-root' as NodeId);
      const childNode = await coreDB.nodes.get('legacy-child' as NodeId);

      expect(rootNode?.depth).toBe(0);
      expect(childNode?.depth).toBe(1); // Corrected during import
    });
  });

  describe('Duplicate Operations Depth Consistency', () => {
    it('should set correct depth when duplicating a single node', async () => {
      // Create original structure
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
        id: 'folder1' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepFolder: TreeNode = {
        id: 'deep' as NodeId,
        parentId: folder1.id,
        nodeType: 'folder',
        name: 'Deep Folder',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const originalFile: TreeNode = {
        id: 'file1' as NodeId,
        parentId: root.id,
        nodeType: 'file',
        name: 'Original File',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(folder1);
      await coreDB.createNode(deepFolder);
      await coreDB.createNode(originalFile);

      // Duplicate file to different depth levels
      const duplicatedId1 = await coreDB.duplicateNode(originalFile.id, root.id);
      const duplicatedId2 = await coreDB.duplicateNode(originalFile.id, deepFolder.id);

      // Verify depths are correct
      const duplicated1 = await coreDB.nodes.get(duplicatedId1);
      const duplicated2 = await coreDB.nodes.get(duplicatedId2);

      expect(duplicated1?.depth).toBe(1); // Under root (depth 0)
      expect(duplicated2?.depth).toBe(3); // Under deepFolder (depth 2)
      expect(duplicated1?.name).toContain('(Copy)');
      expect(duplicated2?.name).toContain('(Copy)');
    });

    it('should maintain correct depth hierarchy when duplicating subtrees', async () => {
      // Create source subtree
      const sourceRoot: TreeNode = {
        id: 'source-root' as NodeId,
        parentId: 'main-root' as NodeId,
        nodeType: 'folder',
        name: 'Source Root',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const sourceChild1: TreeNode = {
        id: 'source-child1' as NodeId,
        parentId: sourceRoot.id,
        nodeType: 'folder',
        name: 'Source Child 1',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const sourceChild2: TreeNode = {
        id: 'source-child2' as NodeId,
        parentId: sourceRoot.id,
        nodeType: 'file',
        name: 'Source Child 2',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const sourceGrandchild: TreeNode = {
        id: 'source-grandchild' as NodeId,
        parentId: sourceChild1.id,
        nodeType: 'file',
        name: 'Source Grandchild',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Create target location
      const mainRoot: TreeNode = {
        id: 'main-root' as NodeId,
        parentId: '' as NodeId,
        nodeType: 'Root',
        name: 'Main Root',
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const targetParent: TreeNode = {
        id: 'target-parent' as NodeId,
        parentId: mainRoot.id,
        nodeType: 'folder',
        name: 'Target Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepTarget: TreeNode = {
        id: 'deep-target' as NodeId,
        parentId: targetParent.id,
        nodeType: 'folder',
        name: 'Deep Target',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Create all nodes
      await coreDB.createNode(mainRoot);
      await coreDB.createNode(sourceRoot);
      await coreDB.createNode(sourceChild1);
      await coreDB.createNode(sourceChild2);
      await coreDB.createNode(sourceGrandchild);
      await coreDB.createNode(targetParent);
      await coreDB.createNode(deepTarget);

      // Duplicate subtree to deep target (depth 2)
      const duplicatedRootId = await coreDB.duplicateSubtree(sourceRoot.id, deepTarget.id);

      // Get all duplicated nodes
      const duplicatedRoot = await coreDB.nodes.get(duplicatedRootId);
      expect(duplicatedRoot?.depth).toBe(3); // deepTarget(2) + 1

      const duplicatedChildren = await coreDB.listChildren(duplicatedRootId);
      expect(duplicatedChildren).toHaveLength(2);
      
      // All children should have depth 4
      for (const child of duplicatedChildren) {
        expect(child.depth).toBe(4);
      }

      // Find grandchild
      const duplicatedChild1 = duplicatedChildren.find(n => n.nodeType === 'folder');
      if (duplicatedChild1) {
        const duplicatedGrandchildren = await coreDB.listChildren(duplicatedChild1.id);
        expect(duplicatedGrandchildren).toHaveLength(1);
        expect(duplicatedGrandchildren[0].depth).toBe(5); // child1(4) + 1
      }
    });
  });

  describe('Trash Restore Depth Consistency', () => {
    it('should set correct depth when restoring nodes from trash', async () => {
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

      const originalParent: TreeNode = {
        id: 'original-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Original Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const trashedNode: TreeNode = {
        id: 'trashed' as NodeId,
        parentId: originalParent.id,
        nodeType: 'file',
        name: 'Trashed Node',
        depth: 2,
        isRemoved: true,
        removedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const newParent: TreeNode = {
        id: 'new-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'New Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepNewParent: TreeNode = {
        id: 'deep-new-parent' as NodeId,
        parentId: newParent.id,
        nodeType: 'folder',
        name: 'Deep New Parent',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Create nodes
      await coreDB.createNode(root);
      await coreDB.createNode(originalParent);
      await coreDB.createNode(trashedNode);
      await coreDB.createNode(newParent);
      await coreDB.createNode(deepNewParent);

      // Restore to different depth level
      await coreDB.restoreFromTrash(trashedNode.id, deepNewParent.id);
      
      // Verify restored node has correct depth
      const restoredNode = await coreDB.nodes.get(trashedNode.id);
      expect(restoredNode?.depth).toBe(3); // deepNewParent(2) + 1
      expect(restoredNode?.parentId).toBe(deepNewParent.id);
      expect(restoredNode?.isRemoved).toBe(false);
      expect(restoredNode?.removedAt).toBeUndefined();
    });

    it('should update depth for entire subtree when restoring from trash', async () => {
      // Create structure with child nodes
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

      const trashedParent: TreeNode = {
        id: 'trashed-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Trashed Parent',
        depth: 1,
        isRemoved: true,
        removedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const trashedChild: TreeNode = {
        id: 'trashed-child' as NodeId,
        parentId: trashedParent.id,
        nodeType: 'file',
        name: 'Trashed Child',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const newParent: TreeNode = {
        id: 'new-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'New Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepParent: TreeNode = {
        id: 'deep-parent' as NodeId,
        parentId: newParent.id,
        nodeType: 'folder',
        name: 'Deep Parent',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(trashedParent);
      await coreDB.createNode(trashedChild);
      await coreDB.createNode(newParent);
      await coreDB.createNode(deepParent);

      // Restore to deep location
      await coreDB.restoreFromTrash(trashedParent.id, deepParent.id);

      // Verify parent depth
      const restoredParent = await coreDB.nodes.get(trashedParent.id);
      expect(restoredParent?.depth).toBe(3); // deepParent(2) + 1

      // Verify child depth was updated
      const restoredChild = await coreDB.nodes.get(trashedChild.id);
      expect(restoredChild?.depth).toBe(4); // restoredParent(3) + 1
    });
  });

  describe('Copy/Paste Depth Consistency', () => {
    it('should set correct depth when pasting single nodes', async () => {
      // Create source structure
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

      const sourceFolder: TreeNode = {
        id: 'source' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Source Folder',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const targetParent: TreeNode = {
        id: 'target-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Target Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepTarget: TreeNode = {
        id: 'deep-target' as NodeId,
        parentId: targetParent.id,
        nodeType: 'folder',
        name: 'Deep Target',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(sourceFolder);
      await coreDB.createNode(targetParent);
      await coreDB.createNode(deepTarget);

      // Paste to deep target
      const pastedNodeIds = await coreDB.pasteNodes([sourceFolder.id], deepTarget.id);
      expect(pastedNodeIds).toHaveLength(1);

      const pastedNode = await coreDB.nodes.get(pastedNodeIds[0]);
      expect(pastedNode?.depth).toBe(3); // deepTarget(2) + 1
      expect(pastedNode?.parentId).toBe(deepTarget.id);
      expect(pastedNode?.name).toBe(sourceFolder.name);
    });

    it('should maintain hierarchy depth when pasting subtrees', async () => {
      // Create complex source structure
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

      const sourceParent: TreeNode = {
        id: 'source-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Source Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const sourceChild: TreeNode = {
        id: 'source-child' as NodeId,
        parentId: sourceParent.id,
        nodeType: 'folder',
        name: 'Source Child',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const sourceGrandchild: TreeNode = {
        id: 'source-grandchild' as NodeId,
        parentId: sourceChild.id,
        nodeType: 'file',
        name: 'Source Grandchild',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const targetParent: TreeNode = {
        id: 'target-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Target Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(sourceParent);
      await coreDB.createNode(sourceChild);
      await coreDB.createNode(sourceGrandchild);
      await coreDB.createNode(targetParent);

      // Paste entire subtree
      const pastedNodeIds = await coreDB.pasteNodes([sourceParent.id], targetParent.id);
      expect(pastedNodeIds).toHaveLength(1);

      const pastedParent = await coreDB.nodes.get(pastedNodeIds[0]);
      expect(pastedParent?.depth).toBe(2); // targetParent(1) + 1

      // Verify child hierarchy depths
      const pastedChildren = await coreDB.listChildren(pastedNodeIds[0]);
      expect(pastedChildren).toHaveLength(1);
      expect(pastedChildren[0].depth).toBe(3); // pastedParent(2) + 1

      const pastedGrandchildren = await coreDB.listChildren(pastedChildren[0].id);
      expect(pastedGrandchildren).toHaveLength(1);
      expect(pastedGrandchildren[0].depth).toBe(4); // pastedChild(3) + 1
    });
  });

  describe('Move Operations Depth Consistency', () => {
    it('should update depth correctly when moving nodes between different levels', async () => {
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

      const shallowParent: TreeNode = {
        id: 'shallow' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Shallow Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepParent: TreeNode = {
        id: 'deep-parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Deep Parent Level 1',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deeperParent: TreeNode = {
        id: 'deeper-parent' as NodeId,
        parentId: deepParent.id,
        nodeType: 'folder',
        name: 'Deep Parent Level 2',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const movingNode: TreeNode = {
        id: 'moving' as NodeId,
        parentId: shallowParent.id,
        nodeType: 'folder',
        name: 'Moving Node',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const childOfMoving: TreeNode = {
        id: 'child-of-moving' as NodeId,
        parentId: movingNode.id,
        nodeType: 'file',
        name: 'Child of Moving',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(shallowParent);
      await coreDB.createNode(deepParent);
      await coreDB.createNode(deeperParent);
      await coreDB.createNode(movingNode);
      await coreDB.createNode(childOfMoving);

      // Move from shallow (depth 1) to deeper location (depth 2)
      await coreDB.moveNode(movingNode.id, deeperParent.id);

      // Verify moved node has correct depth
      const movedNode = await coreDB.nodes.get(movingNode.id);
      expect(movedNode?.depth).toBe(3); // deeperParent(2) + 1
      expect(movedNode?.parentId).toBe(deeperParent.id);

      // Verify child depth was updated
      const movedChild = await coreDB.nodes.get(childOfMoving.id);
      expect(movedChild?.depth).toBe(4); // movedNode(3) + 1
    });
  });

  describe('Integration Tests', () => {
    it('should maintain depth consistency through complex sequence of operations', async () => {
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

      const projectFolder: TreeNode = {
        id: 'project' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Project',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const srcFolder: TreeNode = {
        id: 'src' as NodeId,
        parentId: projectFolder.id,
        nodeType: 'folder',
        name: 'src',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const originalFile: TreeNode = {
        id: 'original-file' as NodeId,
        parentId: srcFolder.id,
        nodeType: 'file',
        name: 'original.ts',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(root);
      await coreDB.createNode(projectFolder);
      await coreDB.createNode(srcFolder);
      await coreDB.createNode(originalFile);

      // 1. Duplicate file within same folder-plugin
      const duplicatedId = await coreDB.duplicateNode(originalFile.id, srcFolder.id);
      const duplicated = await coreDB.nodes.get(duplicatedId);
      expect(duplicated?.depth).toBe(3);

      // 2. Create test folder-plugin and move duplicated file there
      const testFolder: TreeNode = {
        id: 'test' as NodeId,
        parentId: projectFolder.id,
        nodeType: 'folder',
        name: 'test',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(testFolder);

      await coreDB.moveNode(duplicatedId, testFolder.id);
      const moved = await coreDB.nodes.get(duplicatedId);
      expect(moved?.depth).toBe(3); // Same depth, different parent

      // 3. Create deep utils folder-plugin and paste original file there
      const utilsFolder: TreeNode = {
        id: 'utils' as NodeId,
        parentId: srcFolder.id,
        nodeType: 'folder',
        name: 'utils',
        depth: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const deepUtils: TreeNode = {
        id: 'deep-utils' as NodeId,
        parentId: utilsFolder.id,
        nodeType: 'folder',
        name: 'deep',
        depth: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNode(utilsFolder);
      await coreDB.createNode(deepUtils);

      const pastedIds = await coreDB.pasteNodes([originalFile.id], deepUtils.id);
      const pasted = await coreDB.nodes.get(pastedIds[0]);
      expect(pasted?.depth).toBe(5); // deepUtils(4) + 1

      // 4. Export and reimport to verify serialization
      const allNodes = [
        await coreDB.nodes.get(root.id),
        await coreDB.nodes.get(projectFolder.id),
        await coreDB.nodes.get(srcFolder.id),
        await coreDB.nodes.get(originalFile.id),
        await coreDB.nodes.get(duplicatedId),
        await coreDB.nodes.get(testFolder.id),
        await coreDB.nodes.get(utilsFolder.id),
        await coreDB.nodes.get(deepUtils.id),
        pasted,
      ].filter(Boolean) as TreeNode[];

      const serialized = allNodes.map(serializeTreeNode);
      const exportedJson = JSON.stringify(serialized);
      const importData = JSON.parse(exportedJson);
      const reimported = importData.map((data: any) => {
        // Ensure IDs are strings for integration test
        if (!data.id || typeof data.id !== 'string') {
          throw new Error('Invalid node ID in integration test data');
        }
        // Allow empty parentId for root nodes in integration test
        if (typeof data.parentId !== 'string') {
          throw new Error('Invalid parent ID in integration test data');
        }
        return deserializeTreeNode(data);
      });

      // Verify all depths are preserved in export/import
      const depthMap = new Map(allNodes.map(n => [n.id, n.depth]));
      for (const node of reimported) {
        expect(node.depth).toBe(depthMap.get(node.id));
      }

      // 5. Final verification - all depths should be consistent
      const finalNodes = await Promise.all([
        coreDB.nodes.get(root.id),
        coreDB.nodes.get(projectFolder.id),
        coreDB.nodes.get(srcFolder.id),
        coreDB.nodes.get(originalFile.id),
        coreDB.nodes.get(duplicatedId),
        coreDB.nodes.get(testFolder.id),
        coreDB.nodes.get(utilsFolder.id),
        coreDB.nodes.get(deepUtils.id),
        coreDB.nodes.get(pastedIds[0]),
      ]);

      const expectedDepths = [0, 1, 2, 3, 3, 2, 3, 4, 5];
      for (let i = 0; i < finalNodes.length; i++) {
        expect(finalNodes[i]?.depth).toBe(expectedDepths[i]);
      }
    });
  });
});