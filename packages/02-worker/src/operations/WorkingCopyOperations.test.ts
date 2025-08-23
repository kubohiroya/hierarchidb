import type { TreeNode, NodeId, TreeNodeType, EntityId, WorkingCopy } from '@hierarchidb/00-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerErrorCode } from '../command/types';
import {
  checkWorkingCopyConflict,
  commitWorkingCopy,
  createNewDraftWorkingCopy,
  createNewName,
  createWorkingCopyFromNode,
  discardWorkingCopy,
  getChildNames,
  getWorkingCopy,
  updateWorkingCopy,
} from './WorkingCopyOperations';

// Mock database implementations
class MockCoreDB {
  nodes = new Map<NodeId, TreeNode>();

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async getChildren(parentId: NodeId): Promise<TreeNode[]> {
    const children: TreeNode[] = [];
    this.nodes.forEach((node) => {
      if (node.parentNodeId === parentId) {
        children.push(node);
      }
    });
    return children;
  }

  async createNode(node: TreeNode): Promise<NodeId> {
    this.nodes.set(node.id, node);
    return node.id;
  }

  async updateNode(nodeId: NodeId, updates: Partial<TreeNode>): Promise<void> {
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
  workingCopies = new Map<string, WorkingCopy>();

  async getWorkingCopy(id: string): Promise<WorkingCopy | undefined> {
    return this.workingCopies.get(id);
  }

  async getWorkingCopyByNodeId(nodeId: NodeId): Promise<WorkingCopy | undefined> {
    for (const wc of this.workingCopies.values()) {
      if (wc.id === nodeId) {
        return wc;
      }
    }
    return undefined;
  }

  async createWorkingCopy(wc: WorkingCopy): Promise<void> {
    this.workingCopies.set(wc.id, wc);
  }

  async updateWorkingCopy(id: string, updates: Partial<WorkingCopy>): Promise<void> {
    const existing = this.workingCopies.get(id);
    if (existing) {
      this.workingCopies.set(id, { ...existing, ...updates });
    }
  }

  async deleteWorkingCopy(id: string): Promise<void> {
    this.workingCopies.delete(id);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

describe.skip('WorkingCopyOperations', () => {
  let coreDB: MockCoreDB;
  let ephemeralDB: MockEphemeralDB;

  beforeEach(() => {
    coreDB = new MockCoreDB();
    ephemeralDB = new MockEphemeralDB();

    // Add some test nodes
    const rootNode: TreeNode = {
      id: 'root' as NodeId,
      parentNodeId: '' as NodeId,
      nodeType: 'Root' as TreeNodeType,
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const folder1: TreeNode = {
      id: 'folder-1' as NodeId,
      parentNodeId: 'root' as NodeId,
      nodeType: 'folder' as TreeNodeType,
      name: 'Documents',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const folder2: TreeNode = {
      id: 'folder-2' as NodeId,
      parentNodeId: 'root' as NodeId,
      nodeType: 'folder' as TreeNodeType,
      name: 'Documents (2)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    coreDB.nodes.set(rootNode.id, rootNode);
    coreDB.nodes.set(folder1.id, folder1);
    coreDB.nodes.set(folder2.id, folder2);
  });

  describe('createNewDraftWorkingCopy', () => {
    it('should create a draft working copy with unique name', async () => {
      const parentId = 'root' as NodeId;
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
      expect(wc?.originalNodeId).toBeUndefined();
      expect(wc?.parentNodeId).toBe(parentId);
      expect(wc?.nodeType).toBe(nodeType);
    });

    it('should use base name if no conflict', async () => {
      const parentId = 'root' as NodeId;
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
      const parentId = '' as NodeId;
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
      expect(wc?.parentNodeId).toBe(parentId);
    });
  });

  describe('createWorkingCopyFromNode', () => {
    it('should create working copy from existing node', async () => {
      const nodeId = 'folder-1' as NodeId;

      const workingCopyId = await createWorkingCopyFromNode(
        ephemeralDB as any,
        coreDB as any,
        nodeId
      );

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeDefined();
      expect(wc?.originalNodeId).toBe(nodeId);
      expect(wc?.name).toBe('Documents');
      expect((wc as any)?.isDraft).toBe(false);
    });

    it('should throw if node does not exist', async () => {
      const nodeId = 'non-existent' as NodeId;

      await expect(
        createWorkingCopyFromNode(ephemeralDB as any, coreDB as any, nodeId)
      ).rejects.toThrow('Node not found');
    });

    it('should detect existing working copy', async () => {
      const nodeId = 'folder-1' as NodeId;

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
        'root' as NodeId,
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
      const nodeId = 'folder-1' as NodeId;

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
      const nodeId = 'folder-1' as NodeId;

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
        'root' as NodeId,
        'folder' as TreeNodeType,
        'ConflictName'
      );

      // Create a node with the same name before commit
      const conflictNode: TreeNode = {
        id: 'conflict-node' as NodeId,
        parentNodeId: 'root' as NodeId,
        nodeType: 'folder' as TreeNodeType,
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
        'root' as NodeId,
        'folder' as TreeNodeType,
        'TempFolder'
      );

      await discardWorkingCopy(ephemeralDB as any, workingCopyId);

      const wc = await ephemeralDB.getWorkingCopy(workingCopyId);
      expect(wc).toBeUndefined();
    });

    it('should not throw if working copy does not exist', async () => {
      await expect(
        discardWorkingCopy(ephemeralDB as any, 'non-existent' as NodeId)
      ).resolves.not.toThrow();
    });
  });

  describe('getWorkingCopy', () => {
    it('should retrieve working copy by ID', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as NodeId,
        'folder' as TreeNodeType,
        'TestFolder'
      );

      const wc = await getWorkingCopy(ephemeralDB as any, workingCopyId);

      expect(wc).toBeDefined();
      expect(wc?.name).toBe('TestFolder');
    });

    it('should return undefined for non-existent ID', async () => {
      const wc = await getWorkingCopy(ephemeralDB as any, 'non-existent' as NodeId);
      expect(wc).toBeUndefined();
    });
  });

  describe('updateWorkingCopy', () => {
    it('should update working copy properties', async () => {
      const workingCopyId = await createNewDraftWorkingCopy(
        ephemeralDB as any,
        coreDB as any,
        'root' as NodeId,
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
        'root' as NodeId,
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
      const nodeId = 'folder-1' as NodeId;
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
      const nodeId = 'folder-1' as NodeId;
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
        'root' as NodeId,
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
        const names = await getChildNames(coreDB as any, 'root' as NodeId);

        expect(names).toContain('Documents');
        expect(names).toContain('Documents (2)');
        expect(names).toHaveLength(2);
      });

      it('should return empty array for childless node', async () => {
        const names = await getChildNames(coreDB as any, 'folder-1' as NodeId);
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
