import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HierarchicalTreeNode } from '../../../types/index.js';
import type { TreeTableColumn } from '../core/TreeTableView';
import { TreeTableView } from '../core/TreeTableView';

vi.mock('@hierarchidb/ui-treeconsole-breadcrumb', () => ({
  getPluginIconColor: () => undefined,
  isFolderNodeType: (nodeType: string) => nodeType === 'folder',
}));

const columns: TreeTableColumn[] = [
  {
    id: 'name',
    label: 'Name',
    render: (_value, node) => node.name,
  },
];

describe('TreeTableView hasChildren handling', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows expand toggle when hasChildren is true without explicit children array', () => {
    const rows: HierarchicalTreeNode[] = [
      {
        id: 'node-1',
        parentId: 'root',
        nodeType: 'folder',
        name: 'Folder',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        hasChildren: true,
      },
    ];

    render(
      <TreeTableView
        data={rows}
        columns={columns}
        selectedIds={[]}
        expandedIds={[]}
        showCheckboxes={false}
        showIcons={false}
      />
    );

    expect(screen.getByTestId('ChevronRightIcon')).toBeInTheDocument();
  });
});
