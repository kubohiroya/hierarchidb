import type {
  CopyNodesPayload,
  ExportNodesPayload,
  GetAncestorsPayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetNodePayload,
  SearchNodesPayload,
  Timestamp,
  TreeNode,
  TreeNodeId,
  TreeNodeType,
} from '@hierarchidb/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../db/CoreDB';
import { TreeQueryServiceImpl } from './TreeQueryServiceImpl';

// Mock types for testing
type MockCoreDB = {
  treeNodes: Map<TreeNodeId, TreeNode>;
  getNode: any;
  getChildren: any;
  getDescendants: any;
  searchNodes: any;
};

describe('TreeQueryService', () => {
  let service: TreeQueryServiceImpl;
  let coreDB: MockCoreDB;

  // Test data setup
  const createTestNode = (
    id: string,
    parentId: string,
    name: string,
    type: TreeNodeType = 'folder'
  ): TreeNode => ({
    treeNodeId: id as TreeNodeId,
    parentTreeNodeId: parentId as TreeNodeId,
    name,
    treeNodeType: type,
    createdAt: Date.now() as Timestamp,
    updatedAt: Date.now() as Timestamp,
    version: 1,
  });

  beforeEach(() => {
    // Create mock database
    coreDB = {
      treeNodes: new Map<TreeNodeId, TreeNode>(),
      getNode: vi.fn(),
      getChildren: vi.fn(),
      getDescendants: vi.fn(),
      searchNodes: vi.fn(),
    };

    // Configure getNode mock
    coreDB.getNode.mockImplementation((id: TreeNodeId) => {
      return Promise.resolve(coreDB.treeNodes.get(id));
    });

    // Configure getChildren mock
    coreDB.getChildren.mockImplementation(async (parentId: TreeNodeId) => {
      const children = Array.from(coreDB.treeNodes.values()).filter(
        (n) => n.parentTreeNodeId === parentId
      );
      return children.sort((a, b) => a.createdAt - b.createdAt);
    });

    service = new TreeQueryServiceImpl(coreDB as any);

    // Set up test data
    setupTestData();
  });

  const setupTestData = () => {
    // Root structure:
    // root
    // ├── folder1
    // │   ├── subfolder1
    // │   │   └── file1.txt
    // │   └── file2.txt
    // ├── folder2
    // │   └── document.doc
    // └── folder3 (empty)

    const nodes = [
      createTestNode('root', '', 'Root'),
      createTestNode('folder1', 'root', 'Folder 1'),
      createTestNode('folder2', 'root', 'Folder 2'),
      createTestNode('folder3', 'root', 'Empty Folder'),
      createTestNode('subfolder1', 'folder1', 'Subfolder 1'),
      createTestNode('file1', 'subfolder1', 'file1.txt', 'file'),
      createTestNode('file2', 'folder1', 'file2.txt', 'file'),
      createTestNode('doc1', 'folder2', 'document.doc', 'file'),
    ];

    nodes.forEach((node) => {
      coreDB.treeNodes.set(node.treeNodeId, node);
    });
  };

  describe('Basic Query Operations', () => {
    describe('getNode', () => {
      it('should return existing node', async () => {
        const payload: GetNodePayload = {
          treeNodeId: 'folder1' as TreeNodeId,
        };

        const result = await service.getNode(payload);

        expect(result).toBeDefined();
        expect(result?.treeNodeId).toBe('folder1');
        expect(result?.name).toBe('Folder 1');
        expect(coreDB.getNode).toHaveBeenCalledWith('folder1');
      });

      it('should return undefined for non-existent node', async () => {
        const payload: GetNodePayload = {
          treeNodeId: 'non-existent' as TreeNodeId,
        };

        const result = await service.getNode(payload);

        expect(result).toBeUndefined();
        expect(coreDB.getNode).toHaveBeenCalledWith('non-existent');
      });
    });

    describe('getChildren', () => {
      it('should return children of existing node', async () => {
        const payload: GetChildrenPayload = {
          parentTreeNodeId: 'root' as TreeNodeId,
        };

        const result = await service.getChildren(payload);

        expect(result).toHaveLength(3);
        expect(result.map((n) => n.name)).toEqual(['Folder 1', 'Folder 2', 'Empty Folder']);
        expect(coreDB.getChildren).toHaveBeenCalledWith('root');
      });

      it('should return empty array for node with no children', async () => {
        const payload: GetChildrenPayload = {
          parentTreeNodeId: 'folder3' as TreeNodeId,
        };

        const result = await service.getChildren(payload);

        expect(result).toEqual([]);
        expect(coreDB.getChildren).toHaveBeenCalledWith('folder3');
      });

      it('should support sorting by name', async () => {
        // Add some nodes with specific names for sorting
        const nodeA = createTestNode('nodeA', 'root', 'Alpha');
        const nodeZ = createTestNode('nodeZ', 'root', 'Zeta');
        coreDB.treeNodes.set(nodeA.treeNodeId, nodeA);
        coreDB.treeNodes.set(nodeZ.treeNodeId, nodeZ);

        const payload: GetChildrenPayload = {
          parentTreeNodeId: 'root' as TreeNodeId,
          sortBy: 'name',
          sortOrder: 'asc',
        };

        const result = await service.getChildren(payload);

        // Should be sorted alphabetically
        expect(result[0]?.name).toBe('Alpha');
        expect(result[result.length - 1]?.name).toBe('Zeta');
      });

      it('should support limit and offset', async () => {
        const payload: GetChildrenPayload = {
          parentTreeNodeId: 'root' as TreeNodeId,
          limit: 2,
          offset: 1,
        };

        const result = await service.getChildren(payload);

        expect(result).toHaveLength(2);
        expect(result[0]?.name).toBe('Folder 2'); // Skip first, take next 2
      });
    });

    describe('getDescendants', () => {
      it('should return all descendants', async () => {
        const payload: GetDescendantsPayload = {
          rootNodeId: 'folder1' as TreeNodeId,
        };

        const result = await service.getDescendants(payload);

        expect(result).toHaveLength(3); // subfolder1, file1, file2
        expect(result.map((n) => n.name)).toContain('Subfolder 1');
        expect(result.map((n) => n.name)).toContain('file1.txt');
        expect(result.map((n) => n.name)).toContain('file2.txt');
      });

      it('should respect maxDepth limitation', async () => {
        const payload: GetDescendantsPayload = {
          rootNodeId: 'folder1' as TreeNodeId,
          maxDepth: 1,
        };

        const result = await service.getDescendants(payload);

        // Only direct children, not grandchildren
        expect(result).toHaveLength(2); // subfolder1, file2
        expect(result.map((n) => n.name)).toContain('Subfolder 1');
        expect(result.map((n) => n.name)).toContain('file2.txt');
        expect(result.map((n) => n.name)).not.toContain('file1.txt'); // grandchild excluded
      });

      it('should filter by node types', async () => {
        const payload: GetDescendantsPayload = {
          rootNodeId: 'folder1' as TreeNodeId,
          includeTypes: ['file'],
        };

        const result = await service.getDescendants(payload);

        expect(result).toHaveLength(2); // file1, file2
        expect(result.every((n) => n.treeNodeType === 'file')).toBe(true);
      });
    });

    describe('getAncestors', () => {
      it('should return path from node to root', async () => {
        const payload: GetAncestorsPayload = {
          nodeId: 'file1' as TreeNodeId,
        };

        const result = await service.getAncestors(payload);

        // Should be ordered from child to root: file1 -> subfolder1 -> folder1 -> root
        expect(result).toHaveLength(4);
        expect(result[0]?.name).toBe('file1.txt');
        expect(result[1]?.name).toBe('Subfolder 1');
        expect(result[2]?.name).toBe('Folder 1');
        expect(result[3]?.name).toBe('Root');
      });

      it('should return only root for root node', async () => {
        const payload: GetAncestorsPayload = {
          nodeId: 'root' as TreeNodeId,
        };

        const result = await service.getAncestors(payload);

        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe('Root');
      });

      it('should return empty array for non-existent node', async () => {
        const payload: GetAncestorsPayload = {
          nodeId: 'non-existent' as TreeNodeId,
        };

        const result = await service.getAncestors(payload);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Search Operations', () => {
    describe('searchNodes', () => {
      it('should find nodes by name substring', async () => {
        const payload: SearchNodesPayload = {
          query: 'file',
        };

        const result = await service.searchNodes(payload);

        expect(result).toHaveLength(2);
        expect(result.map((n) => n.name)).toContain('file1.txt');
        expect(result.map((n) => n.name)).toContain('file2.txt');
      });

      it('should support case-insensitive search', async () => {
        const payload: SearchNodesPayload = {
          query: 'FOLDER',
          caseSensitive: false,
        };

        const result = await service.searchNodes(payload);

        expect(result.length).toBeGreaterThan(0);
        expect(result.some((n) => n.name.includes('Folder'))).toBe(true);
      });

      it('should limit search to specific subtree', async () => {
        const payload: SearchNodesPayload = {
          query: 'file',
          rootNodeId: 'folder1' as TreeNodeId,
        };

        const result = await service.searchNodes(payload);

        // Should only find files under folder1, not document.doc under folder2
        expect(result).toHaveLength(2);
        expect(result.map((n) => n.name)).not.toContain('document.doc');
      });

      it('should support regex search', async () => {
        const payload: SearchNodesPayload = {
          query: '.*\\.txt$',
          useRegex: true,
        };

        const result = await service.searchNodes(payload);

        expect(result).toHaveLength(2);
        expect(result.every((n) => n.name.endsWith('.txt'))).toBe(true);
      });
    });
  });

  describe('Copy/Export Operations', () => {
    describe('copyNodes', () => {
      it('should copy single node', async () => {
        const payload: CopyNodesPayload = {
          nodeIds: ['folder1' as TreeNodeId],
        };

        const result = await service.copyNodes(payload);

        expect(result.success).toBe(true);
        // Should return clipboard data structure
      });

      it('should copy multiple nodes', async () => {
        const payload: CopyNodesPayload = {
          nodeIds: ['folder1' as TreeNodeId, 'folder2' as TreeNodeId],
        };

        const result = await service.copyNodes(payload);

        expect(result.success).toBe(true);
      });
    });

    describe('exportNodes', () => {
      it('should export nodes to external format', async () => {
        const payload: ExportNodesPayload = {
          nodeIds: ['folder1' as TreeNodeId],
        };

        const result = await service.exportNodes(payload);

        expect(result.success).toBe(true);
        // Should return export data
      });

      it('should handle empty node list', async () => {
        const payload: ExportNodesPayload = {
          nodeIds: [],
        };

        const result = await service.exportNodes(payload);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of children efficiently', async () => {
      // Create a large number of child nodes
      const parentId = 'large-parent' as TreeNodeId;
      const parentNode = createTestNode(parentId, 'root', 'Large Parent');
      coreDB.treeNodes.set(parentId, parentNode);

      // Create 1000 children
      for (let i = 0; i < 1000; i++) {
        const childId = `child-${i}` as TreeNodeId;
        const child = createTestNode(childId, parentId, `Child ${i}`);
        coreDB.treeNodes.set(childId, child);
      }

      const startTime = performance.now();

      const payload: GetChildrenPayload = {
        parentTreeNodeId: parentId,
      };

      const result = await service.getChildren(payload);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });

    it('should handle deep tree traversal efficiently', async () => {
      // Create a deep tree (100 levels)
      let currentParent = 'root';
      for (let i = 0; i < 100; i++) {
        const nodeId = `deep-${i}` as TreeNodeId;
        const node = createTestNode(nodeId, currentParent, `Deep Node ${i}`);
        coreDB.treeNodes.set(nodeId, node);
        currentParent = nodeId;
      }

      const startTime = performance.now();

      const payload: GetAncestorsPayload = {
        nodeId: 'deep-99' as TreeNodeId,
      };

      const result = await service.getAncestors(payload);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(101); // deep-99 + deep-98 + ... + deep-0 + root
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      coreDB.getNode.mockRejectedValue(new Error('Database connection failed'));

      const payload: GetNodePayload = {
        treeNodeId: 'test' as TreeNodeId,
      };

      await expect(service.getNode(payload)).rejects.toThrow('Database connection failed');
    });

    it('should handle circular references in tree traversal', async () => {
      // Create circular reference (this shouldn't happen in normal operation)
      const nodeA = createTestNode('nodeA', 'nodeB', 'Node A');
      const nodeB = createTestNode('nodeB', 'nodeA', 'Node B');
      coreDB.treeNodes.set('nodeA' as TreeNodeId, nodeA);
      coreDB.treeNodes.set('nodeB' as TreeNodeId, nodeB);

      const payload: GetAncestorsPayload = {
        nodeId: 'nodeA' as TreeNodeId,
      };

      const result = await service.getAncestors(payload);

      // Should detect circular reference and stop
      expect(result.length).toBeLessThan(100); // Arbitrary limit to prevent infinite loop
    });
  });
});
