/**
 * Unit tests for console loaders
 * Testing the loader functions that will be used by TanStack Router
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  NodeAction,
  NodeId,
  NodeType,
  Tree,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LoadNodeActionReturn,
  LoadNodeTypeReturn,
  LoadPageNodeReturn,
  LoadTargetNodeReturn,
  LoadTreeReturn,
} from '~/loader.js';
import {
  loadNodeAction,
  loadNodeType,
  loadPageNode,
  loadTargetNode,
  loadTree,
} from '../../treeLoaders.js';

// Mock the loader module
vi.mock('~/loader.js', () => ({
  loadWorkerAPIClient: vi.fn(),
  loadTree: vi.fn(),
  loadPageNode: vi.fn(),
  loadTargetNode: vi.fn(),
  loadNodeType: vi.fn(),
  loadNodeAction: vi.fn(),
}));

function createMockClient(): Remote<WorkerAPI> {
  return {} as unknown as Remote<WorkerAPI>;
}

function createTree(overrides: Partial<Tree> = {}): Tree {
  return {
    id: 'console-1' as TreeId,
    name: 'Mock console',
    rootId: 'console-1:root' as NodeId,
    trashRootId: 'console-1:trash' as NodeId,
    superRootId: 'console-1:super' as NodeId,
    ...overrides,
  };
}

function createTreeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  const nameOverride = (overrides as { name?: string }).name;
  const descOverride = (overrides as { description?: string }).description;
  const { name, description, ...rest } = overrides as {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
  return {
    id: 'node-1' as NodeId,
    parentId: 'console-1:root' as NodeId,
    nodeType: 'folder' as NodeType,
    metadata: { name: nameOverride ?? 'Mock Node', description: descOverride ?? '', tags: [] },
    draftMetadata: null,
    data: null,
    draftData: null,
    depth: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...(rest as Partial<TreeNode>),
    visible: true,
  };
}

describe('console Loaders for TanStack Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadTree', () => {
    it('should throw error when treeId is missing', async () => {
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadTree).mockImplementation(async ({ treeId }) => {
        if (!treeId) {
          throw new Error('treeId is required');
        }
        return {
          tree: undefined,
          client: createMockClient(),
        } satisfies LoadTreeReturn;
      });

      await expect(loadTree({ treeId: '' })).rejects.toThrow('treeId is required');
    });

    it('should load console data when treeId is provided', async () => {
      const mockTree = createTree({ id: 'r' as TreeId, name: 'Resource console' });
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadTree).mockResolvedValue({
        tree: mockTree,
        client: createMockClient(),
      } satisfies LoadTreeReturn);

      const result = await loadTree({ treeId: 'r' });
      expect(result).toHaveProperty('tree');
      expect(result.tree).toEqual(mockTree);
    });
  });

  describe('loadPageNode', () => {
    it('should load page node with resolved pageNodeId', async () => {
      const mockPageNode = createTreeNode({
        id: 'r:root' as NodeId,
        metadata: { name: 'Root', description: '', tags: [] },
      });
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadPageNode).mockResolvedValue({
        tree: createTree({ id: 'r' as TreeId }),
        client: createMockClient(),
        pageNodeId: mockPageNode.id,
        pageNode: mockPageNode,
      } satisfies LoadPageNodeReturn);

      const result = await loadPageNode({ treeId: 'r', pageNodeId: 'r:root' });
      expect(result).toHaveProperty('pageNode');
      expect(result.pageNode).toEqual(mockPageNode);
    });
  });

  describe('loadTargetNode', () => {
    it('should load target node data', async () => {
      const mockTargetNode = createTreeNode({
        id: 'target123' as NodeId,
        metadata: { name: 'Target', description: '', tags: [] },
      });
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadTargetNode).mockResolvedValue({
        tree: createTree({ id: 'r' as TreeId }),
        client: createMockClient(),
        pageNodeId: 'r:root' as NodeId,
        pageNode: undefined,
        targetNodeId: mockTargetNode.id,
        targetNode: mockTargetNode,
      } satisfies LoadTargetNodeReturn);

      const result = await loadTargetNode({
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'target123',
      });
      expect(result).toHaveProperty('targetNode');
      expect(result.targetNode).toEqual(mockTargetNode);
    });
  });

  describe('loadNodeType', () => {
    it('should load node type data', async () => {
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadNodeType).mockResolvedValue({
        tree: createTree({ id: 'r' as TreeId }),
        client: createMockClient(),
        pageNodeId: 'r:root' as NodeId,
        pageNode: undefined,
        targetNodeId: 'target123' as NodeId,
        targetNode: createTreeNode({ id: 'target123' as NodeId }),
        nodeType: 'folder' as NodeType,
      } satisfies LoadNodeTypeReturn);

      const result = await loadNodeType({
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'target123',
        nodeType: 'folder',
      });
      expect(result).toHaveProperty('nodeType');
      expect(result.nodeType).toBe('folder');
    });
  });

  describe('loadNodeAction', () => {
    it('should load node action data', async () => {
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadNodeAction).mockResolvedValue({
        tree: createTree({ id: 'r' as TreeId }),
        client: createMockClient(),
        pageNodeId: 'r:root' as NodeId,
        pageNode: undefined,
        targetNodeId: 'target123' as NodeId,
        targetNode: createTreeNode({ id: 'target123' as NodeId }),
        nodeType: 'folder' as NodeType,
        action: 'update' as NodeAction,
      } satisfies LoadNodeActionReturn);

      const result = await loadNodeAction({
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'target123',
        nodeType: 'folder',
        action: 'edit',
      });
      expect(result).toHaveProperty('action');
      expect(result.action).toBe('update');
    });
  });
});
