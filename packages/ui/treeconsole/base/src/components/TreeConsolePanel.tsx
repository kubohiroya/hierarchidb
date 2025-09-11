import React, { memo, useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as CreateFolderIcon,
  InsertDriveFile as FileIcon,
  Map as MapIcon,
  NoteAdd as NoteAddIcon,
  Palette as PaletteIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import type { TreeTableColumn } from './TreeTable';
import { RowContextMenu } from './TreeTable';
import type { TreeNodeInUI, TreeTableController } from '@hierarchidb/ui-treeconsole-treetable';
import { TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeConsoleFooter } from './TreeConsoleFooter';
import type { SpeedDialActionType } from '@hierarchidb/ui-treeconsole-speeddial';
// import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { SpeedDialMenu } from '@hierarchidb/ui-treeconsole-speeddial';
import type { TreeNodeData } from '../types/index';

export interface TreeConsolePanelProps {
  readonly title?: string;
  readonly rootNodeId?: string;
  readonly data: readonly TreeNodeData[];
  readonly columns: readonly TreeTableColumn[];
  readonly breadcrumbItems: readonly any[];
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
  readonly onNodeSelect?: (nodeId: string, selected: boolean) => void;
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
  readonly onBreadcrumbNavigate: (nodeId: string, node?: any) => void;
  readonly onNavigateBack?: () => void;
  readonly onNavigateForward?: () => void;
  readonly canGoBack?: boolean;
  readonly canGoForward?: boolean;
  readonly onContextMenuAction: (action: string, node: TreeNodeData) => void;
  readonly onStartTour?: () => void;
  readonly onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
}

export const TreeConsolePanel = memo(function TreeConsolePanel(props: TreeConsolePanelProps) {
  const [contextMenuState, setContextMenuState] = useState<{
    node: TreeNodeData | null;
    anchorEl: HTMLElement | null;
  }>({ node: null, anchorEl: null });

  // Create TreeTableController from props
  const controller: TreeTableController = useMemo(() => {
    // Convert data to TreeNodeInUI format
    const data = props.data.map((node) => ({
      ...node,
      nodeType: node.nodeType || 'folder',
      type: node.nodeType,
      name: node.name || '',
      hasChildren: node.hasChildren || false,
    })) as TreeNodeInUI[];

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
      onNodeSelect: (nodeIds: string[], selected: boolean) => {
        if (props.onNodeSelect) {
          nodeIds.forEach((id) => props.onNodeSelect?.(id, selected));
        }
      },
      onNodeExpand: props.onNodeExpand,
      onMoveNodes: (nodeIds: string[], targetParentId: string) => {
        props.onMoveNodes?.(nodeIds, targetParentId);
      },
    };
  }, [
    props.data,
    props.selectedIds,
    props.expandedIds,
    props.onNodeClick,
    props.onNodeSelect,
    props.onNodeExpand,
    props.onMoveNodes,
  ]);

  const handleContextMenu = useCallback((event: React.MouseEvent, node: TreeNodeData) => {
    event.preventDefault();
    setContextMenuState({
      node,
      anchorEl: event.currentTarget as HTMLElement,
    });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({ node: null, anchorEl: null });
  }, []);

  const handleContextMenuAction = useCallback(
    (action: string) => {
      if (contextMenuState.node) {
        props.onContextMenuAction(action, contextMenuState.node);
      }
      handleContextMenuClose();
    },
    [contextMenuState.node, props.onContextMenuAction, handleContextMenuClose],
  );

  // SpeedDial actions
  const speedDialActions: SpeedDialActionType[] = [
    {
      icon: <CreateFolderIcon />,
      name: 'Create Folder',
      onClick: () => props.onCreate(),
    },
    {
      icon: <MapIcon />,
      name: 'Create BaseMap',
      onClick: () => props.onContextMenuAction('create:basemap', {} as TreeNodeData),
    },
    {
      icon: <PaletteIcon />,
      name: 'Create Styler',
      onClick: () => props.onContextMenuAction('create:styler-plugin', {} as TreeNodeData),
    },
    {
      icon: <PublicIcon />,
      name: 'Create Shape',
      onClick: () => props.onContextMenuAction('create:shapes', {} as TreeNodeData),
    },
    {
      icon: <NoteAddIcon />,
      name: 'Create Note',
      onClick: () => props.onContextMenuAction('create:note', {} as TreeNodeData),
    },
    {
      icon: <FileIcon />,
      name: 'Create File',
      onClick: () => props.onContextMenuAction('create:file', {} as TreeNodeData),
    },
  ];

  //const totalItems = props.data.length;
  //const selectedItems = props.selectedIds.length;
  // const visibleItems = props.data.length; // In real implementation, this would be filtered count

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Allow pointer events to pass through to SpeedDial
        '& > *:last-child': {
          pointerEvents: 'none',
        },
      }}
    >
      {/* Breadcrumb Navigation with drop-to-parent support */}
      <TreeConsoleBreadcrumb
        nodePath={[...props.breadcrumbItems]}
        onNodeClick={props.onBreadcrumbNavigate}
        variant="default"
        onDropToNode={(targetId, draggedId) => props.onMoveNodes?.([draggedId], targetId)}
      />
      {/* Toolbar
      <TreeTableToolbar
        title={props.title}
        searchTerm={props.searchTerm}
        onSearchChange={props.onSearchChange}
        onSearchClear={props.onSearchClear}
        selectedCount={selectedItems}
        totalCount={totalItems}
        canCreate={props.canCreate}
        canEdit={props.canEdit}
        canDelete={props.canDelete}
        onCreate={props.onCreate}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onRefresh={props.onRefresh}
        onExpandAll={props.onExpandAll}
        onCollapseAll={props.onCollapseAll}
        isLoading={props.loading}
        viewMode={props.viewMode}
        onViewModeChange={props.onViewModeChange}
        sortBy={props.sortBy}
        sortDirection={props.sortDirection}
        onSortChange={(field, direction: string) => {
          console.log('Sort direction:', direction);
          props.onSort(field);
        }}
        filterBy={props.filterBy}
        onFilterChange={props.onFilterChange}
        availableFilters={props.availableFilters}
      />
*/}
      {/* Main Table Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <TreeTableCore
          controller={controller}
          viewHeight={600}
          viewWidth={1200}
          useTrashColumns={false}
          depthOffset={0}
          disableDragAndDrop={false}
          hideDragHandler={false}
          rowClickAction="Select"
          selectionMode="multiple"
          onRowContextMenu={(node: TreeNodeInUI, event: React.MouseEvent) => {
            // Cast TreeNodeInUI to TreeNodeData for callback  
            const nodeData: TreeNodeData = {
              ...node,
              type: node.type || node.nodeType,
            };
            handleContextMenu(event as React.MouseEvent, nodeData);
          }}
        />
      </Box>

      {/* Footer */}
      <TreeConsoleFooter
        controller={null} // TODO: Convert TreeTableController to TreeViewController
        onStartTour={props.onStartTour}
        height={32}
      />

      {/* Context Menu */}
      <RowContextMenu
        nodeType={(contextMenuState.node as TreeNodeData)?.nodeType || 'folder'}
        addMenuNodeTypes={['folder', 'basemap', 'shapes', 'styler']}
        parentElem={contextMenuState.anchorEl}
        onClose={handleContextMenuClose}
        onOpen={() => handleContextMenuAction('open')}
        onOpenFolder={() => handleContextMenuAction('openFolder')}
        onPreview={() => handleContextMenuAction('preview')}
        onEdit={() => handleContextMenuAction('edit')}
        onCreate={(type) => handleContextMenuAction(`create:${type}`)}
        onDuplicate={() => handleContextMenuAction('duplicate')}
        onRemove={() => handleContextMenuAction('remove')}
        onCheckReference={() => handleContextMenuAction('checkReference')}
        canOpen={true}
        canEdit={props.canEdit}
        canCreate={props.canCreate}
        canRemove={props.canDelete}
        canDuplicate={true}
      />

      {/* SpeedDial Menu */}
      {props.canCreate && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999, // Increase z-index to ensure it's above other elements
            pointerEvents: 'auto', // Ensure pointer events work
          }}
          data-testid="speed-dial-container"
        >
          <SpeedDialMenu
            actions={speedDialActions}
            icon={<AddIcon />}
            tooltipTitle="Create new item"
            position={{ bottom: 0, right: 0 }}
          />
        </Box>
      )}
    </Box>
  );
});
