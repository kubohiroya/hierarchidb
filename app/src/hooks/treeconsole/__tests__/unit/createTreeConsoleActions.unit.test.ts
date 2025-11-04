import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/feature-core/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';
import { DualKeyMap } from '@hierarchidb/util';
import type { Remote } from 'comlink';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import { preconnectPluginServices } from '../../../../services/preconnect.js';
import { createTreeConsoleActions } from '../../createTreeConsoleActions.js';
import type { TreeConsoleActionDeps } from '../../types.js';

vi.mock('../../../../services/preconnect.js', () => ({
  preconnectPluginServices: vi.fn(async () => {}),
}));

vi.mock('@hierarchidb/util', () => {
  class MockDualKeyMap<K, Secondary, V> {
    private primary: Map<K, V>;
    private secondary: Map<K, Secondary>;

    constructor() {
      this.primary = new Map<K, V>();
      this.secondary = new Map<K, Secondary>();
    }

    set(key: K, value: V, secondary?: Secondary) {
      this.primary.set(key, value);
      if (secondary !== undefined) {
        this.secondary.set(key, secondary);
      }
      return this;
    }

    get(key: K) {
      return this.primary.get(key);
    }

    clone() {
      const copy = new MockDualKeyMap<K, Secondary, V>();
      for (const [key, value] of this.primary.entries()) {
        copy.set(key, value, this.secondary.get(key));
      }
      return copy;
    }
  }

  return { DualKeyMap: MockDualKeyMap };
});

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
    getWorkingCopy: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(workingCopyNode),
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

  const nodeIndex = new DualKeyMap<NodeId, NodeId, TreeNode>();
  nodeIndex.set(
    nodeId,
    {
      id: nodeId,
      parentId: pageNodeId,
      nodeType: 'folder',
      name: 'Existing',
    } as unknown as TreeNode,
    pageNodeId
  );

  const baseSSOT: TreeConsoleSSOTEntry = {
    pageNodeId,
    nodeIndex,
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
    setState: vi.fn(),
    setSSOT: vi.fn(),
    ssot: baseSSOT,
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

  it('renames via context menu rename-dialog action', async () => {
    const originalPrompt = globalThis.prompt;
    globalThis.prompt = vi.fn(() => 'Renamed Folder');

    const mutationAPI = {
      updateNode: vi.fn(async () => ({ success: true })),
    };

    const { deps } = buildDeps({ selectedIds: [] });
    (
      deps.client as unknown as { getMutationAPI: () => Promise<typeof mutationAPI> }
    ).getMutationAPI = vi.fn().mockResolvedValue(mutationAPI);

    const loadChildrenOf = vi.fn(async () => {});
    const refreshUndoRedo = vi.fn(async () => {});
    deps.loadChildrenOf = loadChildrenOf;
    deps.refreshUndoRedo = refreshUndoRedo;

    const actions = createTreeConsoleActions(deps);

    const node: TreeNodeData = {
      id: 'node-1',
      nodeType: 'folder',
      name: 'Existing',
      parentId: 'parent-1',
    } as TreeNodeData;

    await actions.handleContextMenuAction('rename-dialog', node);

    expect(globalThis.prompt).toHaveBeenCalledWith('Enter new name', 'Existing');
    expect(mutationAPI.updateNode).toHaveBeenCalledWith({
      nodeId: 'node-1',
      name: 'Renamed Folder',
    });
    expect(loadChildrenOf).toHaveBeenCalledWith('parent-1');
    expect(refreshUndoRedo).toHaveBeenCalled();

    globalThis.prompt = originalPrompt;
  });
});

describe('createTreeConsoleActions.handleUndoRedo', () => {
  it('executes undo/redo, refreshes data, and dispatches command events', async () => {
    const { deps } = buildDeps();
    const loadChildrenOf = vi.fn(async () => {});
    const refreshUndoRedo = vi.fn(async () => {});
    deps.loadChildrenOf = loadChildrenOf;
    deps.refreshUndoRedo = refreshUndoRedo;

    const undo = vi.fn(async () => ({ success: true, seq: 1 }) as const);
    const redo = vi.fn(async () => ({ success: true, seq: 2 }) as const);
    const cp = { undo, redo, canUndo: () => true, canRedo: () => true };

    (
      deps.client as unknown as { getCommandProcessor?: () => Promise<typeof cp> }
    ).getCommandProcessor = vi.fn().mockResolvedValue(cp);

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const actions = createTreeConsoleActions(deps);

    await actions.handleUndo();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(loadChildrenOf).toHaveBeenCalledWith('parent-1');
    expect(refreshUndoRedo).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalled();
    expect(dispatchSpy.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'hdb-cmd' });

    loadChildrenOf.mockClear();
    refreshUndoRedo.mockClear();

    await actions.handleRedo();

    expect(redo).toHaveBeenCalledTimes(1);
    expect(loadChildrenOf).toHaveBeenCalledWith('parent-1');
    expect(refreshUndoRedo).toHaveBeenCalled();
    expect(dispatchSpy.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'hdb-cmd' });

    dispatchSpy.mockRestore();
  });

  it('surfaces errors when undo fails and skips refresh', async () => {
    const { deps } = buildDeps();
    const loadChildrenOf = vi.fn(async () => {});
    const refreshUndoRedo = vi.fn(async () => {});
    deps.loadChildrenOf = loadChildrenOf;
    deps.refreshUndoRedo = refreshUndoRedo;

    const undo = vi.fn(
      async () =>
        ({ success: false, error: 'No command to undo', code: 'INVALID_OPERATION' }) as const
    );
    const cp = { undo };
    (
      deps.client as unknown as { getCommandProcessor?: () => Promise<typeof cp> }
    ).getCommandProcessor = vi.fn().mockResolvedValue(cp);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const actions = createTreeConsoleActions(deps);

    await actions.handleUndo();

    expect(loadChildrenOf).not.toHaveBeenCalled();
    expect(refreshUndoRedo).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[HDB] Command Error:',
      'INVALID_OPERATION',
      'No command to undo'
    );

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('falls back to tree root when pageNodeId is undefined', async () => {
    const { deps } = buildDeps();
    deps.pageNodeId = undefined;
    deps.ssot = { ...deps.ssot, pageNodeId: '' };

    const loadChildrenOf = vi.fn(async () => {});
    const refreshUndoRedo = vi.fn(async () => {});
    deps.loadChildrenOf = loadChildrenOf;
    deps.refreshUndoRedo = refreshUndoRedo;

    const undo = vi.fn(async () => ({ success: true, seq: 10 }) as const);
    const cp = { undo };
    (
      deps.client as unknown as { getCommandProcessor?: () => Promise<typeof cp> }
    ).getCommandProcessor = vi.fn().mockResolvedValue(cp);

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    const actions = createTreeConsoleActions(deps);
    await actions.handleUndo();

    expect(loadChildrenOf).toHaveBeenCalledWith('tree-1:root');

    dispatchSpy.mockRestore();
  });
});
