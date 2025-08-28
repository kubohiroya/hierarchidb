/**
 * @file CoreDB.undo.redo.depth.test.ts
 * @description TDD tests for depth consistency in Undo/Redo operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { CoreDB } from '../CoreDB';
import type { TreeNode, NodeId } from '@hierarchidb/common-core';

// Mock command history for testing Undo/Redo
interface CommandSnapshot {
  nodeId: NodeId;
  beforeState: TreeNode | null;
  afterState: TreeNode | null;
  operation: 'create' | 'update' | 'delete' | 'move';
}

class MockCommandHistory {
  private history: CommandSnapshot[] = [];
  private currentIndex = -1;

  addCommand(snapshot: CommandSnapshot): void {
    // Remove any commands after current index (when creating new branch)
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(snapshot);
    this.currentIndex = this.history.length - 1;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  undo(): CommandSnapshot | null {
    if (!this.canUndo()) return null;
    const command = this.history[this.currentIndex];
    this.currentIndex--;
    return command;
  }

  redo(): CommandSnapshot | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    const command = this.history[this.currentIndex];
    return command;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}

// Extended CoreDB with Undo/Redo functionality
class CoreDBWithUndo extends CoreDB {
  private commandHistory = new MockCommandHistory();

  async createNodeWithHistory(node: TreeNode): Promise<NodeId> {
    const nodeId = await this.createNode(node);
    const createdNode = await this.getNode(nodeId);
    
    this.commandHistory.addCommand({
      nodeId,
      beforeState: null,
      afterState: createdNode,
      operation: 'create',
    });
    
    return nodeId;
  }

  async updateNodeWithHistory(node: TreeNode): Promise<void> {
    const beforeState = await this.getNode(node.id);
    await this.updateNode(node);
    const afterState = await this.getNode(node.id);
    
    this.commandHistory.addCommand({
      nodeId: node.id,
      beforeState,
      afterState,
      operation: 'update',
    });
  }

  async moveNodeWithHistory(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    const beforeState = await this.getNode(nodeId);
    await this.moveNode(nodeId, newParentId);
    const afterState = await this.getNode(nodeId);
    
    this.commandHistory.addCommand({
      nodeId,
      beforeState,
      afterState,
      operation: 'move',
    });
  }

  async deleteNodeWithHistory(nodeId: NodeId): Promise<void> {
    const beforeState = await this.getNode(nodeId);
    await this.deleteNode(nodeId);
    
    this.commandHistory.addCommand({
      nodeId,
      beforeState,
      afterState: null,
      operation: 'delete',
    });
  }

  async undo(): Promise<boolean> {
    const command = this.commandHistory.undo();
    if (!command) return false;

    switch (command.operation) {
      case 'create':
        // Undo create = delete
        if (command.afterState) {
          await this.deleteNode(command.nodeId);
        }
        break;
      
      case 'update':
      case 'move':
        // Undo update/move = restore previous state
        if (command.beforeState) {
          await this.nodes.put(command.beforeState);
          // Recalculate subtree depths if this was a move operation
          if (command.operation === 'move') {
            await this.updateSubtreeDepthFromParent(command.nodeId);
          }
        }
        break;
      
      case 'delete':
        // Undo delete = recreate
        if (command.beforeState) {
          await this.createNode(command.beforeState);
        }
        break;
    }

    return true;
  }

  async redo(): Promise<boolean> {
    const command = this.commandHistory.redo();
    if (!command) return false;

    switch (command.operation) {
      case 'create':
        // Redo create
        if (command.afterState) {
          await this.createNode(command.afterState);
        }
        break;
      
      case 'update':
      case 'move':
        // Redo update/move = apply after state
        if (command.afterState) {
          await this.nodes.put(command.afterState);
          // Recalculate subtree depths if this was a move operation
          if (command.operation === 'move') {
            await this.updateSubtreeDepthFromParent(command.nodeId);
          }
        }
        break;
      
      case 'delete':
        // Redo delete
        await this.deleteNode(command.nodeId);
        break;
    }

    return true;
  }

  canUndo(): boolean {
    return this.commandHistory.canUndo();
  }

  canRedo(): boolean {
    return this.commandHistory.canRedo();
  }

  clearHistory(): void {
    this.commandHistory.clear();
  }

  // Helper method to update subtree depths (expose protected method)
  async updateSubtreeDepthFromParent(nodeId: NodeId): Promise<void> {
    const node = await this.nodes.get(nodeId);
    if (!node) return;

    const children = await this.listChildren(nodeId);
    for (const child of children) {
      child.depth = node.depth + 1;
      child.updatedAt = Date.now();
      child.version++;
      
      await this.nodes.put(child);
      
      // Recursively update descendants
      await this.updateSubtreeDepthFromParent(child.id);
    }
  }
}

describe('Undo/Redo Depth Consistency', () => {
  let coreDB: CoreDBWithUndo;

  beforeEach(async () => {
    coreDB = new (CoreDBWithUndo as any)('test-undo-redo-db');
    await coreDB.open();
    await coreDB.initialize();
  });

  afterEach(async () => {
    if (coreDB) {
      await coreDB.close();
      await Dexie.delete('test-undo-redo-db-CoreDB');
    }
  });

  describe('Create/Delete Undo/Redo', () => {
    it('should maintain depth consistency when undoing node creation', async () => {
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

      const parent: TreeNode = {
        id: 'parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNodeWithHistory(root);
      await coreDB.createNodeWithHistory(parent);

      // Create new node at depth 2
      const newNode: TreeNode = {
        id: 'new-node' as NodeId,
        parentId: parent.id,
        nodeType: 'file',
        name: 'New Node',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNodeWithHistory(newNode);

      // Verify node exists with correct depth
      const createdNode = await coreDB.getNode(newNode.id);
      expect(createdNode?.depth).toBe(2);

      // Undo creation
      const undoSuccess = await coreDB.undo();
      expect(undoSuccess).toBe(true);

      // Verify node is gone
      const undoneNode = await coreDB.getNode(newNode.id);
      expect(undoneNode).toBeUndefined();

      // Redo creation
      const redoSuccess = await coreDB.redo();
      expect(redoSuccess).toBe(true);

      // Verify node is back with correct depth
      const redoneNode = await coreDB.getNode(newNode.id);
      expect(redoneNode?.depth).toBe(2);
      expect(redoneNode?.parentId).toBe(parent.id);
    });

    it('should maintain depth consistency when undoing node deletion', async () => {
      // Create structure
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

      const parent: TreeNode = {
        id: 'parent' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Parent',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const nodeToDelete: TreeNode = {
        id: 'to-delete' as NodeId,
        parentId: parent.id,
        nodeType: 'file',
        name: 'To Delete',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNodeWithHistory(root);
      await coreDB.createNodeWithHistory(parent);
      await coreDB.createNodeWithHistory(nodeToDelete);

      // Delete node
      await coreDB.deleteNodeWithHistory(nodeToDelete.id);

      // Verify node is gone
      const deletedNode = await coreDB.getNode(nodeToDelete.id);
      expect(deletedNode).toBeUndefined();

      // Undo deletion
      const undoSuccess = await coreDB.undo();
      expect(undoSuccess).toBe(true);

      // Verify node is restored with correct depth
      const restoredNode = await coreDB.getNode(nodeToDelete.id);
      expect(restoredNode?.depth).toBe(2);
      expect(restoredNode?.parentId).toBe(parent.id);
      expect(restoredNode?.name).toBe('To Delete');

      // Redo deletion
      const redoSuccess = await coreDB.redo();
      expect(redoSuccess).toBe(true);

      // Verify node is gone again
      const reDeletedNode = await coreDB.getNode(nodeToDelete.id);
      expect(reDeletedNode).toBeUndefined();
    });
  });

  describe('Move Operations Undo/Redo', () => {
    it('should maintain depth consistency when undoing node moves', async () => {
      // Create structure
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

      const movingNode: TreeNode = {
        id: 'moving-node' as NodeId,
        parentId: originalParent.id,
        nodeType: 'file',
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

      await coreDB.createNodeWithHistory(root);
      await coreDB.createNodeWithHistory(originalParent);
      await coreDB.createNodeWithHistory(newParent);
      await coreDB.createNodeWithHistory(deepParent);
      await coreDB.createNodeWithHistory(movingNode);
      await coreDB.createNodeWithHistory(childOfMoving);

      // Verify initial state
      const initialMoving = await coreDB.getNode(movingNode.id);
      const initialChild = await coreDB.getNode(childOfMoving.id);
      expect(initialMoving?.depth).toBe(2);
      expect(initialChild?.depth).toBe(3);
      expect(initialMoving?.parentId).toBe(originalParent.id);

      // Move to deeper location
      await coreDB.moveNodeWithHistory(movingNode.id, deepParent.id);

      // Verify move succeeded with correct depths
      const movedNode = await coreDB.getNode(movingNode.id);
      const movedChild = await coreDB.getNode(childOfMoving.id);
      expect(movedNode?.depth).toBe(3); // deepParent(2) + 1
      expect(movedChild?.depth).toBe(4); // movedNode(3) + 1
      expect(movedNode?.parentId).toBe(deepParent.id);

      // Undo move
      const undoSuccess = await coreDB.undo();
      expect(undoSuccess).toBe(true);

      // Verify node is back to original location with original depth
      const undoneNode = await coreDB.getNode(movingNode.id);
      const undoneChild = await coreDB.getNode(childOfMoving.id);
      expect(undoneNode?.depth).toBe(2);
      expect(undoneChild?.depth).toBe(3);
      expect(undoneNode?.parentId).toBe(originalParent.id);

      // Redo move
      const redoSuccess = await coreDB.redo();
      expect(redoSuccess).toBe(true);

      // Verify move is reapplied correctly
      const redoneNode = await coreDB.getNode(movingNode.id);
      const redoneChild = await coreDB.getNode(childOfMoving.id);
      expect(redoneNode?.depth).toBe(3);
      expect(redoneChild?.depth).toBe(4);
      expect(redoneNode?.parentId).toBe(deepParent.id);
    });

    it('should handle complex move sequences with multiple undo/redo', async () => {
      // Create structure
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

      const folder2: TreeNode = {
        id: 'folder2' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder 2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const subfolder: TreeNode = {
        id: 'subfolder' as NodeId,
        parentId: folder2.id,
        nodeType: 'folder',
        name: 'Subfolder',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const movingFile: TreeNode = {
        id: 'moving-file' as NodeId,
        parentId: folder1.id,
        nodeType: 'file',
        name: 'Moving File',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNodeWithHistory(root);
      await coreDB.createNodeWithHistory(folder1);
      await coreDB.createNodeWithHistory(folder2);
      await coreDB.createNodeWithHistory(subfolder);
      await coreDB.createNodeWithHistory(movingFile);

      // Initial state: file is in folder1 at depth 2
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(2);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(folder1.id);

      // Move 1: folder1 -> folder2
      await coreDB.moveNodeWithHistory(movingFile.id, folder2.id);
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(2);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(folder2.id);

      // Move 2: folder2 -> subfolder
      await coreDB.moveNodeWithHistory(movingFile.id, subfolder.id);
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(3);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(subfolder.id);

      // Move 3: subfolder -> root
      await coreDB.moveNodeWithHistory(movingFile.id, root.id);
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(1);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(root.id);

      // Undo sequence: root -> subfolder
      await coreDB.undo();
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(3);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(subfolder.id);

      // Undo: subfolder -> folder2
      await coreDB.undo();
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(2);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(folder2.id);

      // Undo: folder2 -> folder1 (original)
      await coreDB.undo();
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(2);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(folder1.id);

      // Redo sequence
      await coreDB.redo(); // folder1 -> folder2
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(2);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(folder2.id);

      await coreDB.redo(); // folder2 -> subfolder
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(3);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(subfolder.id);

      await coreDB.redo(); // subfolder -> root
      expect((await coreDB.getNode(movingFile.id))?.depth).toBe(1);
      expect((await coreDB.getNode(movingFile.id))?.parentId).toBe(root.id);
    });
  });

  describe('Complex Operation Sequences', () => {
    it('should maintain depth consistency through mixed create/move/delete undo/redo operations', async () => {
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

      const folder: TreeNode = {
        id: 'folder' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.createNodeWithHistory(root);
      await coreDB.createNodeWithHistory(folder);

      // Operation 1: Create file in folder-plugin
      const file1: TreeNode = {
        id: 'file1' as NodeId,
        parentId: folder.id,
        nodeType: 'file',
        name: 'File 1',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNodeWithHistory(file1);
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);

      // Operation 2: Create another folder-plugin
      const folder2: TreeNode = {
        id: 'folder2' as NodeId,
        parentId: root.id,
        nodeType: 'folder',
        name: 'Folder 2',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNodeWithHistory(folder2);
      expect((await coreDB.getNode(folder2.id))?.depth).toBe(1);

      // Operation 3: Move file from folder-plugin to folder2
      await coreDB.moveNodeWithHistory(file1.id, folder2.id);
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(folder2.id);

      // Operation 4: Create subfolder in folder2
      const subfolder: TreeNode = {
        id: 'subfolder' as NodeId,
        parentId: folder2.id,
        nodeType: 'folder',
        name: 'Subfolder',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNodeWithHistory(subfolder);
      expect((await coreDB.getNode(subfolder.id))?.depth).toBe(2);

      // Operation 5: Move file to subfolder
      await coreDB.moveNodeWithHistory(file1.id, subfolder.id);
      expect((await coreDB.getNode(file1.id))?.depth).toBe(3);
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(subfolder.id);

      // Operation 6: Delete folder2 (this should be more complex in real implementation)
      await coreDB.deleteNodeWithHistory(folder2.id);
      expect(await coreDB.getNode(folder2.id)).toBeUndefined();

      // Now test undo sequence
      // Undo 6: Restore folder2
      await coreDB.undo();
      expect((await coreDB.getNode(folder2.id))?.depth).toBe(1);

      // Undo 5: Move file back to folder2
      await coreDB.undo();
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(folder2.id);

      // Undo 4: Remove subfolder
      await coreDB.undo();
      expect(await coreDB.getNode(subfolder.id)).toBeUndefined();

      // Undo 3: Move file back to original folder-plugin
      await coreDB.undo();
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(folder.id);

      // Undo 2: Remove folder2
      await coreDB.undo();
      expect(await coreDB.getNode(folder2.id)).toBeUndefined();

      // Undo 1: Remove file1
      await coreDB.undo();
      expect(await coreDB.getNode(file1.id)).toBeUndefined();

      // Now redo everything and verify
      await coreDB.redo(); // Create file1
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);

      await coreDB.redo(); // Create folder2
      expect((await coreDB.getNode(folder2.id))?.depth).toBe(1);

      await coreDB.redo(); // Move file1 to folder2
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(folder2.id);
      expect((await coreDB.getNode(file1.id))?.depth).toBe(2);

      await coreDB.redo(); // Create subfolder
      expect((await coreDB.getNode(subfolder.id))?.depth).toBe(2);

      await coreDB.redo(); // Move file1 to subfolder
      expect((await coreDB.getNode(file1.id))?.parentId).toBe(subfolder.id);
      expect((await coreDB.getNode(file1.id))?.depth).toBe(3);

      await coreDB.redo(); // Delete folder2
      expect(await coreDB.getNode(folder2.id)).toBeUndefined();

      // Final verification: file1 should be gone with folder2
      // (In real implementation, this would handle cascading deletes)
    });
  });
});