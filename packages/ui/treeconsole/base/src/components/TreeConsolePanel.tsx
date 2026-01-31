import { memo, useMemo } from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TreeTableColumn } from './TreeTable/index.js';
// RowContextMenu removed: right-click is disabled app-wide
import { toNodeType, type NodeId, type NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { type TreeNodeInUI, type TreeTableController, TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleFooter } from './TreeConsoleFooter.js';
import type { HierarchicalTreeNode } from '../types/index.js';
import { DualKeyMap } from '@hierarchidb/util';

type PanelBreadcrumbNode = {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
};

type DefaultBreadcrumbProps = ComponentProps<typeof TreeConsoleBreadcrumb>;
type DefaultBreadcrumbNode = DefaultBreadcrumbProps['nodePath'] extends readonly (infer T)[] ? T : never;

export interface TreeConsolePanelBreadcrumbRendererProps {
  readonly items: readonly PanelBreadcrumbNode[];
  readonly defaultRendererProps: DefaultBreadcrumbProps;
  readonly defaultRenderer: () => ReactElement;
}

export interface TreeConsolePanelProps {
  readonly title?: string;
  /** Optional treeId for context-aware menus (e.g., 'r'|'t'|'p') */
  readonly treeId?: string;
  /**
   * Page context root (formerly called rootNodeId in this component).
   * Keep naming aligned with app layer that uses `pageNodeId`.
   */
  readonly pageNodeId?: string;
  /** Optional page node for split view decisions. */
  readonly pageTreeNode?: TreeNode;
  /**
   * Optional subtree root used for hierarchical rendering (e.g. trash dialog branch view).
   * Defaults to `pageNodeId` when omitted.
   */
  readonly subtreeRootId?: string;
  readonly data: readonly HierarchicalTreeNode[];
  readonly nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
  /**
   * @deprecated TreeTableCore builds its own column set; external overrides are ignored.
   * @see TreeTableCore / createTreeTableColumns
   */
  readonly columnsDeprecated?: readonly TreeTableColumn[];
  readonly breadcrumbItems: readonly PanelBreadcrumbNode[];
  readonly loading?: boolean;
  readonly error?: string;
  readonly selectedIds: readonly string[];
  readonly expandedIds: readonly string[];
  readonly searchTerm: string;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly filterBy?: string;
  readonly availableFilters: readonly string[];
  readonly viewMode: 'list' | 'grid';
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canTrash: boolean;
  readonly showNavigationButtons?: boolean;
  readonly maxHeight?: number | string;
  readonly dense?: boolean;
  readonly onNodeClick?: (node: HierarchicalTreeNode) => void;
  readonly onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
  readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  readonly onSearchChange: (term: string) => void;
  readonly onSearchClear: () => void;
  readonly onCreate: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onRefresh: () => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly onSort: (columnId: string) => void;
  readonly onFilterChange: (filter: string) => void;
  readonly onViewModeChange: (mode: 'list' | 'grid') => void;
  readonly onBreadcrumbNavigate: (nodeId: string, node?: PanelBreadcrumbNode) => void;
  readonly onNavigateBack?: () => void;
  readonly onNavigateForward?: () => void;
  readonly canGoBack?: boolean;
  readonly canGoForward?: boolean;
  readonly onContextMenuAction: (
    action: string,
    node: HierarchicalTreeNode,
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb' | 'treetable' | 'speedDial';
      nextVisible?: boolean;
    }
  ) => void;
  readonly resolvePreviewGuardState?: (
    node: HierarchicalTreeNode
  ) => Promise<{ canOpen: boolean; finalStepIndex?: number }>;
  readonly onBreadcrumbContextAction?: (
    action: string,
    node: PanelBreadcrumbNode,
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb' | 'treetable' | 'speedDial';
      nextVisible?: boolean;
    }
  ) => void;
  readonly onStartTour?: () => void;
  readonly onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
  /** Optional: For column-width persistence, provide treeId to scope keys */
  readonly treeIdForPersistence?: string;
  /** Row click action behavior */
  readonly rowClickAction?: 'Edit' | 'Select/Navigate';
  /** Optional select-all persistence strategy passed to TreeTableCore */
  readonly selectAllPersistence?: 'page' | 'session';
  /** Optional prefix for selection checkbox ids (e.g., to avoid collisions across dialogs) */
  readonly selectAllIdPrefix?: string;
  /** Enable trash-specific columns and behaviours */
  readonly useTrashColumns?: boolean;
  readonly trashAction?: 'restore' | 'empty';
  /**
   * Whether to render the built-in static SpeedDial.
   * Set to false when an external DynamicSpeedDial is provided by the host app.
   */
  readonly renderBuiltInSpeedDial?: boolean;
  /** Hide the drag handle column when true (e.g., Trash dialog). */
  readonly hideDragHandler?: boolean;
  /** Optional custom breadcrumb renderer for host-specific presentation. */
  readonly breadcrumbRenderer?: (props: TreeConsolePanelBreadcrumbRendererProps) => ReactElement;
  /** Optional info panel to show alongside the table in split view. */
  readonly infoPanel?: ReactElement;
}

export const TreeConsolePanel = memo(function TreeConsolePanel(props: TreeConsolePanelProps) {
  // Right-click context menus are disabled by policy
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const pageNodeType = (props.pageTreeNode?.nodeType ?? '').toLowerCase();
  const shouldSplitView = isMdUp && pageNodeType === 'folder' && Boolean(props.infoPanel);

  // Create TreeTableController from props
  const controller: TreeTableController = useMemo((): TreeTableController => {
    const rootNodeId = props.subtreeRootId
      ? String(props.subtreeRootId)
      : props.pageNodeId
        ? String(props.pageNodeId)
        : undefined;

    const baseDepth = (() => {
      if (rootNodeId && props.nodeIndex instanceof DualKeyMap) {
        const node = props.nodeIndex.get(rootNodeId as NodeId);
        if (node && typeof node.depth === 'number' && Number.isFinite(node.depth)) {
          return node.depth as number;
        }
      }
      const depths = props.data
        .map((node) => (typeof node.depth === 'number' ? (node.depth as number) : undefined))
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      if (depths.length > 0) {
        return Math.min(...depths);
      }
      return 1;
    })();

    const depthOffset = 1 - (Number.isFinite(baseDepth) ? baseDepth : 1);

    const resolvePreviewGuardState = props.resolvePreviewGuardState;

    const toTreeNodeInUI = (node: HierarchicalTreeNode, fallbackDepth: number): TreeNodeInUI => {
      const resolvedDepth = Number.isFinite(node.depth) ? Number(node.depth) : fallbackDepth;
      const normalizedDepth = Math.max(1, Math.round(resolvedDepth + depthOffset));
      const originalNameValue =
        props.useTrashColumns && typeof (node as { originalName?: string }).originalName === 'string'
          ? (node as { originalName?: string }).originalName
          : undefined;
      const displayName =
        typeof originalNameValue === 'string' && originalNameValue.trim().length > 0
          ? originalNameValue
          : node.metadata?.name || '';
      const base: TreeNodeInUI = {
        ...node,
        nodeType: toNodeType(node.nodeType || 'folder'),
        type: (node.nodeType || 'folder') as string,
        metadata: { ...node.metadata, name: displayName},
        hasChildren: Boolean(node.hasChildren ?? (Array.isArray(node.children) && node.children.length > 0)),
        depth: normalizedDepth,
        absoluteDepth: resolvedDepth,
      };

      if (Array.isArray(node.children) && node.children.length > 0) {
        base.children = node.children;
      }

      return base;
    };

    // Convert data to TreeNodeInUI format
    const data = props.data.map((node) => toTreeNodeInUI(node, 1));

    // Convert selectedIds and expandedIds to the expected format
    const rowSelection: Record<string, boolean> = {};
    props.selectedIds.forEach((id) => {
      rowSelection[id] = true;
    });

    const expandedRowIds = new Set(props.expandedIds);

    return {
      data,
      nodeIndex: props.nodeIndex,
      rowSelection,
      expandedRowIds,
      rootNodeId: rootNodeId as NodeId | undefined,
      depthOffset,
      startEdit: async (_nodeId: string) => {},
      finishEdit: (nodeId: string, newValue: string, field: 'name' | 'description' = 'name') => {
        // delegate to parent handler via context-menu action channel
        const nodeData: HierarchicalTreeNode = (field === 'name'
          ? ({ id: nodeId, name: newValue })
          : ({ id: nodeId, description: newValue })) as unknown as HierarchicalTreeNode;
        props.onContextMenuAction(field === 'name' ? 'rename-inline' : 'update-desc-inline', nodeData);
      },
      cancelEdit: () => {},
      onNodeClick: (_nodeId: string, node?: TreeNodeInUI) => {
        if (node && props.onNodeClick) {
          // Cast TreeNodeInUI to TreeNodeData for callback
          // TreeNodeInUI is compatible with TreeNodeData

          const nodeData: HierarchicalTreeNode = {
            ...node,
          };

          props.onNodeClick(nodeData);
        }
      },
      onNodeSelect: props.onNodeSelect
        ? (nodeIds: string[], selected: boolean) => {
            props.onNodeSelect?.(nodeIds, selected);
          }
        : undefined,
      onNodeExpand: props.onNodeExpand,
      onMoveNodes: (nodeIds: string[], targetParentId: string) => {
        props.onMoveNodes?.(nodeIds, targetParentId);
      },
      resolvePreviewGuardState: resolvePreviewGuardState
        ? (node: TreeNodeInUI) => resolvePreviewGuardState(node as HierarchicalTreeNode)
        : undefined,
      onContextAction: (
        action: string,
        node: TreeNodeInUI,
        options?: { navigateToParent?: boolean; nextVisible?: boolean }
      ) => {
        if (props.onContextMenuAction) {
          const nodeData: HierarchicalTreeNode = {
            ...(node as unknown as HierarchicalTreeNode),
            id: node.id,
            nodeType: (node.nodeType || node.type || 'folder') as NodeType,
          };
          props.onContextMenuAction(action, nodeData, options);
        }
      },
    };
  }, [props]);

  // No right-click handlers

  // SpeedDial actions
  // Built-in static SpeedDial removed; host app may provide DynamicSpeedDial instead.

  //const totalItems = props.data.length;
  //const selectedItems = props.selectedIds.length;
  // const visibleItems = props.data.length; // In real implementation, this would be filtered count

  // Compute footer counters for loading atoms (controller not yet available)
  /*
  const countLoadedRecursive = (nodes: readonly TreeNodeData[]): number => {
    let c = 0;
    for (const n of nodes || []) {
      c += 1;
      const ch = n.children as readonly TreeNodeData[] | undefined;
      if (Array.isArray(ch) && ch.length) c += countLoadedRecursive(ch);
    }
    return c;
  };
   */

  const footerTopLevel = Array.isArray(props.data) ? props.data.length : 0;
  //const footerLoaded = countLoadedRecursive(props.data);
  const footerSelected = props.selectedIds.length;

  const renderTable = () => (
    <Box
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        paddingLeft: '8px',
        paddingRight: '8px',
        minWidth: 0,
      }}
      data-tour-id="tree-table"
    >
      <TreeTableCore
        controller={controller}
        viewHeight={600}
        viewWidth={1200}
        treeId={props.treeId}
        pageNodeId={props.pageNodeId}
        selectAllPersistence={props.selectAllPersistence}
        selectionIdPrefix={props.selectAllIdPrefix}
        useTrashColumns={props.useTrashColumns ?? false}
        trashAction={props.trashAction}
        depthOffset={controller.depthOffset ?? 0}
        disableDragAndDrop={false}
        hideDragHandler={props.hideDragHandler ?? false}
        rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
        selectionMode="multiple"
        // Right-click disabled
      />
    </Box>
  );

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Breadcrumb Navigation with drop-to-parent support */}
      {(() => {
        const defaultRendererProps: DefaultBreadcrumbProps = {
          nodePath: props.breadcrumbItems as unknown as readonly DefaultBreadcrumbNode[],
          onNodeClick: props.onBreadcrumbNavigate,
          treeId: props.treeId,
          variant: 'default',
          pageNodeId: props.pageNodeId,
          useTrashColumns: props.useTrashColumns ?? false,
          trashAction: props.trashAction,
          iconInteractive: !props.useTrashColumns,
          onDropToNode: props.onMoveNodes
            ? (targetId: string, draggedId: string) => props.onMoveNodes?.([draggedId], targetId)
            : undefined,
          onContextAction: props.onBreadcrumbContextAction,
        };
        const renderDefault = () => <TreeConsoleBreadcrumb {...defaultRendererProps} />;
        if (props.breadcrumbRenderer) {
          return props.breadcrumbRenderer({
            items: props.breadcrumbItems,
            defaultRendererProps,
            defaultRenderer: renderDefault,
          });
        }
        return renderDefault();
      })()}
      {/* Main Table Content */}
      {shouldSplitView ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { md: 'minmax(281px, 420px) 1fr' },
            gap: { md: 2 },
            p: { md: 2 },
          }}
        >
          <Box sx={{ minHeight: 0, alignSelf: 'start' }}>
            {props.infoPanel}
          </Box>
          {renderTable()}
        </Box>
      ) : (
        renderTable()
      )}

      {/* Footer */}
      {!props.useTrashColumns &&
        <TreeConsoleFooter
          controller={null} // TODO: Convert TreeTableController to TreeViewController
          onStartTour={props.onStartTour}
          height={32}
          loadingText={`${footerTopLevel} / ${footerSelected}`}
          loadingTooltip={(
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" display="block">From left to right:</Typography>
              <Typography variant="caption" display="block">- Number of top-level children in the subscribed
                subtree</Typography>
              <Typography variant="caption" display="block">- Number of loaded nodes (visible + expanded)</Typography>
              <Typography variant="caption" display="block">- Number of selected nodes</Typography>
            </Box>
          )}
        />
      }

    </Box>
  );
});
