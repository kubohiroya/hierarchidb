import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { rainbowColors } from '@hierarchidb/ui-theme';
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
    NameCell: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    IndentSpace: ({ depth }: { depth: number }) => React.createElement('span', { 'data-testid': 'indent-space', 'data-depth': depth }),
  };
});

const IconProbe = ({ htmlColor }: { htmlColor?: string }) => (
  <span data-testid="node-icon" data-color={htmlColor ?? ''} />
);

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
  IconComponent: IconProbe as any,
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
  formatTimestamp: () => '-',
};

function renderNameCell(node: TreeNode) {
  const columns = createTreeTableColumns(defaultParams);
  const nameColumn = columns.find((column) => column.id === 'name');
  if (!nameColumn || typeof nameColumn.cell !== 'function') {
    throw new Error('name column renderer is not available');
  }
  const cellRenderer = nameColumn.cell as (ctx: { row: { original: TreeNode } }) => React.ReactNode;
  const cell = cellRenderer({
    row: { original: node },
  });
  render(<>{cell as React.ReactNode}</>);
}

describe('TreeTable icon colors', () => {
  beforeEach(() => {
    mockGetPluginIconColor.mockReset();
    mockIsFolderNodeType.mockReset();
    mockGetPluginIconColor.mockReturnValue(undefined);
    mockIsFolderNodeType.mockImplementation((nodeType: string) => nodeType === 'folder');
  });

  afterEach(() => {
    cleanup();
  });

  it('uses plugin manifest color for non-folder node types when available', () => {
    mockGetPluginIconColor.mockReturnValue('#123456');
    mockIsFolderNodeType.mockReturnValue(false);

    const node: TreeNode = {
      id: 'node-plugin' as NodeId,
      parentId: 'root' as NodeId,
      nodeType: 'location' as NodeType,
      name: 'Plugin node',
      depth: 3,
      createdAt: 0 as Timestamp,
      updatedAt: 0 as Timestamp,
      version: 1,
    };

    renderNameCell(node);

    const icon = screen.getByTestId('node-icon');
    expect(icon).toHaveAttribute('data-color', '#123456');
    expect(mockGetPluginIconColor).toHaveBeenCalledWith('location');
    expect(mockIsFolderNodeType).toHaveBeenCalledWith('location');
  });

  it('falls back to rainbow color derived from absolute depth for folder nodes', () => {
    mockIsFolderNodeType.mockReturnValue(true);

    const depth = 5;
    const expectedColor = rainbowColors[depth % rainbowColors.length];

    const node: TreeNode = {
      id: 'node-folder' as NodeId,
      parentId: 'root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'Folder node',
      depth,
      createdAt: 0 as Timestamp,
      updatedAt: 0 as Timestamp,
      version: 1,
    };

    renderNameCell(node);

    const icon = screen.getByTestId('node-icon');
    expect(icon).toHaveAttribute('data-color', expectedColor);
  });
});
