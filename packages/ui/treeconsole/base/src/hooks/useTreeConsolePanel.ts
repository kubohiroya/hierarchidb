import { type NodeId, type NodeType, toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type {
  OpenStepOption,
  TreeConsoleBreadcrumbProps,
  TreeConsoleBreadcrumbRendererProps,
} from '@hierarchidb/ui-treeconsole-breadcrumb';
import type {
  BuildSessionIndicator,
  TreeNodeInUI,
  TreeTableController,
} from '@hierarchidb/ui-treeconsole-treetable';
import { DualKeyMap } from '@hierarchidb/util';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { HierarchicalTreeNode } from '~/types/index';

type DefaultBreadcrumbProps = TreeConsoleBreadcrumbProps;
type DefaultBreadcrumbNode = DefaultBreadcrumbProps['nodePath'] extends readonly (infer T)[]
  ? T
  : never;

export type PanelBreadcrumbNode = {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
};

export interface TreeConsolePanelLogicArgs {
  readonly data: readonly HierarchicalTreeNode[];
  readonly nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
  readonly breadcrumbItems: readonly PanelBreadcrumbNode[];
  readonly selectedIds: readonly string[];
  readonly expandedIds: readonly string[];
  readonly pageNodeId?: string;
  readonly subtreeRootId?: string;
  readonly treeId?: string;
  readonly pageTreeNode?: TreeNode;
  readonly infoPanel?: ReactElement;
  readonly useArchiveColumns?: boolean;
  readonly archiveAction?: 'restore' | 'empty';
  readonly onNodeClick?: (node: HierarchicalTreeNode) => void;
  readonly onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
  readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  readonly onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
  readonly onContextMenuAction: (
    action: string,
    node: HierarchicalTreeNode,
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb' | 'treetable' | 'speedDial';
      nextVisible?: boolean;
      openInNewTab?: boolean;
    }
  ) => void;
  readonly resolvePreviewGuardState?: (
    node: HierarchicalTreeNode
  ) => Promise<{ canOpen: boolean; finalStepIndex?: number }>;
  readonly resolveOpenSteps?: (nodeId: string, nodeType: string) => Promise<OpenStepOption[]>;
  readonly onBreadcrumbNavigate: (nodeId: string, node?: PanelBreadcrumbNode) => void;
  readonly onBreadcrumbContextAction?: (
    action: string,
    node: PanelBreadcrumbNode,
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb' | 'treetable' | 'speedDial';
      nextVisible?: boolean;
      openInNewTab?: boolean;
    }
  ) => void;
  readonly breadcrumbRenderer?: (props: TreeConsoleBreadcrumbRendererProps) => ReactElement;
  readonly buildSessionIndicator?: BuildSessionIndicator;
  readonly leftSlot?: ReactElement;
}

export interface TreeConsolePanelLogicResult {
  readonly controller: TreeTableController;
  readonly shouldSplitView: boolean;
  readonly footerTopLevel: number;
  readonly footerSelected: number;
  readonly breadcrumbProps: TreeConsoleBreadcrumbProps;
  readonly isPageContextValid: boolean;
}

export function useTreeConsolePanel({
  data,
  nodeIndex,
  breadcrumbItems,
  selectedIds,
  expandedIds,
  pageNodeId,
  subtreeRootId,
  treeId,
  pageTreeNode,
  infoPanel,
  useArchiveColumns,
  archiveAction,
  onNodeClick,
  onNodeSelect,
  onNodeExpand,
  onMoveNodes,
  onContextMenuAction,
  resolvePreviewGuardState,
  resolveOpenSteps,
  onBreadcrumbNavigate,
  onBreadcrumbContextAction,
  breadcrumbRenderer,
  buildSessionIndicator,
  leftSlot,
}: TreeConsolePanelLogicArgs): TreeConsolePanelLogicResult {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const pageNodeType = (pageTreeNode?.nodeType ?? '').toLowerCase();
  const shouldSplitView = isMdUp && pageNodeType === 'folder' && Boolean(infoPanel);
  const isPageContextValid = Boolean(treeId && pageNodeId);

  const rootNodeId = subtreeRootId
    ? String(subtreeRootId)
    : pageNodeId
      ? String(pageNodeId)
      : undefined;

  const controller = useMemo<TreeTableController>(() => {
    const baseDepth = (() => {
      if (rootNodeId && nodeIndex instanceof DualKeyMap) {
        const node = nodeIndex.get(rootNodeId as NodeId);
        if (node && typeof node.depth === 'number' && Number.isFinite(node.depth)) {
          return node.depth as number;
        }
      }
      const depths = data
        .map((node) => (typeof node.depth === 'number' ? (node.depth as number) : undefined))
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      if (depths.length > 0) {
        return Math.min(...depths);
      }
      return 1;
    })();

    const depthOffset = 1 - (Number.isFinite(baseDepth) ? baseDepth : 1);

    const toTreeNodeInUI = (node: HierarchicalTreeNode, fallbackDepth: number): TreeNodeInUI => {
      const resolvedDepth = Number.isFinite(node.depth) ? Number(node.depth) : fallbackDepth;
      const normalizedDepth = Math.max(1, Math.round(resolvedDepth + depthOffset));
      const originalNameValue =
        useArchiveColumns && typeof (node as { originalName?: string }).originalName === 'string'
          ? (node as { originalName?: string }).originalName
          : undefined;
      const displayName =
        typeof originalNameValue === 'string' && originalNameValue.trim().length > 0
          ? originalNameValue
          : node.metadata?.name || '';
      const base: TreeNodeInUI = {
        ...node,
        nodeType: toNodeType(node.nodeType || 'folder'),
        metadata: { ...node.metadata, name: displayName },
        hasChildren: Boolean(
          node.hasChildren ?? (Array.isArray(node.children) && node.children.length > 0)
        ),
        depth: normalizedDepth,
        absoluteDepth: resolvedDepth,
      };

      if (Array.isArray(node.children) && node.children.length > 0) {
        base.children = node.children;
      }

      return base;
    };

    const tableData = data.map((node) => toTreeNodeInUI(node, 1));

    const resolveEditableNode = (
      nodeId: string,
      field: 'name' | 'description',
      newValue: string
    ): HierarchicalTreeNode => {
      const target = data.find((node) => node.id === nodeId);
      if (target) {
        const nextMetadata = {
          ...target.metadata,
          name: field === 'name' ? newValue : target.metadata?.name,
          description: field === 'description' ? newValue : target.metadata?.description,
        };
        return {
          ...target,
          metadata: {
            name: nextMetadata.name ?? '',
            description: nextMetadata.description ?? '',
            tags: target.metadata?.tags ?? [],
          },
        };
      }

      return {
        id: toNodeId(nodeId),
        nodeType: toNodeType('folder'),
        parentId: toNodeId(''),
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 0,
        metadata: {
          name: field === 'name' ? newValue : '',
          description: field === 'description' ? newValue : '',
          tags: [],
        },
        draftMetadata: null,
        data: null,
        visible: true,
      };
    };

    const rowSelection: Record<string, boolean> = {};
    selectedIds.forEach((id) => {
      rowSelection[id] = true;
    });

    const expandedRowIds = new Set(expandedIds);

    return {
      data: tableData,
      nodeIndex,
      rowSelection,
      expandedRowIds,
      rootNodeId: rootNodeId as NodeId | undefined,
      depthOffset,
      startEdit: async (_nodeId: string) => {},
      finishEdit: (nodeId: string, newValue: string, field: 'name' | 'description' = 'name') => {
        const nodeData = resolveEditableNode(nodeId, field, newValue);
        onContextMenuAction(field === 'name' ? 'rename-inline' : 'update-desc-inline', nodeData);
      },
      cancelEdit: () => {},
      onNodeClick: (_nodeId: string, node?: TreeNodeInUI) => {
        if (node && onNodeClick) {
          const nodeData: HierarchicalTreeNode = {
            ...node,
          };
          onNodeClick(nodeData);
        }
      },
      onNodeSelect: onNodeSelect
        ? (nodeIds: string[], selected: boolean) => {
            onNodeSelect?.(nodeIds, selected);
          }
        : undefined,
      onNodeExpand,
      onMoveNodes: (nodeIds: string[], targetParentId: string) => {
        onMoveNodes?.(nodeIds, targetParentId);
      },
      resolvePreviewGuardState: resolvePreviewGuardState
        ? (node: TreeNodeInUI) => resolvePreviewGuardState(node as HierarchicalTreeNode)
        : undefined,
      resolveOpenSteps: resolveOpenSteps
        ? (node: TreeNodeInUI) =>
            resolveOpenSteps(String(node.id ?? ''), String(node.nodeType || 'folder'))
        : undefined,
      onContextAction: (
        action: string,
        node: TreeNodeInUI,
        options?: { navigateToParent?: boolean; nextVisible?: boolean }
      ) => {
        const nodeData: HierarchicalTreeNode = {
          ...(node as HierarchicalTreeNode),
          id: node.id,
          nodeType: (node.nodeType || 'folder') as NodeType,
        };
        onContextMenuAction(action, nodeData, options);
      },
    };
  }, [
    data,
    nodeIndex,
    expandedIds,
    onContextMenuAction,
    onMoveNodes,
    onNodeClick,
    onNodeSelect,
    onNodeExpand,
    resolveOpenSteps,
    resolvePreviewGuardState,
    rootNodeId,
    selectedIds,
    useArchiveColumns,
  ]);

  const footerTopLevel = Array.isArray(data) ? data.length : 0;
  const footerSelected = selectedIds.length;
  const archiveDisabledNodeIds = useMemo<ReadonlySet<string>>(() => {
    if (!buildSessionIndicator?.runningNodeIds) {
      return new Set<string>();
    }
    return new Set(Array.from(buildSessionIndicator.runningNodeIds, (id) => String(id)));
  }, [buildSessionIndicator?.runningNodeIds]);

  const defaultBreadcrumbProps = useMemo<DefaultBreadcrumbProps>(
    () => ({
      nodePath: breadcrumbItems as readonly DefaultBreadcrumbNode[],
      onNodeClick: onBreadcrumbNavigate,
      treeId,
      variant: 'default',
      pageNodeId,
      useArchiveColumns: useArchiveColumns ?? false,
      archiveAction,
      iconInteractive: !useArchiveColumns,
      onDropToNode: onMoveNodes
        ? (targetId: string, draggedId: string) => onMoveNodes?.([draggedId], targetId)
        : undefined,
      onContextAction: onBreadcrumbContextAction,
      resolveOpenSteps,
      archiveDisabledNodeIds,
      leftSlot,
    }),
    [
      breadcrumbItems,
      onBreadcrumbNavigate,
      onBreadcrumbContextAction,
      onMoveNodes,
      pageNodeId,
      resolveOpenSteps,
      archiveDisabledNodeIds,
      treeId,
      archiveAction,
      useArchiveColumns,
      leftSlot,
    ]
  );

  const breadcrumbProps = useMemo<TreeConsoleBreadcrumbProps>(
    () => ({
      ...defaultBreadcrumbProps,
      renderer: breadcrumbRenderer,
    }),
    [breadcrumbRenderer, defaultBreadcrumbProps]
  );

  return {
    controller,
    shouldSplitView,
    footerTopLevel,
    footerSelected,
    breadcrumbProps,
    isPageContextValid,
  };
}
