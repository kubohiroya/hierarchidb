import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeConsoleToolbarProps } from '@hierarchidb/ui-treeconsole-toolbar';

const toolbarMock = vi.fn((_props: TreeConsoleToolbarProps) => null);

vi.mock('@hierarchidb/ui-treeconsole-toolbar', () => ({
  TreeConsoleToolbar: (props: TreeConsoleToolbarProps) => toolbarMock(props) || null,
}));

vi.mock('@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb', () => ({
  TreeConsoleBreadcrumb: () => null,
}));

vi.mock('../TreeConsolePanelWithDynamicSpeedDial.js', () => ({
  TreeConsolePanelWithDynamicSpeedDial: () => null,
}));

vi.mock('../TreeNodeInfoPanel.js', () => ({
  TreeNodeInfoPanel: () => null,
}));

const mockHookActions = {
  handleUndo: vi.fn(),
  handleRedo: vi.fn(),
  handleCut: vi.fn(),
  handleCopy: vi.fn(),
  handlePaste: vi.fn(),
  handleDuplicate: vi.fn(),
  handleTrash: vi.fn(),
  handleImport: vi.fn(),
  handleExport: vi.fn(),
  handleContextMenuAction: vi.fn(),
  handleSearchChange: vi.fn(),
  handleSearchCommit: vi.fn(),
  handleSearchModeChange: vi.fn(),
  handleNodeClick: vi.fn(),
  handleNodeSelect: vi.fn(),
  handleNodeExpand: vi.fn(),
  handleSearchClear: vi.fn(),
  handleCreate: vi.fn(),
  handleEdit: vi.fn(),
  handleRefresh: vi.fn(),
  handleExpandAll: vi.fn(),
  handleCollapseAll: vi.fn(),
  handleSort: vi.fn(),
  handleFilterChange: vi.fn(),
  handleViewModeChange: vi.fn(),
  handleBreadcrumbNavigate: vi.fn(),
  handleNavigateBack: vi.fn(),
  handleNavigateForward: vi.fn(),
  handleMoveNodes: vi.fn(),
};

const useTreeConsoleIntegrationMock = vi.fn(() => ({
  loading: false,
  error: null,
  treeData: [],
  nodeIndex: new Map(),
  columns: [],
  breadcrumbItems: [],
  selectedIds: [],
  expandedIds: [],
  searchTerm: '',
  searchMode: 'local' as const,
  viewMode: 'list' as const,
  canCreate: true,
  canEdit: true,
  canTrash: true,
  actions: mockHookActions,
  state: {
    canUndo: false,
    canRedo: false,
    canPaste: false,
    canGoBack: false,
    canGoForward: false,
    loading: false,
    error: null,
    sortBy: 'name' as const,
    sortDirection: 'asc' as const,
    filterBy: '',
    availableFilters: [],
    viewMode: 'list' as const,
  },
}));

vi.mock('~/hooks/useTreeConsoleIntegration.ts', () => ({
  useTreeConsoleIntegration: () => useTreeConsoleIntegrationMock(),
}));

const workerClientStub = {
  getQueryAPI: vi.fn(async () => ({
    getTree: vi.fn(async () => ({ trashRootId: 'r:trash' })),
    listChildren: vi.fn(async () => []),
  })),
  getSubscriptionAPI: vi.fn(async () => ({})),
};

vi.mock('~/contexts/WorkerProvider.tsx', () => ({
  useWorker: () => ({ client: workerClientStub, isConnected: true }),
}));

vi.mock('~/hooks/SubscriptionServices.ts', () => ({
  Subscriptions: {
    subscribe: vi.fn(async () => ({ subId: 'sub-1', created: true })),
    release: vi.fn(async () => {}),
    getActive: vi.fn(() => null),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/t/r/root', searchStr: '' }),
  useNavigate: () => vi.fn(),
}));

import { TreeConsoleIntegration, canImportFromNode } from '../TreeConsoleIntegration.js';

const buildNode = (overrides: Partial<TreeNode>): TreeNode =>
  ({
    id: 'r:node' as NodeId,
    parentId: 'r:root' as NodeId,
    nodeType: 'folder' as NodeType,
    metadata: { name: 'Folder', description: '', tags: [] },
    draftMetadata: null,
    data: null,
    draftData: null,
    depth: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...(overrides as Partial<TreeNode>),
  }) as TreeNode;

describe('canImportFromNode', () => {
  it('allows import when node is undefined', () => {
    expect(canImportFromNode(undefined)).toBe(true);
  });

  it('allows import when nodeType is folder (case insensitive)', () => {
    expect(canImportFromNode(buildNode({ nodeType: 'folder' as NodeType }))).toBe(true);
    expect(canImportFromNode(buildNode({ nodeType: 'Folder' as NodeType }))).toBe(true);
  });

  it('blocks import when nodeType is not folder', () => {
    expect(canImportFromNode(buildNode({ nodeType: 'document' as NodeType }))).toBe(false);
  });
});

describe('TreeConsoleIntegration toolbar import guard', () => {
  beforeEach(() => {
    toolbarMock.mockClear();
  });

  it('sets allowImport=true when page node is a folder', () => {
    render(
      <TreeConsoleIntegration
        treeId={'r' as TreeId}
        pageNodeId={'r:folder' as NodeId}
        pageTreeNode={buildNode({ nodeType: 'folder' as NodeType })}
      />
    );

    expect(toolbarMock).toHaveBeenCalled();
    const toolbarProps = toolbarMock.mock.calls.at(-1)![0] as TreeConsoleToolbarProps;
    expect(toolbarProps.allowImport).toBe(true);
  });

  it('sets allowImport=false when page node is not a folder', () => {
    render(
      <TreeConsoleIntegration
        treeId={'r' as TreeId}
        pageNodeId={'r:item' as NodeId}
        pageTreeNode={buildNode({
          nodeType: 'document' as NodeType,
          metadata: { name: 'Doc', description: '', tags: [] },
        })}
      />
    );

    expect(toolbarMock).toHaveBeenCalled();
    const toolbarProps = toolbarMock.mock.calls.at(-1)![0] as TreeConsoleToolbarProps;
    expect(toolbarProps.allowImport).toBe(false);
  });
});
