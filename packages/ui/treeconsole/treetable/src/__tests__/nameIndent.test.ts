import React, { type ReactNode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ColumnBuilderParams } from '../components/internal/createTreeTableColumns.js';
import { createTreeTableColumns } from '../components/internal/createTreeTableColumns.js';
import type { NodeId, TreeNode, NodeType, Timestamp } from '@hierarchidb/common-types';

const mockGetPluginIconColor = vi.hoisted(() => vi.fn(() => undefined));
const mockIsFolderNodeType = vi.hoisted(() => vi.fn((nodeType: string) => nodeType === 'folder'));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => React.createElement('a', props, children),
}));

vi.mock('@hierarchidb/ui-treeconsole-breadcrumb', () => ({
  buildTreeConsoleLinkHref: () => '#',
  getPluginIconColor: mockGetPluginIconColor,
  isFolderNodeType: mockIsFolderNodeType,
}));

vi.mock('../components/TreeTableStyles.js', async () => {
  const actual = await vi.importActual<any>('../components/TreeTableStyles.js');
  return {
    ...actual,
    NameCell: ({ children }: { children: ReactNode }) => React.createElement('div', null, children),
    IndentSpace: ({ depth }: { depth: number }) => React.createElement('span', { 'data-testid': 'indent-space', 'data-depth': depth }),
  };
});

describe('TreeTable Name column indentation', () => {
  beforeEach(() => {
    mockGetPluginIconColor.mockReset();
    mockGetPluginIconColor.mockReturnValue(undefined);
    mockIsFolderNodeType.mockReset();
    mockIsFolderNodeType.mockImplementation((nodeType: string) => nodeType === 'folder');
  });
  const defaultParams: ColumnBuilderParams = {
    columnWidths: {
      selection: 48,
      name: 240,
      description: 240,
      type: 120,
      createdAt: 120,
      updatedAt: 120,
      owner: 120,
      assignee: 120,
    },
    selectAll: false,
    allRowsSelected: false,
    someSelected: false,
    handleSelectAll: () => {},
    pageNodeId: undefined,
    selectAllHydrated: true,
    selectAllLabels: {
      select: 'Select all',
      clear: 'Clear all',
    },
    hasSelectedAncestor: () => false,
    rowSelection: {},
    collectDescendantIds: () => [],
    batchSelect: () => {},
    depthOffset: 0,
    nodesWithChildren: new Set(),
    expandedRowIds: new Set(),
    editingNodeId: null,
    hideDragHandler: true,
    disableDragAndDrop: true,
    IconComponent: () => null,
    rowClickAction: 'Select/Navigate',
    selectionMode: 'none',
    controller: {},
    validateInline: () => ({ ok: true }),
    handleStartEdit: () => {},
    editingField: null,
    editingValue: '',
    editingError: null,
    setEditingError: () => {},
    setEditingNodeId: () => {},
    setEditingField: () => {},
    treeId: 'tree',
    setContextMenuState: () => {},
    visualSelectionSet: new Set(),
    useTrashColumns: false,
    trashAction: 'restore',
  };

  const buildNode = (overrides: Partial<TreeNode> = {}): TreeNode => ({
    id: 'node-1' as NodeId,
    parentId: 'parent' as NodeId,
    nodeType: 'folder' as NodeType,
    name: 'Level node',
    depth: 1,
    createdAt: 0 as Timestamp,
    updatedAt: 0 as Timestamp,
    version: 1,
    ...overrides,
  });

  const renderNameCell = (params: ColumnBuilderParams, node: TreeNode) => {
    const columns = createTreeTableColumns(params);
    const nameColumn = columns.find((column) => column.id === 'name');
    if (!nameColumn || typeof nameColumn.cell !== 'function') {
      throw new Error('name column renderer is not available');
    }
    const cellRenderer = nameColumn.cell as (ctx: { row: { original: TreeNode } }) => ReactNode;
    const cell = cellRenderer({
      row: { original: node },
    });
    render(React.createElement(React.Fragment, null, cell as ReactNode));
    const indent = screen.getByTestId('indent-space');
    return Number(indent.getAttribute('data-depth'));
  };

  afterEach(() => {
    cleanup();
  });

  it('aligns depth 0 without indentation', () => {
    const depth = renderNameCell(defaultParams, buildNode({ depth: 1 }));
    expect(depth).toBe(0);
  });

  it('applies 24px step indentation for positive depths', () => {
    const depth = renderNameCell(defaultParams, buildNode({ depth: 3 }));
    expect(depth).toBe(2);
  });

  it('respects depthOffset additions', () => {
    const depth = renderNameCell({ ...defaultParams, depthOffset: 1 }, buildNode({ depth: 3 }));
    expect(depth).toBe(3);
  });

  it('caps indentation at zero when trash columns reduce depth', () => {
    const params = { ...defaultParams, useTrashColumns: true };
    const depth = renderNameCell(params, buildNode({ depth: 1 }));
    expect(depth).toBe(0);
  });

  it('reduces indentation by one level for trash columns when possible', () => {
    const params = { ...defaultParams, useTrashColumns: true };
    const depth = renderNameCell(params, buildNode({ depth: 4 }));
    expect(depth).toBe(2);
  });
});
