import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ColumnBuilderParams } from '../components/internal/createTreeTableColumns.js';
import { createTreeTableColumns } from '../components/internal/createTreeTableColumns.js';
import type { NodeId, NodeType, TreeNode, Timestamp } from '@hierarchidb/common-types';

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

const baseNode: TreeNode = {
  id: 'node-1' as NodeId,
  parentId: null,
  nodeType: 'folder' as NodeType,
  metadata: {
    name: 'Initial name',
    description: 'Initial description',
    tags: [],
  },
  draftMetadata: {
    name: 'Initial name',
    description: 'Initial description',
    tags: [],
  },
  data: null,
  draftData: null,
  depth: 1,
  createdAt: 0 as Timestamp,
  updatedAt: 0 as Timestamp,
  version: 1,
};

function makeParams(overrides: Partial<ColumnBuilderParams>): ColumnBuilderParams {
  const controller = overrides.controller ?? {};
  return {
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
    editingNodeId: 'node-1',
    hideDragHandler: true,
    disableDragAndDrop: true,
    IconComponent: () => null,
    rowClickAction: 'Edit',
    selectionMode: 'none',
    controller,
    validateInline: () => ({ ok: true }),
    handleStartEdit: () => {},
    editingField: 'name',
    editingValue: baseNode.metadata.name ?? '',
    editingError: null,
    setEditingError: () => {},
    setEditingNodeId: () => {},
    setEditingField: () => {},
    treeId: 'console',
    setContextMenuState: () => {},
    visualSelectionSet: new Set(),
    useTrashColumns: false,
    trashAction: 'restore',
    formatTimestamp: () => '-',
    columnLabels: {
      name: 'Name',
      description: 'Description',
      created: 'Created',
      updated: 'Updated',
      removed: 'Removed',
    },
    validationMessages: {
      invalidName: 'Invalid name',
      invalidDescription: 'Invalid description',
    },
    placeholders: {
      nameEdit: 'Press Enter to confirm / Esc to cancel',
      descriptionEdit: 'Press Ctrl+Enter to confirm / Esc to cancel',
    },
    emptyValue: '-',
    ...overrides,
  };
}

function renderCell(params: ColumnBuilderParams, node: TreeNode, columnId: 'name' | 'description' = 'name') {
  const columns = createTreeTableColumns(params);
  const targetColumn = columns.find((col) => col.id === columnId);
  if (!targetColumn || typeof targetColumn.cell !== 'function') {
    throw new Error(`${columnId} column renderer unavailable`);
  }

  const cell = targetColumn.cell({
    row: { original: node },
  } as any);

  render(React.createElement(React.Fragment, null, cell as any));
}

describe('TreeTable inline edit commits', () => {
  beforeEach(() => {
    mockGetPluginIconColor.mockReset();
    mockGetPluginIconColor.mockReturnValue(undefined);
    mockIsFolderNodeType.mockReset();
    mockIsFolderNodeType.mockImplementation((nodeType: string) => nodeType === 'folder');
  });
  it('does not call finishEdit during typing and commits on blur', () => {
    const finishEdit = vi.fn();
    const params = makeParams({
      controller: {
        finishEdit,
        cancelEdit: vi.fn(),
        startEdit: vi.fn(),
      },
      editingField: 'name',
      editingValue: baseNode.metadata.name ?? '',
    });

    renderCell(params, baseNode);

    const input = document.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Updated name' } });
    expect(finishEdit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(finishEdit).toHaveBeenCalledTimes(1);
    expect(finishEdit).toHaveBeenCalledWith('node-1', 'Updated name', 'name');
  });

  it('commits description edits on blur/confirm and ignores typing', () => {
    const finishEdit = vi.fn();
    const params = makeParams({
      controller: {
        finishEdit,
        cancelEdit: vi.fn(),
        startEdit: vi.fn(),
      },
      editingField: 'description',
      editingValue: baseNode.metadata.description ?? '',
    });

    renderCell(params, baseNode, 'description');

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea, { target: { value: 'Updated description' } });
    expect(finishEdit).not.toHaveBeenCalled();

    fireEvent.blur(textarea);
    expect(finishEdit).toHaveBeenCalledTimes(1);
    expect(finishEdit).toHaveBeenCalledWith('node-1', 'Updated description', 'description');
  });

  it('cancels edit on Escape without committing', () => {
    const finishEdit = vi.fn();
    const cancelEdit = vi.fn();
    const params = makeParams({
      controller: {
        finishEdit,
        cancelEdit,
        startEdit: vi.fn(),
      },
      editingField: 'name',
    });

    renderCell(params, baseNode);

    const input = document.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(finishEdit).not.toHaveBeenCalled();
    expect(cancelEdit).toHaveBeenCalledTimes(1);
  });
});
