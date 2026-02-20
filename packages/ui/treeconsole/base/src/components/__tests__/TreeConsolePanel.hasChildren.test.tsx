import { describe, expect, it, afterEach, vi } from 'vitest';
import type { TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import type { TreeConsolePanelProps } from '../TreeConsolePanel';
// Lazy import after mocking
import { TreeConsolePanel } from '../TreeConsolePanel';

import { render, cleanup } from '@testing-library/react';
import React = require('react');
import type { HierarchicalTreeNode } from '../../types/index';
import type { TreeTableColumn } from '../TreeTable/index';
import { DualKeyMap } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@hierarchidb/ui-treeconsole-breadcrumb', () => ({
  TreeConsoleBreadcrumb: () => null,
  getPluginIconColor: () => undefined,
  isFolderNodeType: (nodeType: string) => nodeType === 'folder',
}));

const capturedControllers = vi.hoisted(() => [] as TreeTableController[]);

vi.mock('@hierarchidb/ui-treeconsole-treetable', () => {
  const MockTreeTableCore = ({ controller }: { controller: TreeTableController }) => {
    capturedControllers.push(controller);
    return React.createElement('div', { 'data-testid': 'console-table-core' });
  };
  return {
    TreeTableCore: MockTreeTableCore,
  };
});

const noop = () => {};
const stringNoop = (_value: string) => {};
const viewModeNoop = (_mode: 'list' | 'grid') => {};
const contextMenuNoop = (_action: string, _node: HierarchicalTreeNode) => {};
const moveNodesNoop = async (_nodeIds: string[], _targetParentId: string) => {};

const baseColumns: TreeTableColumn[] = [
  { id: 'name', label: 'Name', width: 120 },
];

function renderPanel(data: HierarchicalTreeNode[]): TreeTableController {
  capturedControllers.length = 0;
  const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
  data.forEach((node) => {
    const primary = node.id as NodeId;
    const secondary = (node.parentId ?? 'root') as NodeId;
    index.set(primary, node as TreeNode, secondary);
  });
  const props: TreeConsolePanelProps = {
    treeId: 'r',
    title: 'Test',
    pageNodeId: 'root',
    data,
    nodeIndex: index,
    columnsDeprecated: baseColumns,
    breadcrumbItems: [],
    loading: false,
    error: undefined,
    selectedIds: [],
    expandedIds: [],
    searchTerm: '',
    sortBy: 'name',
    sortDirection: 'asc',
    filterBy: '',
    availableFilters: [],
    viewMode: 'list',
    canCreate: true,
    canEdit: true,
    canArchive: true,
    onNodeClick: noop,
    onNodeSelect: noop,
    onNodeExpand: noop,
    onSearchChange: noop,
    onSearchClear: noop,
    onCreate: noop,
    onEdit: noop,
    onDelete: noop,
    onRefresh: noop,
    onExpandAll: noop,
    onCollapseAll: noop,
    onSort: stringNoop,
    onFilterChange: stringNoop,
    onViewModeChange: viewModeNoop,
    onBreadcrumbNavigate: stringNoop,
    onNavigateBack: noop,
    onNavigateForward: noop,
    canGoBack: false,
    canGoForward: false,
    onContextMenuAction: contextMenuNoop,
    onStartTour: noop,
    onMoveNodes: moveNodesNoop,
  };

  render(<TreeConsolePanel {...props} />);
  const controller = capturedControllers.at(-1);
  if (!controller) throw new Error('TreeTableCore was not invoked');
  return controller;
}

describe('TreeConsolePanel controller hasChildren propagation', () => {
  afterEach(() => {
    cleanup();
    capturedControllers.length = 0;
  });

  it('red: missing hasChildren results in false inside controller data', () => {
    const controller = renderPanel([
      {
        id: 'child-red',
        parentId: 'root',
        nodeType: 'folder',
        name: 'Child',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as HierarchicalTreeNode,
    ]);

    expect(controller.data?.[0]?.hasChildren).toBe(false);
  });

  it('green: when hasChildren is provided it is preserved as true', () => {
    const controller = renderPanel([
      {
        id: 'child-green',
        parentId: 'root',
        nodeType: 'folder',
        name: 'Child',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        hasChildren: true,
      } as HierarchicalTreeNode,
    ]);

    expect(controller.data?.[0]?.hasChildren).toBe(true);
  });
});
