import type { ReactElement } from 'react';
import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import type { TreeTableColumn } from './TreeTable/index.js';
// RowContextMenu removed: right-click is disabled app-wide
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { type BuildSessionIndicator, TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import type { OpenStepOption, TreeConsoleBreadcrumbRendererProps as BreadcrumbRendererProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleFooter } from './TreeConsoleFooter.js';
import type { HierarchicalTreeNode } from '../types/index.js';
import type { DualKeyMap } from '@hierarchidb/util';
import type { PanelBreadcrumbNode } from '../hooks/useTreeConsolePanel.js';
import { useTreeConsolePanel } from '../hooks/useTreeConsolePanel.js';
import { TagsLinkButton } from './TagsLinkButton.js';

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
  readonly breadcrumbRenderer?: (props: TreeConsoleBreadcrumbRendererProps) => ReactElement;
  /** Optional info panel to show alongside the table in split view. */
  readonly infoPanel?: ReactElement;
}

export const TreeConsolePanel = memo(function TreeConsolePanel(props: TreeConsolePanelProps) {
  const tagsLeftSlot =
    props.treeId && props.pageNodeId
      ? <TagsLinkButton treeId={props.treeId} pageNodeId={props.pageNodeId} />
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
    useTrashColumns: props.useTrashColumns,
    trashAction: props.trashAction,
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
              buildSessionIndicator={props.buildSessionIndicator}
              useTrashColumns={props.useTrashColumns ?? false}
              trashAction={props.trashAction}
              depthOffset={controller.depthOffset ?? 0}
              disableDragAndDrop={false}
              hideDragHandler={props.hideDragHandler ?? false}
              rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
              selectionMode="multiple"
            />
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
            buildSessionIndicator={props.buildSessionIndicator}
            useTrashColumns={props.useTrashColumns ?? false}
            trashAction={props.trashAction}
            depthOffset={controller.depthOffset ?? 0}
            disableDragAndDrop={false}
            hideDragHandler={props.hideDragHandler ?? false}
            rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
            selectionMode="multiple"
          />
        </Box>
      )}

      {!props.useTrashColumns && (
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
        />
      )}
    </Box>
  );
});
