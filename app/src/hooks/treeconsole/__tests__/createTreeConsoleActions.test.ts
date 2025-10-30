import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TreeConsoleActionDeps } from '../types.js';
import { createTreeConsoleActions } from '../createTreeConsoleActions.js';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import type { TreeId, TreeNode, NodeId } from '@hierarchidb/feature-core/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';
import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';
import type { Remote } from 'comlink';
import { preconnectPluginServices } from '../../../services/preconnect.js';

vi.mock('../../../services/preconnect.js', () => ({
  preconnectPluginServices: vi.fn(async () => {}),
}));

const preconnectSpy = vi.mocked(preconnectPluginServices);

type MockWorkingCopy = {
  getWorkingCopy: ReturnType<typeof vi.fn>;
  createWorkingCopyFromNode: ReturnType<typeof vi.fn>;
};

function buildDeps(overrides: Partial<TreeConsoleActionDeps> = {}): {
  deps: TreeConsoleActionDeps;
  workingCopyApi: MockWorkingCopy;
  pushPath: ReturnType<typeof vi.fn>;
} {
  const nodeId = 'node-1' as NodeId;
  const treeId = 'tree-1' as TreeId;
  const pageNodeId = 'parent-1' as NodeId;

  const workingCopyNode = {
    id: 'wc-1',
    parentId: 'holder-1',
    nodeType: 'folder',
    name: 'Draft Folder',
  } as unknown as TreeNode;

  const workingCopyApi = {
    getWorkingCopy: vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(workingCopyNode),
    createWorkingCopyFromNode: vi.fn(async () => workingCopyNode),
  } as MockWorkingCopy;

  const queryApi = {
    getNode: vi.fn(async () => ({
      id: nodeId,
      parentId: pageNodeId,
      nodeType: 'folder',
    })),
  };

  const client = {
    getWorkingCopyAPI: vi.fn(async () => workingCopyApi),
    getQueryAPI: vi.fn(async () => queryApi),
  } as unknown as Remote<WorkerAPI>;

  const baseSSOT: TreeConsoleSSOTEntry = {
    pageNodeId,
    rawNodes: [],
    treeData: [],
    nodesById: new Map<string, TreeNode>([[String(nodeId), {
      id: nodeId,
      parentId: pageNodeId,
      nodeType: 'folder',
      name: 'Existing',
    } as unknown as TreeNode]]),
    childrenByParent: new Map(),
    selectedIds: [nodeId],
    expandedIds: [],
    searchTerm: '',
    viewMode: 'list',
    sortBy: 'name',
    sortDirection: 'asc',
    filterBy: '',
    canUndo: false,
    canRedo: false,
    canPaste: false,
    loading: false,
    error: null,
    refCount: 0,
  };

  const pushPath = vi.fn();

  const deps: TreeConsoleActionDeps = {
    client,
    treeId,
    pageNodeId,
    pageTreeNode: undefined,
    pushPath,
    searchTerm: '',
    selectedIds: [nodeId],
    expandedIds: [],
    treeData: [],
    setState: vi.fn(),
    setSSOT: vi.fn(),
    ssot: baseSSOT,
    applySortFilterSearch: (nodes) => nodes,
    loadChildrenOf: vi.fn(async () => {}),
    refreshUndoRedo: vi.fn(async () => {}),
    importExport: {
      detectFileFormat: vi.fn(),
      importFile: vi.fn(),
      exportNodes: vi.fn(),
    },
    teardownSubscription: vi.fn(async () => {}),
    setupSubscription: vi.fn(async () => {}),
    ...overrides,
  };

  return { deps, workingCopyApi, pushPath };
}

describe('createTreeConsoleActions.handleEdit', () => {
  beforeEach(() => {
    preconnectSpy.mockClear();
  });

  it('creates a working copy when missing and navigates to edit dialog', async () => {
    const { deps, workingCopyApi, pushPath } = buildDeps();
    const actions = createTreeConsoleActions(deps);

    await actions.handleEdit();

    expect(workingCopyApi.getWorkingCopy).toHaveBeenCalledTimes(2);
    expect(workingCopyApi.createWorkingCopyFromNode).toHaveBeenCalledWith('node-1');
    expect(pushPath).toHaveBeenCalledWith('/t/tree-1/parent-1/wc-1/folder/edit');
    expect(preconnectSpy).toHaveBeenCalledWith('folder');
  });

  it('reuses existing working copy without creating a new one', async () => {
    const existingWorkingCopy = {
      id: 'wc-existing',
      parentId: 'holder',
      nodeType: 'folder',
    } as unknown as TreeNode;

    const { deps, workingCopyApi, pushPath } = buildDeps();
    workingCopyApi.getWorkingCopy.mockReset();
    workingCopyApi.getWorkingCopy.mockResolvedValue(existingWorkingCopy);

    const actions = createTreeConsoleActions(deps);

    await actions.handleEdit();

    expect(workingCopyApi.createWorkingCopyFromNode).not.toHaveBeenCalled();
    expect(pushPath).toHaveBeenCalledWith('/t/tree-1/parent-1/wc-existing/folder/edit');
  });

  it('invokes edit dialog when triggered via context menu rename-dialog action', async () => {
    const { deps, workingCopyApi, pushPath } = buildDeps({ selectedIds: [] });
    workingCopyApi.getWorkingCopy.mockReset();
    workingCopyApi.getWorkingCopy.mockResolvedValue({
      id: 'wc-from-context',
      nodeType: 'folder',
    } as unknown as TreeNode);

    const setSSOT = vi.fn();
    deps.setSSOT = setSSOT;

    const actions = createTreeConsoleActions(deps);

    const node: TreeNodeData = {
      id: 'node-1',
      nodeType: 'folder',
      name: 'Existing',
    } as TreeNodeData;

    await actions.handleContextMenuAction('rename-dialog', node);

    expect(setSSOT).toHaveBeenCalledWith({ selectedIds: ['node-1'] });
    expect(pushPath).toHaveBeenCalledWith('/t/tree-1/parent-1/wc-from-context/folder/edit');
  });
});
