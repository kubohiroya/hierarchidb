import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeConsoleState } from '../types.js';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import { useTreeConsoleLoader } from '../useTreeConsoleLoader.js';

vi.mock('~/services/preconnect.js', () => ({
  preconnectForNodeTypes: vi.fn(),
}));

function createNode(id: string, overrides: Partial<TreeNode> = {}): TreeNode {
  const now = Date.now();
  return {
    id: id as NodeId,
    parentId: (overrides.parentId ?? 'root') as NodeId,
    nodeType: (overrides.nodeType ?? 'folder') as TreeNode['nodeType'],
    name: overrides.name ?? id,
    depth: overrides.depth ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    version: overrides.version ?? 1,
    hasChildren: overrides.hasChildren ?? false,
    ...overrides,
  } as TreeNode;
}

describe('useTreeConsoleLoader (trash flatten)', () => {
  it('flattens holder children when loading the trash root', async () => {
    const trashRootId = 'r:trash' as NodeId;
    const holderA = createNode('holder-a', { parentId: trashRootId, nodeType: 'trash-holder', hasChildren: true });
    const holderB = createNode('holder-b', { parentId: trashRootId, nodeType: 'trash-holder', hasChildren: true });
    const childA = createNode('trash-node-a', {
      parentId: holderA.id as NodeId,
      nodeType: 'trash-item',
      originalName: 'Original A',
      originalParentId: 'a:parent' as NodeId,
    });
    const childB = createNode('trash-node-b', {
      parentId: holderB.id as NodeId,
      nodeType: 'trash-item',
      originalName: 'Original B',
      originalParentId: 'b:parent' as NodeId,
    });

    const listChildren = vi.fn(async (parentId: NodeId) => {
      if (parentId === trashRootId) {
        return [holderA, holderB];
      }
      if (parentId === holderA.id) {
        return [childA];
      }
      if (parentId === holderB.id) {
        return [childB];
      }
      return [];
    });

    const queryAPI = {
      listChildren,
    };

    const client = {
      getQueryAPI: vi.fn(async () => queryAPI),
    } as unknown as Remote<WorkerAPI>;

    const baseState: TreeConsoleState = {
      loading: false,
      error: null,
      availableFilters: [],
      canGoBack: false,
      canGoForward: false,
      canUndo: false,
      canRedo: false,
      canPaste: false,
    };

    const ssotState: TreeConsoleSSOTEntry = {};
    const setState = vi.fn((update) => {
      if (typeof update === 'function') {
        Object.assign(baseState, update(baseState));
      } else {
        Object.assign(baseState, update);
      }
    });

    const latestPatch: TreeConsoleSSOTEntry = {};
    const setSSOT = vi.fn((patch: Partial<TreeConsoleSSOTEntry>) => {
      Object.assign(latestPatch, patch);
    });

    const { result } = renderHook(() => useTreeConsoleLoader({
      client,
      pageNodeId: trashRootId,
      pageTreeNode: { id: trashRootId, nodeType: 'trash' } as TreeNode,
      state: baseState,
      searchTerm: '',
      expandedIds: [],
      ssot: ssotState,
      setState,
      setSSOT,
    }));

    await act(async () => {
      await result.current.loadChildrenOf(trashRootId);
    });

    expect(client.getQueryAPI).toHaveBeenCalledTimes(1);
    expect(listChildren).toHaveBeenCalledTimes(3);
    expect(listChildren).toHaveBeenNthCalledWith(1, trashRootId);
    expect(listChildren).toHaveBeenNthCalledWith(2, holderA.id);
    expect(listChildren).toHaveBeenNthCalledWith(3, holderB.id);

    const rawNodes = latestPatch.rawNodes as TreeNode[] | undefined;
    expect(rawNodes).toBeDefined();
    expect(rawNodes?.map((node) => node.id)).toEqual([childA.id, childB.id]);
  });
});
