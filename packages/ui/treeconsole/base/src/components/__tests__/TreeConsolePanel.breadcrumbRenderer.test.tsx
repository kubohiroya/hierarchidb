import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TreeConsoleBreadcrumbRendererProps,
  TreeConsolePanelProps,
} from '../TreeConsolePanel';
import { TreeConsolePanel } from '../TreeConsolePanel';

import React = require('react');

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import type { HierarchicalTreeNode } from '../../types/index';
import type { TreeTableColumn } from '../TreeTable/index';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const breadcrumbModule = vi.hoisted(() => ({
  TreeConsoleBreadcrumb: vi.fn(
    (props: { renderer?: (args: unknown) => React.ReactNode; nodePath?: unknown[] }) => {
      const { renderer, ...baseProps } = props;
      if (renderer) {
        return renderer({
          items: Array.isArray(baseProps.nodePath) ? baseProps.nodePath : [],
          defaultRendererProps: baseProps,
          defaultRenderer: () =>
            React.createElement('div', { 'data-testid': 'default-breadcrumb' }),
        });
      }
      return React.createElement('div', { 'data-testid': 'default-breadcrumb' });
    }
  ),
  getPluginIconColor: vi.fn(() => undefined),
  isFolderNodeType: vi.fn((nodeType: string) => nodeType === 'folder'),
  buildCreateMenuItems: vi.fn(() => []),
}));

vi.mock('@hierarchidb/ui-treeconsole-breadcrumb', () => breadcrumbModule);

vi.mock('@hierarchidb/ui-treeconsole-treetable', () => ({
  TreeTableCore: () => React.createElement('div', { 'data-testid': 'console-table-core' }),
}));

const noop = () => {};
const stringNoop = (_value: string) => {};
const viewModeNoop = (_mode: 'icon' | 'list' | 'column') => {};
const contextMenuNoop = (_action: string, _node: HierarchicalTreeNode) => {};

const baseColumns: TreeTableColumn[] = [{ id: 'name', label: 'Name', width: 120 }];

function buildProps(overrides: Partial<TreeConsolePanelProps> = {}): TreeConsolePanelProps {
  const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
  return {
    treeId: 'r',
    title: 'Test',
    pageNodeId: 'root',
    data: [],
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
    onMoveNodes: undefined,
    breadcrumbRenderer: undefined,
    renderBuiltInSpeedDial: false,
    hideDragHandler: false,
    ...overrides,
  } satisfies TreeConsolePanelProps;
}

describe('TreeConsolePanel breadcrumbRenderer', () => {
  afterEach(() => {
    cleanup();
    breadcrumbModule.TreeConsoleBreadcrumb.mockClear();
  });

  it('invokes the custom renderer with default props and allows fallback rendering', () => {
    const items = [{ id: 'archive', name: 'Archive' }];
    let capturedDefaultProps:
      | TreeConsoleBreadcrumbRendererProps['defaultRendererProps']
      | undefined;
    const renderer = vi.fn((params: TreeConsoleBreadcrumbRendererProps) => {
      capturedDefaultProps = params.defaultRendererProps;
      const fallback = params.defaultRenderer();
      expect(React.isValidElement(fallback)).toBe(true);
      return React.createElement('div', { 'data-testid': 'custom-breadcrumb' });
    });

    const props = buildProps({
      breadcrumbItems: items,
      breadcrumbRenderer: renderer as TreeConsolePanelProps['breadcrumbRenderer'],
    });

    render(<TreeConsolePanel {...props} />);

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(renderer.mock.calls[0]?.[0]?.items).toEqual(items);
    expect(screen.getByTestId('custom-breadcrumb')).toBeInTheDocument();
    expect(capturedDefaultProps?.nodePath).toEqual(items);
  });
});
