import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createNewDraftWorkingCopy,
  createWorkingCopyFromNode,
  commitWorkingCopy,
  discardWorkingCopy,
  getWorkingCopy,
  updateWorkingCopy,
  checkWorkingCopyConflict,
  getChildNames,
  createNewName,
} from './WorkingCopyOperations';
import type { TreeNodeId, UUID, TreeNodeType, TreeNode, WorkingCopy } from '@hierarchidb/core';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import { WorkerErrorCode } from '../command/types';

// Mock database implementations
class MockCoreDB {
  nodes = new Map<TreeNodeId, TreeNode>();

  async getNode(nodeId: TreeNodeId): Promise<TreeNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async getChildren(parentId: TreeNodeId): Promise<TreeNode[]> {
    const children: TreeNode[] = [];
    this.nodes.forEach((node) => {
      if (node.parentTreeNodeId === parentId) {
        children.push(node);
      }
    });
    return children;
  }

  async createNode(node: TreeNode): Promise<TreeNodeId> {
    this.nodes.set(node.treeNodeId, node);
    return node.treeNodeId;
  }

  async updateNode(nodeId: TreeNodeId, updates: Partial<TreeNode>): Promise<void> {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      this.nodes.set(nodeId, { ...existing, ...updates });
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

class MockEphemeralDB {
  workingCopies = new Map<UUID, WorkingCopy>();

  async getWorkingCopy(id: UUID): Promise<WorkingCopy | undefined> {
    return this.workingCopies.get(id);
  }

  async getWorkingCopyByNodeId(nodeId: TreeNodeId): Promise<WorkingCopy | undefined> {
    for (const wc of this.workingCopies.values()) {
      if (wc.workingCopyOf === nodeId) {
        return wc;
      }
    }
    return undefined;
  }

  async createWorkingCopy(wc: WorkingCopy): Promise<void> {
    this.workingCopies.set(wc.workingCopyId, wc);
  }

  async updateWorkingCopy(id: UUID, updates: Partial<WorkingCopy>): Promise<void> {
    const existing = this.workingCopies.get(id);
    if (existing) {
      this.workingCopies.set(id, { ...existing, ...updates });
    }
  }

  async deleteWorkingCopy(id: UUID): Promise<void> {
    this.workingCopies.delete(id);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

describe('WorkingCopyOperations', () => {
  let coreDB: MockCoreDB;
  let ephemeralDB: MockEphemeralDB;

  beforeEach(() => {
    coreDB = new MockCoreDB();
    ephemeralDB = new MockEphemeralDB();

    // Add some test nodes
    const rootNode: TreeNode = {
      treeNodeId: 'root' as TreeNodeId,
      parentTreeNodeId: '' as TreeNodeId,
      treeNodeType: 'Root' as TreeNodeType,
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const folder1: TreeNode = {
      treeNodeId: 'folder-1' as TreeNodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder' as TreeNodeType,
      name: 'Documents',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const folder2: TreeNode = {
      treeNodeId: 'folder-2' as TreeNodeId,
      parentTreeNodeId: 'root' as TreeNodeId,
      treeNodeType: 'folder' as TreeNodeType,
      name: 'Documents (2)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    coreDB.nodes.set(rootNode.treeNodeId, rootNode);
    coreDB.nodes.set(folder1.treeNodeId, folder1);
    coreDB.nodes.set(folder2.treeNodeId, folder2);
  });

  describe('createNewDraftWorkingCopy', () => {
    it('should create a draft working copy with unique name', async () => {
      const parentId = 'root' as TreeNodeId;
      const nodeType = 'folder' as TreeNodeType;
      const baseName = 'Documents';

      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        parentId,
        nodeType,
        baseName
      );

      expect(workingCopyId).toBeDefined();

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeDefined();
      expect(wc?.name).toBe('Documents (3)'); // Should be (3) since (1) and (2) exist
      expect(wc?.isDraft).toBe(true);
      expect(wc?.workingCopyOf).toBeUndefined();
      expect(wc?.parentTreeNodeId).toBe(parentId);
      expect(wc?.treeNodeType).toBe(nodeType);
    });

    it('should use base name if no conflict', async () => {
      const parentId = 'root' as TreeNodeId;
      const nodeType = 'folder' as TreeNodeType;
      const baseName = 'NewFolder';

      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        parentId,
        nodeType,
        baseName
      );

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc?.name).toBe('NewFolder');
    });

    it('should handle empty parent (root level)', async () => {
      const parentId = '' as TreeNodeId;
      const nodeType = 'folder' as TreeNodeType;
      const baseName = 'RootFolder';

      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        parentId,
        nodeType,
        baseName
      );

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeDefined();
      expect(wc?.parentTreeNodeId).toBe(parentId);
    });
  });

  describe('createWorkingCopyFromNode', () => {
    it('should create working copy from existing node', async () => {
      const nodeId = 'folder-1' as TreeNodeId;

      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeDefined();
      expect(wc?.workingCopyOf).toBe(nodeId);
      expect(wc?.name).toBe('Documents');
      expect((wc as any)?.isDraft).toBe(false);
    });

    it('should throw if node does not exist', async () => {
      const nodeId = 'non-existent' as TreeNodeId;

      await expect(
        createWorkingCopyFromNode(ephemeralDB as any, coreDB as any, nodeId)
      ).rejects.toThrow('Node not found');
    });

    it('should detect existing working copy', async () => {
      const nodeId = 'folder-1' as TreeNodeId;

      // Create first working copy
      await createWorkingCopyFromNode(ephemeralDB as any, coreDB as any, nodeId);

      // Try to create another
      await expect(
        createWorkingCopyFromNode(ephemeralDB as any, coreDB as any, nodeId)
      ).rejects.toThrow('Working copy already exists');
    });
  });

  describe('commitWorkingCopy', () => {
    it('should commit draft working copy as new node', async () => {
      // Create draft
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'NewFolder'
      );

      const result = await commitWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId,
        true // isDraft
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nodeId).toBeDefined();

        // Check node was created in CoreDB
        const node = await coreDB.getNode(result.nodeId!);
        expect(node).toBeDefined();
        expect(node?.name).toBe('NewFolder');

        // Check working copy was deleted
        const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
        expect(wc).toBeUndefined();
      }
    });

    it('should commit changes to existing node', async () => {
      const nodeId = 'folder-1' as TreeNodeId;

      // Create working copy
      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      // Update working copy
      await updateWorkingCopy(ephemeralDB as any, workingCopyId, {
        name: 'Updated Documents',
        description: 'New description',
      });

      // Commit
      const result = await commitWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId,
        false
      );

      expect(result.success).toBe(true);

      // Check node was updated
      const node = await coreDB.getNode(nodeId);
      expect(node?.name).toBe('Updated Documents');
      expect(node?.version).toBe(2);

      // Check working copy was deleted
      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeUndefined();
    });

    it('should detect version conflict', async () => {
      const nodeId = 'folder-1' as TreeNodeId;

      // Create working copy
      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      // Simulate another update to the node (version bump)
      await coreDB.updateNode(nodeId, { version: 2 });

      // Try to commit - should detect conflict
      const result = await commitWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId,
        false
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe(WorkerErrorCode.COMMIT_CONFLICT);
      }
    });

    it('should handle name conflict with auto-rename', async () => {
      // Create draft with conflicting name
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'ConflictName'
      );

      // Create a node with the same name before commit
      const conflictNode: TreeNode = {
        treeNodeId: 'conflict-node' as TreeNodeId,
        parentTreeNodeId: 'root' as TreeNodeId,
        treeNodeType: 'folder' as TreeNodeType,
        name: 'ConflictName',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      await coreDB.createNode(conflictNode);

      // Commit with auto-rename
      const result = await commitWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId,
        true,
        'auto-rename'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const node = await coreDB.getNode(result.nodeId!);
        expect(node?.name).toBe('ConflictName (2)');
      }
    });
  });

  describe('discardWorkingCopy', () => {
    it('should delete working copy', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'TempFolder'
      );

      await discardWorkingCopy(ephemeralDB as any, workingCopyId);

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeUndefined();
    });

    it('should not throw if working copy does not exist', async () => {
      await expect(
        discardWorkingCopy(ephemeralDB as any, 'non-existent' as UUID)
      ).resolves.not.toThrow();
    });
  });

  describe('getWorkingCopy', () => {
    it('should retrieve working copy by ID', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'TestFolder'
      );

      const wc = await getWorkingCopy(ephemeralDB as any, workingCopyId);

      expect(wc).toBeDefined();
      expect(wc?.name).toBe('TestFolder');
    });

    it('should return undefined for non-existent ID', async () => {
      const wc = await getWorkingCopy(ephemeralDB as any, 'non-existent' as UUID);
      expect(wc).toBeUndefined();
    });
  });

  describe('updateWorkingCopy', () => {
    it('should update working copy properties', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'TestFolder'
      );

      await updateWorkingCopy(ephemeralDB as any, workingCopyId, {
        name: 'Updated Name',
        description: 'New Description',
      });

      const wc = await getWorkingCopy(ephemeralDB as any, workingCopyId);
      expect(wc?.name).toBe('Updated Name');
      expect(wc?.description).toBe('New Description');
    });

    it('should update timestamp', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'TestFolder'
      );

      const originalWc = await getWorkingCopy(ephemeralDB as any, workingCopyId);
      const originalTime = originalWc?.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateWorkingCopy(ephemeralDB as any, workingCopyId, {
        name: 'Updated',
      });

      const updatedWc = await getWorkingCopy(ephemeralDB as any, workingCopyId);
      expect(updatedWc?.updatedAt).toBeGreaterThan(originalTime || 0);
    });
  });

  describe('checkWorkingCopyConflict', () => {
    it('should detect no conflict when versions match', async () => {
      const nodeId = 'folder-1' as TreeNodeId;
      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      const hasConflict = await checkWorkingCopyConflict(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId
      );

      expect(hasConflict).toBe(false);
    });

    it('should detect conflict when versions differ', async () => {
      const nodeId = 'folder-1' as TreeNodeId;
      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      // Update node version
      await coreDB.updateNode(nodeId, { version: 2 });

      const hasConflict = await checkWorkingCopyConflict(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId
      );

      expect(hasConflict).toBe(true);
    });

    it('should handle draft working copies (no conflict)', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as TreeNodeId,
        'folder' as TreeNodeType,
        'Draft'
      );

      const hasConflict = await checkWorkingCopyConflict(
        ephemeralDB as any,
        coreDB as any,
        workingCopyId
      );

      expect(hasConflict).toBe(false);
    });
  });

  describe('name utilities', () => {
    describe('getChildNames', () => {
      it('should return names of all children', async () => {
        const names = await getChildNames(coreDB as any, 'root' as TreeNodeId);

        expect(names).toContain('Documents');
        expect(names).toContain('Documents (2)');
        expect(names).toHaveLength(2);
      });

      it('should return empty array for childless node', async () => {
        const names = await getChildNames(coreDB as any, 'folder-1' as TreeNodeId);
        expect(names).toEqual([]);
      });
    });

    describe('createNewName', () => {
      it('should return base name if no conflict', () => {
        const name = createNewName(['File1', 'File2'], 'File3');
        expect(name).toBe('File3');
      });

      it('should add (2) for first conflict', () => {
        const name = createNewName(['Document'], 'Document');
        expect(name).toBe('Document (2)');
      });

      it('should find next available number', () => {
        const name = createNewName(['Report', 'Report (2)', 'Report (3)'], 'Report');
        expect(name).toBe('Report (4)');
      });

      it('should handle gaps in numbering', () => {
        const name = createNewName(['File', 'File (2)', 'File (5)'], 'File');
        expect(name).toBe('File (6)');
      });

      it('should handle special characters in name', () => {
        const name = createNewName(['Test.doc', 'Test.doc (2)'], 'Test.doc');
        expect(name).toBe('Test.doc (3)');
      });
    });
  });
});
