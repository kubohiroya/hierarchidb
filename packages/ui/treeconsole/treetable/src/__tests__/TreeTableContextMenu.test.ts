import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { NodeContextMenuProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { TreeTableContextMenu } from '../components/internal/TreeTableContextMenu.js';

const asNodeId = (value: string): NodeId => value as NodeId;
const asNodeType = (value: string): NodeType => value as NodeType;
const asTimestamp = (value: number): Timestamp => value as Timestamp;

const createNode = (id: string): TreeNode => {
  const now = asTimestamp(Date.now());
  return {
    id: asNodeId(id),
    parentId: asNodeId('r:root'),
    nodeType: asNodeType('shape'),
    metadata: { name: id, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: undefined,
    depth: 1,
    visible: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  } satisfies TreeNode;
};

describe('TreeTableContextMenu archive disable for running build session', () => {
  it('passes canArchive=false when node is running', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const node = createNode('shape-1');

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node,
        },
        onClose: () => {},
        treeId: 'r',
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>([node.id as NodeId]),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.canArchive).toBe(false);
    expect(latestProps?.canRemove).toBe(false);
  });

  it('passes canArchive=true when node is not running', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const node = createNode('shape-2');

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node,
        },
        onClose: () => {},
        treeId: 'r',
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>(),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.canArchive).toBe(true);
    expect(latestProps?.canRemove).toBe(true);
  });
});
