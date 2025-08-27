/**
 * @file TreeMutationAPI.test.ts
 * @description Comprehensive test suite for TreeMutationAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, TreeId, TreeNode, WorkingCopyId } from '@hierarchidb/common-core';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import { EphemeralDB } from '../../db/EphemeralDB';
import type { TreeMutationAPI } from '@hierarchidb/common-api';

describe('TreeMutationAPI', () => {
  let api: TreeMutationAPI;
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;
  let ephemeralDB: EphemeralDB;

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
    // Initialize databases
    coreDB = await CoreDB.getSingleton();
    ephemeralDB = EphemeralDB.getSingleton();
    await coreDB.open();
    await ephemeralDB.open();
    
    // Clear existing data
    await coreDB.nodes.clear();
    await coreDB.trees.clear();
    await ephemeralDB.workingCopies.clear();
    
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
    api = workerAPI.getMutationAPI();
  });

  afterEach(async () => {
    await coreDB.close();
    await ephemeralDB.close();
    vi.clearAllMocks();
  });

  describe('createNode', () => {
    it('should create a new node', async () => {
      const newNode = await api.createNode({
        treeId: testTreeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'New Document',
        description: 'Test document',
      });
      
      expect(newNode).toBeDefined();
      expect(newNode.name).toBe('New Document');
      expect(newNode.nodeType).toBe('document');
      expect(newNode.parentId).toBe(rootNodeId);
      
      // Verify node is persisted
      const savedNode = await coreDB.nodes.get(newNode.id);
      expect(savedNode).toBeDefined();
      expect(savedNode?.name).toBe('New Document');
    });

    it('should handle name conflicts', async () => {
      const node1 = await api.createNode({
        treeId: testTreeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'Duplicate Name',
      });
      
      const node2 = await api.createNode({
        treeId: testTreeId,
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'Duplicate Name',
      });
      
      expect(node2.name).not.toBe('Duplicate Name');
      expect(node2.name).toMatch(/Duplicate Name/);
    });

    it('should reject invalid parent', async () => {
      await expect(
        api.createNode({
          parentId: 'non-existent' as NodeId,
          nodeType: 'document',
          name: 'Orphan',
        })
      ).rejects.toThrow();
    });
  });

  describe('updateNode', () => {
    it('should update node properties', async () => {
      const updated = await api.updateNode('node1' as NodeId, {
        name: 'Updated Folder',
        description: 'New description',
      });
      
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Folder');
      expect(updated.description).toBe('New description');
      expect(updated.version).toBe(2);
    });

    it('should handle optimistic locking', async () => {
      // First update succeeds
      await api.updateNode('node1' as NodeId, {
        name: 'First Update',
      }, { expectedVersion: 1 });
      
      // Second update with wrong version fails
      await expect(
        api.updateNode('node1' as NodeId, {
          name: 'Second Update',
        }, { expectedVersion: 1 })
      ).rejects.toThrow();
    });
  });

  describe('deleteNode', () => {
    it('should delete a single node', async () => {
      const result = await api.deleteNode('node2' as NodeId);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      
      // Verify node is deleted
      const deletedNode = await coreDB.nodes.get('node2' as NodeId);
      expect(deletedNode).toBeUndefined();
    });

    it('should prevent deletion of nodes with children', async () => {
      await expect(
        api.deleteNode('node1' as NodeId)
      ).rejects.toThrow();
    });

    it('should force delete node with children when specified', async () => {
      // Add child to node1
      await api.createNode({
        parentId: 'node1' as NodeId,
        nodeType: 'document',
        name: 'Child',
      });
      
      const result = await api.deleteNode('node1' as NodeId, {
        recursive: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThan(1);
    });
  });

  describe('deleteNodes', () => {
    it('should delete multiple nodes', async () => {
      const result = await api.deleteNodes([
        'node1' as NodeId,
        'node2' as NodeId,
      ]);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
    });

    it('should handle partial failures', async () => {
      // Add child to node1 to prevent deletion
      await api.createNode({
        parentId: 'node1' as NodeId,
        nodeType: 'document',
        name: 'Child',
      });
      
      const result = await api.deleteNodes([
        'node1' as NodeId, // Will fail
        'node2' as NodeId, // Will succeed
      ]);
      
      expect(result.success).toBe(false);
      expect(result.deletedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('moveNode', () => {
    it('should move node to new parent', async () => {
      const moved = await api.moveNode(
        'node2' as NodeId,
        'node1' as NodeId
      );
      
      expect(moved.parentId).toBe('node1');
      
      // Verify in database
      const dbNode = await coreDB.nodes.get('node2' as NodeId);
      expect(dbNode?.parentId).toBe('node1');
    });

    it('should prevent circular references', async () => {
      // Try to move parent into its child
      await expect(
        api.moveNode(rootNodeId, 'node1' as NodeId)
      ).rejects.toThrow();
    });

    it('should handle name conflicts in new location', async () => {
      // Create conflicting name in target
      await api.createNode({
        parentId: 'node1' as NodeId,
        nodeType: 'document',
        name: 'Document 1',
      });
      
      const moved = await api.moveNode(
        'node2' as NodeId,
        'node1' as NodeId,
        { onNameConflict: 'auto-rename' }
      );
      
      expect(moved.name).not.toBe('Document 1');
    });
  });

  describe('moveNodes', () => {
    it('should move multiple nodes', async () => {
      const moved = await api.moveNodes(
        ['node2' as NodeId],
        'node1' as NodeId
      );
      
      expect(moved).toHaveLength(1);
      expect(moved[0].parentId).toBe('node1');
    });
  });

  describe('copyNode', () => {
    it('should create a copy of node', async () => {
      const copy = await api.copyNode(
        'node1' as NodeId,
        rootNodeId
      );
      
      expect(copy.id).not.toBe('node1');
      expect(copy.name).toMatch(/Folder 1/);
      expect(copy.parentId).toBe(rootNodeId);
    });

    it('should deep copy with children', async () => {
      // Add child to node1
      const child = await api.createNode({
        parentId: 'node1' as NodeId,
        nodeType: 'document',
        name: 'Child',
      });
      
      const copy = await api.copyNode(
        'node1' as NodeId,
        rootNodeId,
        { deep: true }
      );
      
      // Check if child was also copied
      const children = await coreDB.nodes
        .where('parentId')
        .equals(copy.id)
        .toArray();
      
      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('Child');
    });
  });

  describe('Working Copy Operations', () => {
    describe('createWorkingCopy', () => {
      it('should create working copy of existing node', async () => {
        const workingCopyId = await api.createWorkingCopy('node1' as NodeId);
        
        expect(workingCopyId).toBeDefined();
        
        // Verify in ephemeral DB
        const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
        expect(workingCopy).toBeDefined();
        expect(workingCopy?.sourceNodeId).toBe('node1');
      });
    });

    describe('createDraftWorkingCopy', () => {
      it('should create draft working copy for new node', async () => {
        const workingCopyId = await api.createDraftWorkingCopy({
          parentId: rootNodeId,
          nodeType: 'document',
          name: 'Draft Document',
        });
        
        expect(workingCopyId).toBeDefined();
        
        const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
        expect(workingCopy).toBeDefined();
        expect(workingCopy?.isDraft).toBe(true);
      });
    });

    describe('updateWorkingCopy', () => {
      it('should update working copy data', async () => {
        const workingCopyId = await api.createWorkingCopy('node1' as NodeId);
        
        await api.updateWorkingCopy(workingCopyId, {
          name: 'Updated in Working Copy',
        });
        
        const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
        expect(workingCopy?.data.name).toBe('Updated in Working Copy');
      });
    });

    describe('commitWorkingCopy', () => {
      it('should commit changes to main database', async () => {
        const workingCopyId = await api.createWorkingCopy('node1' as NodeId);
        
        await api.updateWorkingCopy(workingCopyId, {
          name: 'Committed Name',
        });
        
        const committed = await api.commitWorkingCopy(workingCopyId);
        
        expect(committed.name).toBe('Committed Name');
        
        // Verify in core DB
        const node = await coreDB.nodes.get('node1' as NodeId);
        expect(node?.name).toBe('Committed Name');
        
        // Working copy should be removed
        const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
        expect(workingCopy).toBeUndefined();
      });

      it('should handle version conflicts', async () => {
        const workingCopyId = await api.createWorkingCopy('node1' as NodeId);
        
        // Update node directly (simulating concurrent edit)
        await api.updateNode('node1' as NodeId, {
          name: 'Concurrent Edit',
        });
        
        await api.updateWorkingCopy(workingCopyId, {
          name: 'Working Copy Edit',
        });
        
        // Commit should fail due to version conflict
        await expect(
          api.commitWorkingCopy(workingCopyId, {
            expectedVersion: 1,
          })
        ).rejects.toThrow();
      });
    });

    describe('discardWorkingCopy', () => {
      it('should discard working copy changes', async () => {
        const workingCopyId = await api.createWorkingCopy('node1' as NodeId);
        
        await api.updateWorkingCopy(workingCopyId, {
          name: 'To Be Discarded',
        });
        
        await api.discardWorkingCopy(workingCopyId);
        
        // Working copy should be removed
        const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
        expect(workingCopy).toBeUndefined();
        
        // Original node should be unchanged
        const node = await coreDB.nodes.get('node1' as NodeId);
        expect(node?.name).toBe('Folder 1');
      });
    });
  });

  describe('Trash Operations', () => {
    describe('moveToTrash', () => {
      it('should move node to trash', async () => {
        const result = await api.moveToTrash(['node2' as NodeId]);
        
        expect(result.success).toBe(true);
        expect(result.movedCount).toBe(1);
        
        // Node should be marked as deleted
        const node = await coreDB.nodes.get('node2' as NodeId);
        expect(node?.removedAt).toBeDefined();
      });
    });

    describe('restoreFromTrash', () => {
      it('should restore node from trash', async () => {
        // Move to trash first
        await api.moveToTrash(['node2' as NodeId]);
        
        // Restore
        const result = await api.restoreFromTrash(['node2' as NodeId]);
        
        expect(result.success).toBe(true);
        expect(result.restoredCount).toBe(1);
        
        // Node should no longer be marked as deleted
        const node = await coreDB.nodes.get('node2' as NodeId);
        expect(node?.removedAt).toBeUndefined();
      });

      it('should handle name conflicts on restore', async () => {
        // Move to trash
        await api.moveToTrash(['node2' as NodeId]);
        
        // Create new node with same name
        await api.createNode({
          parentId: rootNodeId,
          nodeType: 'document',
          name: 'Document 1',
        });
        
        // Restore with auto-rename
        const result = await api.restoreFromTrash(
          ['node2' as NodeId],
          { onNameConflict: 'auto-rename' }
        );
        
        expect(result.success).toBe(true);
        
        const restored = await coreDB.nodes.get('node2' as NodeId);
        expect(restored?.name).not.toBe('Document 1');
      });
    });

    describe('emptyTrash', () => {
      it('should permanently delete all trashed nodes', async () => {
        // Move multiple nodes to trash
        await api.moveToTrash(['node1' as NodeId, 'node2' as NodeId]);
        
        const result = await api.emptyTrash(testTreeId);
        
        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(2);
        
        // Nodes should be permanently deleted
        const node1 = await coreDB.nodes.get('node1' as NodeId);
        const node2 = await coreDB.nodes.get('node2' as NodeId);
        expect(node1).toBeUndefined();
        expect(node2).toBeUndefined();
      });
    });
  });

  describe('Undo/Redo Operations', () => {
    it('should undo last operation', async () => {
      // Perform an operation
      const created = await api.createNode({
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'To Be Undone',
      });
      
      // Undo
      const undoResult = await api.undo();
      expect(undoResult.success).toBe(true);
      
      // Node should be deleted
      const node = await coreDB.nodes.get(created.id);
      expect(node).toBeUndefined();
    });

    it('should redo undone operation', async () => {
      // Create, undo, then redo
      const created = await api.createNode({
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'To Be Redone',
      });
      
      await api.undo();
      
      const redoResult = await api.redo();
      expect(redoResult.success).toBe(true);
      
      // Node should exist again
      const node = await coreDB.nodes.get(created.id);
      expect(node).toBeDefined();
      expect(node?.name).toBe('To Be Redone');
    });

    it('should maintain undo/redo history', async () => {
      const canUndoBefore = await api.canUndo();
      expect(canUndoBefore).toBe(false);
      
      // Perform operation
      await api.createNode({
        parentId: rootNodeId,
        nodeType: 'document',
        name: 'Test',
      });
      
      const canUndoAfter = await api.canUndo();
      expect(canUndoAfter).toBe(true);
      
      await api.undo();
      
      const canRedo = await api.canRedo();
      expect(canRedo).toBe(true);
    });
  });
});