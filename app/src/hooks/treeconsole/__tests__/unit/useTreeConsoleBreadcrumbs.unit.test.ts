import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { renderHook, waitFor } from '@testing-library/react';
import type { Remote } from 'comlink';
import { describe, expect, it, vi } from 'vitest';
import { useTreeConsoleBreadcrumbs } from '../../useTreeConsoleBreadcrumbs.js';

function createTreeNode(options: {
  id: string;
  parentId: string | null;
  name: string;
  depth?: number;
  nodeType?: NodeType;
}): TreeNode {
  const now = Date.now();
  return {
    id: options.id as NodeId,
    parentId: (options.parentId ?? 'super-root') as NodeId,
    nodeType: options.nodeType ?? ('folder' as NodeType),
    metadata: { name: options.name, description: '', tags: [] },
    draftMetadata: null,
    depth: options.depth ?? 0,
    createdAt: now,
    updatedAt: now,
    version: 1,
    visible: true,
    data: {},
    draftData: undefined,
  };
}

function createClient(ancestors: TreeNode[]): Remote<WorkerAPI> {
  return {
    getQueryAPI: vi.fn(async () => ({
      listAncestors: vi.fn(async () => ancestors),
    })),
  } as unknown as Remote<WorkerAPI>;
}

describe('useTreeConsoleBreadcrumbs', () => {
  it('always includes the root Resources node as the first breadcrumb entry', async () => {
    const ancestors = [
      createTreeNode({ id: 'r:root', parentId: null, name: 'Resources', depth: 0 }),
      createTreeNode({ id: 'r:folder-a', parentId: 'r:root', name: 'Folder A', depth: 1 }),
    ];
    const client = createClient(ancestors);
    const pageTreeNode = createTreeNode({
      id: 'r:folder-b',
      parentId: 'r:folder-a',
      name: 'Folder B',
      depth: 2,
    });

    const { result } = renderHook(() =>
      useTreeConsoleBreadcrumbs({
        client,
        pageTreeNode,
      })
    );

    await waitFor(() => {
      expect(result.current.length).toBe(3);
    });

    expect(result.current.map((node) => node.id)).toEqual(['r:root', 'r:folder-a', 'r:folder-b']);
  });

  it('shows an ellipsis when the breadcrumb chain exceeds the maximum but keeps the root first', async () => {
    const ancestors = [
      createTreeNode({ id: 'r:root', parentId: null, name: 'Resources', depth: 0 }),
      createTreeNode({ id: 'r:folder-a', parentId: 'r:root', name: 'Alpha', depth: 1 }),
      createTreeNode({ id: 'r:folder-b', parentId: 'r:folder-a', name: 'Beta', depth: 2 }),
      createTreeNode({ id: 'r:folder-c', parentId: 'r:folder-b', name: 'Gamma', depth: 3 }),
    ];
    const client = createClient(ancestors);
    const pageTreeNode = createTreeNode({
      id: 'r:folder-d',
      parentId: 'r:folder-c',
      name: 'Delta',
      depth: 4,
    });

    const { result } = renderHook(() =>
      useTreeConsoleBreadcrumbs({
        client,
        pageTreeNode,
        maxBreadcrumbItems: 4,
      })
    );

    await waitFor(() => {
      expect(result.current.length).toBe(4);
    });

    const nodes = result.current;
    expect(nodes[0]!.id).toBe('r:root');
    expect(nodes[1]!.name).toBe('…');
    expect(nodes.map((node) => node.id)).toEqual([
      'r:root',
      '__ellipsis__',
      'r:folder-c',
      'r:folder-d',
    ]);
  });
});
