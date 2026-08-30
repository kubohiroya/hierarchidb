import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { NodeContextMenuProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { DualKeyMap } from '@hierarchidb/util';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TreeTableContextMenu } from '../components/internal/TreeTableContextMenu';

const asNodeId = (value: string): NodeId => value as NodeId;
const asNodeType = (value: string): NodeType => value as NodeType;
const asTimestamp = (value: number): Timestamp => value as Timestamp;

const createNode = (
  id: string,
  patch: Partial<Pick<TreeNode, 'nodeType' | 'parentId' | 'metadata' | 'depth' | 'data'>> = {}
): TreeNode => {
  const now = asTimestamp(Date.now());
  return {
    id: asNodeId(id),
    parentId: patch.parentId ?? asNodeId('r:root'),
    nodeType: patch.nodeType ?? asNodeType('shape'),
    metadata: { name: id, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: undefined,
    depth: patch.depth ?? 1,
    visible: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...patch,
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

  it('enables folder build when a descendant build target is required', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const folder = createNode('folder-1', { nodeType: asNodeType('folder'), depth: 1 });
    const shape = createNode('shape-1', {
      parentId: folder.id,
      metadata: {
        name: 'shape-1',
        description: undefined,
        tags: [],
        buildMetadata: { buildRequired: true },
      },
    });
    const nodeIndex = new DualKeyMap<NodeId, NodeId, TreeNode>();
    nodeIndex.set(folder.id, folder, folder.parentId);
    nodeIndex.set(shape.id, shape, shape.parentId);

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node: folder,
        },
        onClose: () => {},
        treeId: 'r',
        controller: { nodeIndex },
        collectDescendantIds: () => [folder.id, shape.id].map(String),
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>(),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.buildRequired).toBe(true);
    expect(latestProps?.canBuild).toBe(true);
    expect(latestProps?.buildAvailabilitySummary).toBe('Build required');
  });

  it('disables folder build when a required descendant already has an active session', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const folder = createNode('folder-2', { nodeType: asNodeType('folder'), depth: 1 });
    const shape = createNode('shape-2', {
      parentId: folder.id,
      metadata: {
        name: 'shape-2',
        description: undefined,
        tags: [],
        buildMetadata: { buildRequired: true },
      },
    });
    const nodeIndex = new DualKeyMap<NodeId, NodeId, TreeNode>();
    nodeIndex.set(folder.id, folder, folder.parentId);
    nodeIndex.set(shape.id, shape, shape.parentId);

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node: folder,
        },
        onClose: () => {},
        treeId: 'r',
        controller: { nodeIndex },
        collectDescendantIds: () => [folder.id, shape.id].map(String),
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>([shape.id]),
          activeNodeIds: new Set<NodeId>([shape.id]),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.buildRequired).toBe(true);
    expect(latestProps?.canBuild).toBe(false);
    expect(latestProps?.buildAvailabilitySummary).toBe('Build already running');
  });

  it('passes resolver reason for a buildable node with no required rebuild', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const node = createNode('shape-3', {
      metadata: {
        name: 'shape-3',
        description: undefined,
        tags: [],
        buildMetadata: { buildRequired: false },
      },
    });

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

    expect(latestProps?.buildRequired).toBe(false);
    expect(latestProps?.canBuild).toBe(false);
    expect(latestProps?.buildAvailabilitySummary).toBe('Up to date');
  });

  it('passes diagnostics entrypoint props for a folder with no build candidates', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const folder = createNode('folder-3', { nodeType: asNodeType('folder'), depth: 1 });

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node: folder,
        },
        onClose: () => {},
        treeId: 'r',
        controller: { nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>() },
        collectDescendantIds: () => [folder.id].map(String),
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>(),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.buildRequired).toBe(false);
    expect(latestProps?.canBuild).toBe(false);
    expect(latestProps?.buildAvailabilitySummary).toBe('No build target');
    expect(latestProps?.buildDiagnosticsLabel).toBe('Build diagnostics');
  });

  it('passes dependency diagnostics from the controller through build availability props', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const shape = createNode('shape-dependency-error', {
      nodeType: asNodeType('shape'),
      depth: 1,
    });

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node: shape,
        },
        onClose: () => {},
        treeId: 'r',
        controller: {
          nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>(),
          dependencySummary: {
            edgeCounts: { active: 1 },
            schemaErrors: [
              {
                code: 'DEPENDENCY_SCHEMA_INVALID',
                message: 'Dependency schema is invalid.',
                nodeId: shape.id,
              },
            ],
          },
        },
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>(),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.buildRequired).toBe(false);
    expect(latestProps?.canBuild).toBe(false);
    expect(latestProps?.buildAvailabilitySummary).toBe('Schema error');
    expect(latestProps?.buildAvailabilityTooltip).toContain('Dependency schema is invalid.');
    expect(latestProps?.buildDiagnosticsLabel).toBe('Build diagnostics');
  });

  it('passes plugin prerequisite failures from the controller through build availability props', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };

    const route = createNode('route-prerequisite-failure', {
      nodeType: asNodeType('route'),
      depth: 1,
      metadata: { buildMetadata: { buildRequired: true } },
    });

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node: route,
        },
        onClose: () => {},
        treeId: 'r',
        controller: {
          nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>(),
          pluginPrerequisiteFailures: [
            {
              code: 'PLUGIN_AUTH_REQUIRED',
              message: 'Route plugin authentication is required.',
              pluginId: 'route',
            },
          ],
        },
        buildSessionIndicator: {
          runningNodeIds: new Set<NodeId>(),
          activeNodeIds: new Set<NodeId>(),
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.buildRequired).toBe(false);
    expect(latestProps?.canBuild).toBe(false);
    expect(latestProps?.buildAvailabilitySummary).toBe('Plugin prerequisite failed');
    expect(latestProps?.buildAvailabilityTooltip).toContain(
      'Route plugin authentication is required.'
    );
    expect(latestProps?.buildDiagnosticsLabel).toBe('Build diagnostics');
  });

  it('passes resolved command actions and dispatches them through context action', () => {
    let latestProps: NodeContextMenuProps | null = null;
    const ContextMenuComponent = (props: NodeContextMenuProps) => {
      latestProps = props;
      return React.createElement('div', { 'data-testid': 'context-menu-stub' });
    };
    const node = createNode('command-target', {
      nodeType: asNodeType('folder'),
      data: {
        commandTarget: true,
      },
    });
    const onContextAction = vi.fn();

    render(
      React.createElement(TreeTableContextMenu, {
        contextMenuState: {
          anchorEl: document.createElement('button'),
          anchorPosition: null,
          node,
        },
        onClose: () => {},
        treeId: 'r',
        controller: {
          nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>(),
          onContextAction,
          resolveContextMenuCommandActions: () => [{ id: 'custom:run', label: 'Run command' }],
        },
        ContextMenuComponent,
      })
    );

    expect(latestProps?.commandActions).toEqual([{ id: 'custom:run', label: 'Run command' }]);
    latestProps?.onCommandAction?.('custom:run');
    expect(onContextAction).toHaveBeenCalledWith('custom:run', node, { source: 'treetable' });
  });
});
