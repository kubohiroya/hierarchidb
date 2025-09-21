import { memo, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { TreeTableColumn } from './TreeTable/index.js';
// RowContextMenu removed: right-click is disabled app-wide
import type { TreeNodeInUI, TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import { TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleFooter } from './TreeConsoleFooter.js';
// import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { TreeNodeData } from '../types/index.js';

type PanelBreadcrumbNode = {
  treeNodeId?: string;
  id?: string;
  nodeType?: string;
  type?: string;
  name?: string;
  parentId?: string | null;
};

export interface TreeConsolePanelProps {
  readonly title?: string;
  /** Optional treeId for context-aware menus (e.g., 'r'|'t'|'p') */
  readonly treeId?: string;
  /**
   * Page context root (formerly called rootNodeId in this component).
   * Keep naming aligned with app layer that uses `pageNodeId`.
   */
  readonly pageNodeId?: string;
  readonly data: readonly TreeNodeData[];
  readonly columns: readonly TreeTableColumn[];
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
  readonly canDelete: boolean;
  readonly showNavigationButtons?: boolean;
  readonly maxHeight?: number | string;
  readonly dense?: boolean;
  readonly onNodeClick?: (node: TreeNodeData) => void;
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
  readonly onContextMenuAction: (action: string, node: TreeNodeData) => void;
  readonly onStartTour?: () => void;
  readonly onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
  /** Optional: For column-width persistence, provide treeId to scope keys */
  readonly treeIdForPersistence?: string;
  /** Row click action behavior */
  readonly rowClickAction?: 'Edit' | 'Select/Navigate';
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
}

export const TreeConsolePanel = memo(function TreeConsolePanel(props: TreeConsolePanelProps) {
  // Right-click context menus are disabled by policy

  // Create TreeTableController from props
  const controller: TreeTableController = useMemo((): TreeTableController => {
    // Convert data to TreeNodeInUI format
    const data = props.data.map((node) => {
      const d = (node as TreeNodeData).depth as number | undefined;
      const depth = typeof d === 'number' && isFinite(d) ? d : 1; // default: root's direct child
      return {
        ...node,
        nodeType: node.nodeType || 'folder',
        type: node.nodeType,
        name: node.name || '',
        hasChildren: Boolean((node as TreeNodeData).hasChildren),
        depth,
      } as TreeNodeInUI;
    });

    // Convert selectedIds and expandedIds to the expected format
    const rowSelection: Record<string, boolean> = {};
    props.selectedIds.forEach((id) => {
      rowSelection[id] = true;
    });

    const expandedRowIds = new Set(props.expandedIds);

    return {
      data,
      rowSelection,
      expandedRowIds,
      startEdit: async (_nodeId: string) => {},
      finishEdit: (nodeId: string, newValue: string, field: 'name' | 'description' = 'name') => {
        // delegate to parent handler via context-menu action channel
        const nodeData: TreeNodeData = (field === 'name'
          ? ({ id: nodeId, name: newValue })
          : ({ id: nodeId, description: newValue })) as unknown as TreeNodeData;
        props.onContextMenuAction(field === 'name' ? 'rename-inline' : 'update-desc-inline', nodeData);
      },
      cancelEdit: () => {},
      onNodeClick: (_nodeId: string, node?: TreeNodeInUI) => {
        if (node && props.onNodeClick) {
          // Cast TreeNodeInUI to TreeNodeData for callback
          // TreeNodeInUI is compatible with TreeNodeData
          const nodeData: TreeNodeData = {
            ...node,
            type: node.type || node.nodeType,
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
    };
  }, [props]);

  // No right-click handlers

  // SpeedDial actions
  // Built-in static SpeedDial removed; host app may provide DynamicSpeedDial instead.

  //const totalItems = props.data.length;
  //const selectedItems = props.selectedIds.length;
  // const visibleItems = props.data.length; // In real implementation, this would be filtered count

  // Compute footer counters for loading state (controller not yet available)
  const countLoadedRecursive = (nodes: readonly TreeNodeData[]): number => {
    let c = 0;
    for (const n of nodes || []) {
      c += 1;
      const ch = n.children as readonly TreeNodeData[] | undefined;
      if (Array.isArray(ch) && ch.length) c += countLoadedRecursive(ch);
    }
    return c;
  };
  const footerTopLevel = Array.isArray(props.data) ? props.data.length : 0;
  const footerLoaded = countLoadedRecursive(props.data);
  const footerSelected = props.selectedIds.length;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Breadcrumb Navigation with drop-to-parent support */}
      <TreeConsoleBreadcrumb
        nodePath={[...props.breadcrumbItems]}
        onNodeClick={props.onBreadcrumbNavigate}
        treeId={props.treeId}
        variant="default"
        pageNodeId={props.pageNodeId}
        useTrashColumns={props.useTrashColumns ?? false}
        trashAction={props.trashAction}
        iconInteractive={!Boolean(props.useTrashColumns)}
        onDropToNode={(targetId: string, draggedId: string) => props.onMoveNodes?.([draggedId], targetId)}
      />
      {/* Main Table Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', paddingLeft: '8px', paddingRight: '8px' }}>
      <TreeTableCore
        controller={controller}
        viewHeight={600}
        viewWidth={1200}
        treeId={props.treeId}
        pageNodeId={props.pageNodeId}
        useTrashColumns={props.useTrashColumns ?? false}
        trashAction={props.trashAction}
        depthOffset={0}
        disableDragAndDrop={false}
        hideDragHandler={props.hideDragHandler ?? false}
        rowClickAction={props.rowClickAction ?? 'Select/Navigate'}
        selectionMode="multiple"
          // Right-click disabled
        />
      </Box>

      {/* Footer */}
      <TreeConsoleFooter
        controller={null} // TODO: Convert TreeTableController to TreeViewController
        onStartTour={props.onStartTour}
        height={32}
        loadingText={`${footerTopLevel} / ${footerLoaded} / ${footerSelected}`}
        loadingTooltip={(
          <Box sx={{ p: 0.5 }}>
            <Typography variant="caption" display="block">左から順に:</Typography>
            <Typography variant="caption" display="block">- 購読中サブツリーの最上位の子の数</Typography>
            <Typography variant="caption" display="block">- 読み込み済みのノード数（表示中＋展開分）</Typography>
            <Typography variant="caption" display="block">- 選択されているノード数</Typography>
          </Box>
        )}
      />

      {/* Right-click context menu removed per policy */}

      {/* Built-in SpeedDial disabled */}
    </Box>
  );
});
