import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type {
  TreeConsoleBreadcrumbRendererProps as BreadcrumbRendererProps,
  OpenStepOption,
} from '@hierarchidb/ui-treeconsole-breadcrumb';
import { NodeContextMenu, TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import { type BuildSessionIndicator, TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import type { DualKeyMap } from '@hierarchidb/util';
import { Box, Slider, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColumnView } from '~/hooks/useColumnView.js';
import type { PanelBreadcrumbNode } from '~/hooks/useTreeConsolePanel';
import { useTreeConsolePanel } from '~/hooks/useTreeConsolePanel';
import type { HierarchicalTreeNode } from '~/types/index';
import type { SortMode, ViewMode } from '~/types/view-mode-types';
import { computeReorganizedPositions, computeZoomLayout } from '~/utils/zoom-layout';
import { BackgroundContextMenu } from './BackgroundContextMenu.js';
import { ColumnView } from './ColumnView.js';
import { IconView } from './IconView.js';
import { TagsLinkButton } from './TagsLinkButton.js';
import { TreeConsoleFooter } from './TreeConsoleFooter.js';
import type { TreeTableColumn } from './TreeTable/core/TreeTableView.js';

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
  readonly onIconPositionChange?: (nodeId: NodeId, position: { x: number; y: number }) => void;
  readonly columnTargetNodeId?: string;
  readonly onColumnNavigate?: (targetNodeId: string) => void;
  /** Detail panel for non-folder target node in column view (e.g. TreeNodeInfoPanel). */
  readonly columnDetailSlot?: React.ReactNode;
  readonly canCreate: boolean;
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
    props.treeId && props.pageNodeId && props.onNavigateTags ? (
      <TagsLinkButton
        treeId={props.treeId}
        pageNodeId={props.pageNodeId}
        onNavigate={props.onNavigateTags}
      />
    ) : undefined;

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

  const selectedIdSet = useMemo(() => {
    const set = new Set<string>();
    if (controller.rowSelection) {
      for (const [id, selected] of Object.entries(controller.rowSelection)) {
        if (selected) set.add(id);
      }
    }
    return set;
  }, [controller.rowSelection]);

  const treeTableContainerRef = useRef<HTMLDivElement>(null);

  const [iconContextMenu, setIconContextMenu] = useState<{
    node: TreeNodeInUI;
    position: { left: number; top: number };
  } | null>(null);

  const handleIconContextMenu = useCallback(
    (node: TreeNodeInUI, position: { left: number; top: number }) => {
      controller.onNodeSelect?.([node.id], true);
      setIconContextMenu({ node, position });
    },
    [controller]
  );

  const handleIconContextMenuClose = useCallback(() => {
    setIconContextMenu(null);
  }, []);

  const [bgContextMenu, setBgContextMenu] = useState<{
    left: number;
    top: number;
    targetNodeId: string;
  } | null>(null);

  const handleBgContextMenu = useCallback(
    (position: { left: number; top: number }, targetNodeId?: string) => {
      controller.onNodeSelect?.([], false);
      setBgContextMenu({ ...position, targetNodeId: targetNodeId ?? props.pageNodeId ?? '' });
    },
    [controller, props.pageNodeId]
  );

  const handleBgContextMenuClose = useCallback(() => {
    setBgContextMenu(null);
  }, []);

  const handleColumnBgContextMenu = useCallback(
    (folderId: string, position: { left: number; top: number }) => {
      controller.onNodeSelect?.([], false);
      setBgContextMenu({ ...position, targetNodeId: folderId });
    },
    [controller]
  );

  const handleReorganizeIcons = useCallback(() => {
    const nodes = controller.data ?? [];
    if (nodes.length === 0) return;

    const zoomLevel = props.zoomLevel ?? 50;
    const { cellSize } = computeZoomLayout(zoomLevel);

    // Read viewport width from the tree-table container ref.
    const viewportWidth = treeTableContainerRef.current?.clientWidth ?? 800;

    const positions = computeReorganizedPositions(nodes, viewportWidth, cellSize);
    const onIconPositionChange = props.onIconPositionChange;
    if (!onIconPositionChange) return;

    for (const pos of positions) {
      onIconPositionChange(pos.nodeId as NodeId, { x: pos.col, y: pos.row });
    }
  }, [controller.data, props.zoomLevel, props.onIconPositionChange]);

  // Adapter: BackgroundContextMenu passes { id: string } but controller expects TreeNodeInUI.
  // Background actions (create, import, export) only need the target node id.
  const handleBgContextAction = useCallback(
    (action: string, node: { id: string }, options?: Record<string, unknown>) => {
      controller.onContextAction?.(action, node as TreeNodeInUI, options);
    },
    [controller]
  );

  if (!isPageContextValid) {
    return <Box>Invalid page context</Box>;
  }

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
            ref={treeTableContainerRef}
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
                onIconPositionChange={props.onIconPositionChange ?? (() => {})}
                onNodeClick={
                  controller.onNodeClick ? (nodeId) => controller.onNodeClick?.(nodeId) : undefined
                }
                onNodeDoubleClick={
                  controller.onNodeClick
                    ? (nodeId, node) => controller.onNodeClick?.(nodeId, node)
                    : undefined
                }
                onNodeSelect={controller.onNodeSelect}
                onContextMenu={handleIconContextMenu}
                onBackgroundContextMenu={handleBgContextMenu}
              />
            ) : props.viewMode === 'column' ? (
              <ColumnViewWrapper
                controller={controller}
                onNodeClick={controller.onNodeClick}
                columnTargetNodeId={props.columnTargetNodeId}
                onColumnNavigate={props.onColumnNavigate}
                onIconContextMenu={handleIconContextMenu}
                onBackgroundContextMenu={handleColumnBgContextMenu}
                columnDetailSlot={props.columnDetailSlot}
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
          ref={treeTableContainerRef}
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
              onIconPositionChange={props.onIconPositionChange ?? (() => {})}
              onNodeClick={
                controller.onNodeClick ? (nodeId) => controller.onNodeClick?.(nodeId) : undefined
              }
              onNodeDoubleClick={
                controller.onNodeClick
                  ? (nodeId, node) => controller.onNodeClick?.(nodeId, node)
                  : undefined
              }
              onNodeSelect={controller.onNodeSelect}
              onContextMenu={handleIconContextMenu}
              onBackgroundContextMenu={handleBgContextMenu}
            />
          ) : props.viewMode === 'column' ? (
            <ColumnViewWrapper
              controller={controller}
              onNodeClick={controller.onNodeClick}
              columnTargetNodeId={props.columnTargetNodeId}
              onColumnNavigate={props.onColumnNavigate}
              onIconContextMenu={handleIconContextMenu}
              onBackgroundContextMenu={handleColumnBgContextMenu}
              columnDetailSlot={props.columnDetailSlot}
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
          loadingTooltip={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" display="block">
                From left to right:
              </Typography>
              <Typography variant="caption" display="block">
                - Number of top-level children in the subscribed subtree
              </Typography>
              <Typography variant="caption" display="block">
                - Number of loaded nodes (visible + expanded)
              </Typography>
              <Typography variant="caption" display="block">
                - Number of selected nodes
              </Typography>
            </Box>
          }
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
          anchorEl={null}
          anchorPosition={iconContextMenu.position}
          open={true}
          onClose={handleIconContextMenuClose}
          nodeId={iconContextMenu.node.id}
          nodeType={iconContextMenu.node.nodeType}
          nodeName={iconContextMenu.node.metadata?.name}
          treeId={props.treeId}
          canOpen={true}
          canEdit={true}
          canDuplicate={true}
          canArchive={true}
          canCopy={true}
          onOpen={() => {
            controller.onContextAction?.('open', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onOpenFolder={() => {
            controller.onContextAction?.('openFolder', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onEdit={() => {
            controller.onContextAction?.('edit', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onDuplicate={() => {
            controller.onContextAction?.('duplicate', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onArchive={() => {
            controller.onContextAction?.('archive', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onCopy={() => {
            controller.onContextAction?.('copy', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onImport={() => {
            controller.onContextAction?.('import', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
          onExport={() => {
            controller.onContextAction?.('export', iconContextMenu.node);
            handleIconContextMenuClose();
          }}
        />
      )}

      <BackgroundContextMenu
        anchorPosition={bgContextMenu}
        open={Boolean(bgContextMenu)}
        onClose={handleBgContextMenuClose}
        treeId={props.treeId}
        targetNodeId={bgContextMenu?.targetNodeId}
        sortMode={props.sortMode}
        showReorganize={props.viewMode === 'icon'}
        onContextAction={handleBgContextAction}
        onReorganizeIcons={handleReorganizeIcons}
      />
    </Box>
  );
});

// -- ColumnView wrapper that manages useColumnView hook --

import type { TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';

interface ColumnViewWrapperProps {
  controller: TreeTableController;
  onNodeClick?: (nodeId: string, node?: TreeNodeInUI) => void;
  columnTargetNodeId?: string;
  onColumnNavigate?: (targetNodeId: string) => void;
  onIconContextMenu?: (node: TreeNodeInUI, position: { left: number; top: number }) => void;
  onBackgroundContextMenu?: (folderId: string, position: { left: number; top: number }) => void;
  columnDetailSlot?: React.ReactNode;
}

function ColumnViewWrapper({
  controller,
  onNodeClick: _onNodeClick,
  columnTargetNodeId,
  onColumnNavigate,
  onIconContextMenu,
  onBackgroundContextMenu,
  columnDetailSlot,
}: ColumnViewWrapperProps) {
  const { rootNodes, childrenMap, nodesWithChildren, nodeById } = useMemo(() => {
    const allNodes = controller.data ?? [];
    const childrenMap = new Map<NodeId, TreeNodeInUI[]>();
    const nodesWithChildren = new Set<NodeId>();
    const nodeById = new Map<NodeId, TreeNodeInUI>();

    for (const node of allNodes) {
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

    const rootId = controller.rootNodeId;
    let roots: TreeNodeInUI[];
    if (rootId) {
      roots = childrenMap.get(rootId) ?? [];
    } else {
      const minDepth = allNodes.length > 0 ? Math.min(...allNodes.map((n) => n.depth)) : 0;
      roots = allNodes.filter((n) => n.depth === minDepth);
    }

    return { rootNodes: roots, childrenMap, nodesWithChildren, nodeById };
  }, [controller.data, controller.rootNodeId]);

  // Build ancestor path from columnTargetNodeId back to root
  const initialExpandedPath = useMemo(() => {
    if (!columnTargetNodeId) return [];
    const path: NodeId[] = [];
    let currentId: NodeId | undefined = columnTargetNodeId as NodeId;
    const rootId = controller.rootNodeId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = nodeById.get(currentId);
      if (!node) break;
      if (rootId && currentId === rootId) break;
      path.unshift(currentId);
      currentId = node.parentId;
    }

    return path;
  }, [columnTargetNodeId, nodeById, controller.rootNodeId]);

  const getChildren = useCallback(
    (nodeId: NodeId): TreeNodeInUI[] => childrenMap.get(nodeId) ?? [],
    [childrenMap]
  );

  const hasChildren = useCallback(
    (nodeId: NodeId): boolean => {
      if (nodesWithChildren.has(nodeId)) return true;
      const node = nodeById.get(nodeId);
      return node?.hasChildren ?? false;
    },
    [nodesWithChildren, nodeById]
  );

  const columnApi = useColumnView({
    getChildren,
    hasChildren,
    initialState:
      initialExpandedPath.length > 0
        ? {
            expandedPath: initialExpandedPath,
            selectedNodeId: initialExpandedPath[initialExpandedPath.length - 1] ?? null,
          }
        : undefined,
  });

  // Expand ancestor nodes to load their children incrementally
  // Uses a Set to track already-expanded nodes so that newly discovered
  // ancestors (from incremental loading) are also expanded.
  const expandedNodesRef = useRef(new Set<NodeId>());
  useEffect(() => {
    if (initialExpandedPath.length === 0) return;
    for (const nodeId of initialExpandedPath) {
      if (!expandedNodesRef.current.has(nodeId)) {
        expandedNodesRef.current.add(nodeId);
        controller.onNodeExpand?.(nodeId, true);
      }
    }
  }, [initialExpandedPath, controller]);

  const handleSelectNode = useCallback(
    (nodeId: NodeId) => {
      const node = nodeById.get(nodeId);

      if (node?.hasChildren || nodesWithChildren.has(nodeId)) {
        controller.onNodeExpand?.(nodeId, true);
      }

      columnApi.selectNode(nodeId);

      // Update URL targetNodeId for column navigation
      if (onColumnNavigate) {
        onColumnNavigate(nodeId);
      }
    },
    [columnApi, nodeById, nodesWithChildren, onColumnNavigate, controller]
  );

  return (
    <ColumnView
      rootNodes={rootNodes}
      columnState={{ expandedPath: columnApi.columnPath, selectedNodeId: columnApi.selectedNodeId }}
      onSelectNode={handleSelectNode}
      getChildren={getChildren}
      onIconContextMenu={onIconContextMenu}
      onBackgroundContextMenu={onBackgroundContextMenu}
      rootFolderId={controller.rootNodeId}
      detailSlot={columnDetailSlot}
    />
  );
}
