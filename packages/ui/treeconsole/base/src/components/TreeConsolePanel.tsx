import type { ReactElement } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Box, Slider, Typography } from '@mui/material';
import type { TreeTableColumn } from './TreeTable/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { type BuildSessionIndicator, TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { OpenStepOption, TreeConsoleBreadcrumbRendererProps as BreadcrumbRendererProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { NodeContextMenu, TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleFooter } from './TreeConsoleFooter.js';
import type { HierarchicalTreeNode } from '~/types/index';
import type { DualKeyMap } from '@hierarchidb/util';
import type { PanelBreadcrumbNode } from '~/hooks/useTreeConsolePanel';
import { useTreeConsolePanel } from '~/hooks/useTreeConsolePanel';
import { TagsLinkButton } from './TagsLinkButton.js';
import type { ViewMode, SortMode } from '~/types/view-mode-types';
import { IconView } from './IconView.js';
import { ColumnView } from './ColumnView.js';
import { useColumnView } from '~/hooks/useColumnView.js';
import { createSortComparator } from '~/utils/sort-comparator.js';

export type TreeConsoleBreadcrumbRendererProps = BreadcrumbRendererProps;

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
   * Optional subtree root used for hierarchical rendering (e.g. archive dialog branch view).
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
  readonly viewMode: ViewMode;
  readonly sortMode?: SortMode;
  readonly zoomLevel?: number;
  readonly onViewModeChange: (mode: ViewMode) => void;
  readonly onSortModeChange?: (mode: SortMode) => void;
  readonly onZoomLevelChange?: (zoom: number) => void;
  readonly onIconPositionChange?: (nodeId: NodeId, position: { x: number; y: number }) => void; readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canArchive: boolean;
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
      openInNewTab?: boolean;
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
      openInNewTab?: boolean;
    }
  ) => void;
  readonly resolveOpenSteps?: (nodeId: string, nodeType: string) => Promise<OpenStepOption[]>;
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
  /** Optional build session indicator state for row-level status */
  readonly buildSessionIndicator?: BuildSessionIndicator;
  /** Enable archive-specific columns and behaviours */
  readonly useArchiveColumns?: boolean;
  readonly archiveAction?: 'restore' | 'empty';
  /**
   * Whether to render the built-in static SpeedDial.
   * Set to false when an external DynamicSpeedDial is provided by the host app.
   */
  readonly renderBuiltInSpeedDial?: boolean;
  /** Hide the drag handle column when true (e.g., Archive dialog). */
  readonly hideDragHandler?: boolean;
  /** Optional custom breadcrumb renderer for host-specific presentation. */
  readonly breadcrumbRenderer?: (props: TreeConsoleBreadcrumbRendererProps) => ReactElement;
  /** Optional info panel to show alongside the table in split view. */
  readonly infoPanel?: ReactElement;
  /** Optional handler to open tags within the current tree hierarchy. */
  readonly onNavigateTags?: () => void;
}

export const TreeConsolePanel = memo(function TreeConsolePanel(props: TreeConsolePanelProps) {
  const tagsLeftSlot =
    props.treeId && props.pageNodeId && props.onNavigateTags
      ? (
        <TagsLinkButton
          treeId={props.treeId}
          pageNodeId={props.pageNodeId}
          onNavigate={props.onNavigateTags}
        />
      )
      : undefined;

  const {
    controller,
    shouldSplitView,
    footerTopLevel,
    footerSelected,
    breadcrumbProps,
    isPageContextValid,
  } = useTreeConsolePanel({
    data: props.data,
    nodeIndex: props.nodeIndex,
    breadcrumbItems: props.breadcrumbItems,
    selectedIds: props.selectedIds,
    expandedIds: props.expandedIds,
    pageNodeId: props.pageNodeId,
    subtreeRootId: props.subtreeRootId,
    treeId: props.treeId,
    pageTreeNode: props.pageTreeNode,
    infoPanel: props.infoPanel,
    useArchiveColumns: props.useArchiveColumns,
    archiveAction: props.archiveAction,
    onNodeClick: props.onNodeClick,
    onNodeSelect: props.onNodeSelect,
    onNodeExpand: props.onNodeExpand,
    onMoveNodes: props.onMoveNodes,
    onContextMenuAction: props.onContextMenuAction,
    resolvePreviewGuardState: props.resolvePreviewGuardState,
    resolveOpenSteps: props.resolveOpenSteps,
    onBreadcrumbNavigate: props.onBreadcrumbNavigate,
    onBreadcrumbContextAction: props.onBreadcrumbContextAction,
    breadcrumbRenderer: props.breadcrumbRenderer,
    buildSessionIndicator: props.buildSessionIndicator,
    leftSlot: tagsLeftSlot,
  });

  if (!isPageContextValid) {
    return <Box>Invalid page context</Box>;
  }

  const selectedIdSet = useMemo(() => {
    const set = new Set<string>();
    if (controller.rowSelection) {
      for (const [id, selected] of Object.entries(controller.rowSelection)) {
        if (selected) set.add(id);
      }
    }
    return set;
  }, [controller.rowSelection]);

  const [iconContextMenu, setIconContextMenu] = useState<{
    node: TreeNodeInUI;
    position: { left: number; top: number };
  } | null>(null);

  const handleIconContextMenu = useCallback((node: TreeNodeInUI, position: { left: number; top: number }) => {
    controller.onNodeSelect?.([node.id], true);
    setIconContextMenu({ node, position });
  }, [controller]);

  const handleIconContextMenuClose = useCallback(() => {
    setIconContextMenu(null);
  }, []);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: 0 }}>
        <TreeConsoleBreadcrumb {...breadcrumbProps} />
      </Box>
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
          <Box sx={{ minHeight: 0, alignSelf: 'start' }}>{props.infoPanel}</Box>
          <Box
            sx={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              paddingLeft: '8px',
              paddingRight: '8px',
              minWidth: 0,
              height: '100%',
            }}
            data-tour-id="tree-table"
          >
            {props.viewMode === 'icon' ? (
              <IconView
                nodes={controller.data ?? []}
                zoomLevel={props.zoomLevel ?? 50}
                sortMode={props.sortMode ?? 'none'}
                selectedIds={selectedIdSet}
                onIconPositionChange={props.onIconPositionChange ?? (() => { })}
                onNodeClick={controller.onNodeClick ? (nodeId) => controller.onNodeClick?.(nodeId) : undefined}
                onNodeDoubleClick={controller.onEdit ? (nodeId, node) => controller.onEdit?.(nodeId, node) : undefined}
                onNodeSelect={controller.onNodeSelect}
                onContextMenu={handleIconContextMenu}
              />
            ) : props.viewMode === 'column' ? (
              <ColumnViewWrapper
                controller={controller}
                onNodeClick={controller.onNodeClick}
              />
            ) : (
              <TreeTableCore
                controller={controller}
                viewWidth={1200}
                treeId={props.treeId}
                pageNodeId={props.pageNodeId}
                selectAllPersistence={props.selectAllPersistence}
                selectionIdPrefix={props.selectAllIdPrefix}
                buildSessionIndicator={props.buildSessionIndicator}
                useArchiveColumns={props.useArchiveColumns ?? false}
                archiveAction={props.archiveAction}
                depthOffset={controller.depthOffset ?? 0}
                disableDragAndDrop={false}
                hideDragHandler={props.hideDragHandler ?? false}
                rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
                selectionMode="multiple"
                sortMode={props.sortMode}
                onSortModeChange={props.onSortModeChange}
              />
            )}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            paddingLeft: '8px',
            paddingRight: '8px',
            minWidth: 0,
            height: '100%',
          }}
          data-tour-id="tree-table"
        >
          {props.viewMode === 'icon' ? (
            <IconView
              nodes={controller.data ?? []}
              zoomLevel={props.zoomLevel ?? 50}
              sortMode={props.sortMode ?? 'none'}
              selectedIds={selectedIdSet}
              onIconPositionChange={props.onIconPositionChange ?? (() => { })}
              onNodeClick={controller.onNodeClick ? (nodeId) => controller.onNodeClick?.(nodeId) : undefined}
              onNodeDoubleClick={controller.onEdit ? (nodeId, node) => controller.onEdit?.(nodeId, node) : undefined}
              onNodeSelect={controller.onNodeSelect}
              onContextMenu={handleIconContextMenu}
            />
          ) : props.viewMode === 'column' ? (
            <ColumnViewWrapper
              controller={controller}
              onNodeClick={controller.onNodeClick}
            />
          ) : (
            <TreeTableCore
              controller={controller}
              viewWidth={1200}
              treeId={props.treeId}
              pageNodeId={props.pageNodeId}
              selectAllPersistence={props.selectAllPersistence}
              selectionIdPrefix={props.selectAllIdPrefix}
              buildSessionIndicator={props.buildSessionIndicator}
              useArchiveColumns={props.useArchiveColumns ?? false}
              archiveAction={props.archiveAction}
              depthOffset={controller.depthOffset ?? 0}
              disableDragAndDrop={false}
              hideDragHandler={props.hideDragHandler ?? false}
              rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
              selectionMode="multiple"
              sortMode={props.sortMode}
              onSortModeChange={props.onSortModeChange}
            />
          )}
        </Box>
      )}

      {!props.useArchiveColumns && (
        <TreeConsoleFooter
          controller={null} // TODO: Convert TreeTableController to TreeViewController
          onStartTour={props.onStartTour}
          height={32}
          loadingText={`${footerTopLevel} / ${footerSelected}`}
          loadingTooltip={(
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" display="block">From left to right:</Typography>
              <Typography variant="caption" display="block">
                - Number of top-level children in the subscribed subtree
              </Typography>
              <Typography variant="caption" display="block">
                - Number of loaded nodes (visible + expanded)
              </Typography>
              <Typography variant="caption" display="block">- Number of selected nodes</Typography>
            </Box>
          )}
          rightSlot={
            props.viewMode === 'icon' && props.onZoomLevelChange ? (
              <Slider
                value={props.zoomLevel ?? 50}
                min={0}
                max={100}
                size="small"
                onChange={(_, value) => props.onZoomLevelChange?.(value as number)}
                aria-label="Zoom level"
                sx={{ width: 120, mr: '96px' }}
              />
            ) : undefined
          }
        />
      )}

      {/* IconView context menu */}
      {iconContextMenu && (
        <NodeContextMenu
          node={iconContextMenu.node as TreeNode}
          anchorPosition={iconContextMenu.position}
          open={true}
          onClose={handleIconContextMenuClose}
          onAction={(action) => {
            controller.onContextAction?.(action, iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          treeId={props.treeId}
        />
      )}
    </Box>
  );
});

// -- ColumnView wrapper that manages useColumnView hook --

import type { TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import { useCallback } from 'react';

interface ColumnViewWrapperProps {
  controller: TreeTableController;
  onNodeClick?: (nodeId: string, node?: TreeNodeInUI) => void;
}

function ColumnViewWrapper({ controller, onNodeClick }: ColumnViewWrapperProps) {
  const rootNodes = controller.data ?? [];

  // Pre-process data into O(1) lookup structures
  const { childrenMap, nodesWithChildren, nodeById } = useMemo(() => {
    const childrenMap = new Map<NodeId, TreeNodeInUI[]>();
    const nodesWithChildren = new Set<NodeId>();
    const nodeById = new Map<NodeId, TreeNodeInUI>();
    for (const node of controller.data ?? []) {
      nodeById.set(node.id, node);
      if (node.parentId) {
        const existing = childrenMap.get(node.parentId);
        if (existing) {
          existing.push(node);
        } else {
          childrenMap.set(node.parentId, [node]);
        }
        nodesWithChildren.add(node.parentId);
      }
    }
    return { childrenMap, nodesWithChildren, nodeById };
  }, [controller.data]);

  const getChildren = useCallback(
    (nodeId: NodeId): TreeNodeInUI[] => childrenMap.get(nodeId) ?? [],
    [childrenMap],
  );

  const hasChildren = useCallback(
    (nodeId: NodeId): boolean => nodesWithChildren.has(nodeId),
    [nodesWithChildren],
  );

  const columnApi = useColumnView({ getChildren, hasChildren });

  const handleSelectNode = useCallback(
    (nodeId: NodeId) => {
      columnApi.selectNode(nodeId);
      const node = nodeById.get(nodeId);
      if (onNodeClick && node) {
        onNodeClick(nodeId, node);
      }
    },
    [columnApi, nodeById, onNodeClick],
  );

  return (
    <ColumnView
      rootNodes={rootNodes}
      columnState={{ expandedPath: columnApi.columnPath, selectedNodeId: columnApi.selectedNodeId }}
      onSelectNode={handleSelectNode}
      getChildren={getChildren}
    />
  );
}
