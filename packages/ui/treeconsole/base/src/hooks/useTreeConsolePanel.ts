import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { BuildSessionIndicator, TreeNodeInUI, TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import type { OpenStepOption } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { TreeConsolePanelBreadcrumbProps, TreeConsolePanelBreadcrumbRendererProps } from '../components/TreeConsolePanelBreadcrumb.js';
import { DualKeyMap } from '@hierarchidb/util';
import type { HierarchicalTreeNode } from '../types/index.js';

type DefaultBreadcrumbProps = TreeConsolePanelBreadcrumbProps['defaultRendererProps'];
type DefaultBreadcrumbNode = DefaultBreadcrumbProps['nodePath'] extends readonly (infer T)[] ? T : never;

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
  readonly useTrashColumns?: boolean;
  readonly trashAction?: 'restore' | 'empty';
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
  readonly breadcrumbRenderer?: (props: TreeConsolePanelBreadcrumbRendererProps) => ReactElement;
  readonly buildSessionIndicator?: BuildSessionIndicator;
  readonly leftSlot?: ReactElement;
}


export interface TreeConsolePanelLogicResult {
  readonly controller: TreeTableController;
  readonly shouldSplitView: boolean;
  readonly footerTopLevel: number;
  readonly footerSelected: number;
  readonly breadcrumbProps: TreeConsolePanelBreadcrumbProps;
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
  useTrashColumns,
  trashAction,
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
        useTrashColumns && typeof (node as { originalName?: string }).originalName === 'string'
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
        hasChildren: Boolean(node.hasChildren ?? (Array.isArray(node.children) && node.children.length > 0)),
        depth: normalizedDepth,
        absoluteDepth: resolvedDepth,
      };

      if (Array.isArray(node.children) && node.children.length > 0) {
        base.children = node.children;
      }

      return base;
    };

    const tableData = data.map((node) => toTreeNodeInUI(node, 1));

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
        const nodeData: HierarchicalTreeNode = (field === 'name'
          ? ({ id: nodeId, name: newValue })
          : ({ id: nodeId, description: newValue })) as unknown as HierarchicalTreeNode;
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
        ? (node: TreeNodeInUI) => resolveOpenSteps(String(node.id ?? ''), String(node.nodeType || 'folder'))
        : undefined,
      onContextAction: (
        action: string,
        node: TreeNodeInUI,
        options?: { navigateToParent?: boolean; nextVisible?: boolean }
      ) => {
        const nodeData: HierarchicalTreeNode = {
          ...(node as unknown as HierarchicalTreeNode),
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
    useTrashColumns,
  ]);

  const footerTopLevel = Array.isArray(data) ? data.length : 0;
  const footerSelected = selectedIds.length;

  const defaultBreadcrumbProps = useMemo<DefaultBreadcrumbProps>(
    () => ({
      nodePath: breadcrumbItems as unknown as readonly DefaultBreadcrumbNode[],
      onNodeClick: onBreadcrumbNavigate,
      treeId,
      variant: 'default',
      pageNodeId,
      useTrashColumns: useTrashColumns ?? false,
      trashAction,
      iconInteractive: !useTrashColumns,
      onDropToNode: onMoveNodes
        ? (targetId: string, draggedId: string) => onMoveNodes?.([draggedId], targetId)
        : undefined,
      onContextAction: onBreadcrumbContextAction,
      resolveOpenSteps,
      leftSlot,
    }),
    [
      breadcrumbItems,
      onBreadcrumbNavigate,
      onBreadcrumbContextAction,
      onMoveNodes,
      pageNodeId,
      resolveOpenSteps,
      treeId,
      trashAction,
      useTrashColumns,
      leftSlot,
    ]
  );

  const breadcrumbProps = useMemo<TreeConsolePanelBreadcrumbProps>(
    () => ({
      items: breadcrumbItems,
      defaultRendererProps: defaultBreadcrumbProps,
      renderer: breadcrumbRenderer,
    }),
    [breadcrumbItems, breadcrumbRenderer, defaultBreadcrumbProps]
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
