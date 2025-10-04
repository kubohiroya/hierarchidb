/**
 * Unit tests for tree loaders
 * Testing the loader functions that will be used by TanStack Router
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadTree, loadPageNode, loadTargetNode, loadNodeType, loadNodeAction } from '../treeLoaders.js';

// Mock the loader module
vi.mock('~/loader.js', () => ({
  loadWorkerAPIClient: vi.fn(),
  loadTree: vi.fn(),
  loadPageNode: vi.fn(),
  loadTargetNode: vi.fn(),
  loadNodeType: vi.fn(),
  loadNodeAction: vi.fn(),
}));

describe('Tree Loaders for TanStack Router', () => {
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
        return { tree: undefined, client: {} as any };
      });

      await expect(loadTree({ treeId: '' })).rejects.toThrow('treeId is required');
    });

    it('should load tree data when treeId is provided', async () => {
      const mockTree = { id: 'r', name: 'Resource Tree' };
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadTree).mockResolvedValue({
        tree: mockTree as any,
        client: {} as any,
      });

      const result = await loadTree({ treeId: 'r' });
      expect(result).toHaveProperty('tree');
      expect(result.tree).toEqual(mockTree);
    });
  });

  describe('loadPageNode', () => {
    it('should load page node with resolved pageNodeId', async () => {
      const mockPageNode = { id: 'r:root', name: 'Root' };
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadPageNode).mockResolvedValue({
        tree: { id: 'r', name: 'Resource Tree' } as any,
        client: {} as any,
        pageNodeId: 'r:root' as any,
        pageNode: mockPageNode as any,
      });

      const result = await loadPageNode({ treeId: 'r', pageNodeId: 'r:root' });
      expect(result).toHaveProperty('pageNode');
      expect(result.pageNode).toEqual(mockPageNode);
    });
  });

  describe('loadTargetNode', () => {
    it('should load target node data', async () => {
      const mockTargetNode = { id: 'target123', name: 'Target' };
      const loaderModule = await import('~/loader.js');
      vi.mocked(loaderModule.loadTargetNode).mockResolvedValue({
        tree: { id: 'r', name: 'Resource Tree' } as any,
        client: {} as any,
        pageNodeId: 'r:root' as any,
        pageNode: undefined,
        targetNodeId: 'target123' as any,
        targetNode: mockTargetNode as any,
      });

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
        tree: { id: 'r', name: 'Resource Tree' } as any,
        client: {} as any,
        pageNodeId: 'r:root' as any,
        pageNode: undefined,
        targetNodeId: 'target123' as any,
        targetNode: {} as any,
        nodeType: 'folder' as any,
      });

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
        tree: { id: 'r', name: 'Resource Tree' } as any,
        client: {} as any,
        pageNodeId: 'r:root' as any,
        pageNode: undefined,
        targetNodeId: 'target123' as any,
        targetNode: {} as any,
        nodeType: 'folder' as any,
        action: 'edit' as any,
      });

      const result = await loadNodeAction({
        treeId: 'r',
        pageNodeId: 'r:root',
        targetNodeId: 'target123',
        nodeType: 'folder',
        action: 'edit',
      });
      expect(result).toHaveProperty('action');
      expect(result.action).toBe('edit');
    });
  });
});
