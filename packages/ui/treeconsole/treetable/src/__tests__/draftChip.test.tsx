import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => (
    <a {...props}>{children}</a>
  ),
}));
import type { ReactNode } from 'react';
import type { ColumnBuilderParams } from '../components/internal/createTreeTableColumns.js';
import { createTreeTableColumns } from '../components/internal/createTreeTableColumns.js';
import type { NodeId, NodeType, TreeNode, Timestamp } from '@hierarchidb/common-types';

describe('TreeTable Draft chip', () => {
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
    name: 'Example Node',
    depth: 1,
    createdAt: 0 as Timestamp,
    updatedAt: 0 as Timestamp,
    version: 1,
    ...overrides,
  });

  const renderNameCell = (node: TreeNode) => {
    const columns = createTreeTableColumns(defaultParams);
    const nameColumn = columns.find((column) => column.id === 'name');
    if (!nameColumn || typeof nameColumn.cell !== 'function') {
      throw new Error('name column renderer is not available');
    }
    const cellRenderer = nameColumn.cell as (ctx: { row: { original: TreeNode } }) => ReactNode;
    const cell = cellRenderer({
      row: { original: node },
    });
    render(<>{cell}</>);
  };

  it('renders Draft chip when node is marked as draft', () => {
    renderNameCell(buildNode({ isDraft: true }));
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('does not render Draft chip for regular nodes', () => {
    renderNameCell(buildNode({ isDraft: false }));
    expect(screen.queryByText('Draft')).toBeNull();
  });
});
