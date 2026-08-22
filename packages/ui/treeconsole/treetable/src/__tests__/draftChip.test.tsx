import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import type { ReactNode } from 'react';
import type { ColumnBuilderParams } from '../components/internal/createTreeTableColumns';
import { createTreeTableColumns } from '../components/internal/createTreeTableColumns';

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
    treeId: 'console',
    setContextMenuState: () => {},
    visualSelectionSet: new Set(),
    useArchiveColumns: false,
    archiveAction: 'restore',
    formatTimestamp: () => '-',
    columnLabels: {
      name: 'Name',
      description: 'Description',
      created: 'Created',
      updated: 'Updated',
      removed: 'Removed',
    },
    draftChipLabels: {
      self: 'Draft',
      descendant: {
        singular: 'Draft in Subtree',
        plural: 'Drafts in Subtree',
      },
    },
    draftFlags: {
      hasDraft: new Set(),
      hasDescendantDraft: () => false,
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

  const renderNameCell = (node: TreeNode, overrides: Partial<ColumnBuilderParams> = {}) => {
    const columns = createTreeTableColumns({
      ...defaultParams,
      ...overrides,
      draftFlags: overrides.draftFlags ?? defaultParams.draftFlags,
      draftChipLabels: overrides.draftChipLabels ?? defaultParams.draftChipLabels,
    });
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

  const buildIconWithBuildRequiredFlag = () => {
    const BuildRequiredIcon = ({ buildRequired }: { buildRequired?: boolean }) => (
      <span>{buildRequired ? 'required' : 'not-required'}</span>
    );
    return BuildRequiredIcon;
  };

  const createNodeIndex = (nodes: TreeNode[]): { get: (id: NodeId) => TreeNode | undefined } => {
    const nodeIndex = new DualKeyMap<NodeId, NodeId, TreeNode>();
    nodes.forEach((node) => {
      nodeIndex.set(node.id, node, node.parentId);
    });
    return {
      get: (id: NodeId) => nodeIndex.get(id),
    } as { get: (id: NodeId) => TreeNode | undefined };
  };

  it('does not render Draft chip when node has draftData without explicit draft flag', () => {
    renderNameCell(buildNode({ draftData: { foo: 'bar' } }));
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('does not render Draft chip when draft flag set for node', () => {
    renderNameCell(buildNode(), {
      draftFlags: {
        hasDraft: new Set<NodeId>(['node-1' as NodeId]),
        hasDescendantDraft: () => false,
      },
    });
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('does not render Draft chip for nodes without draft data or flags', () => {
    renderNameCell(buildNode());
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('does not render singular descendant Draft chip when one descendant has draft', () => {
    renderNameCell(buildNode(), {
      collectDescendantIds: () => ['node-1', 'child-1'],
      draftFlags: {
        hasDraft: new Set<NodeId>(['child-1' as NodeId]),
        hasDescendantDraft: () => true,
      },
    });
    expect(screen.queryByText('Draft in Subtree')).toBeNull();
  });

  it('does not render plural descendant Draft chip when multiple descendants have draft', () => {
    renderNameCell(buildNode(), {
      collectDescendantIds: () => ['node-1', 'child-1', 'child-2'],
      draftFlags: {
        hasDraft: new Set<NodeId>(['child-1' as NodeId, 'child-2' as NodeId]),
        hasDescendantDraft: () => true,
      },
    });
    expect(screen.queryByText('Drafts in Subtree')).toBeNull();
  });

  it('passes buildRequired=true when a folder node has descendant buildRequired', () => {
    const folderNode = buildNode({
      id: 'folder-1' as NodeId,
      depth: 1,
    });
    const descendantNode = buildNode({
      id: 'child-1' as NodeId,
      parentId: 'folder-1' as NodeId,
      depth: 2,
      metadata: {
        buildMetadata: {
          buildRequired: true,
        },
      } as TreeNode['metadata'],
    });

    renderNameCell(folderNode, {
      IconComponent: buildIconWithBuildRequiredFlag(),
      collectDescendantIds: () => ['folder-1', 'child-1'],
      controller: {
        nodeIndex: createNodeIndex([folderNode, descendantNode]),
      } as ColumnBuilderParams['controller'],
    });

    expect(screen.getByText('required')).toBeDefined();
  });

  it('does not pass buildRequired=true when no descendant has buildRequired', () => {
    const folderNode = buildNode({
      id: 'folder-2' as NodeId,
      depth: 1,
    });
    const descendantNode = buildNode({
      id: 'child-2' as NodeId,
      parentId: 'folder-2' as NodeId,
      depth: 2,
    });

    renderNameCell(folderNode, {
      IconComponent: buildIconWithBuildRequiredFlag(),
      collectDescendantIds: () => ['folder-2', 'child-2'],
      controller: {
        nodeIndex: createNodeIndex([folderNode, descendantNode]),
      } as ColumnBuilderParams['controller'],
    });

    expect(screen.getByText('not-required')).toBeDefined();
  });
});
