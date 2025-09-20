/**
 * TreeTableCore
 * Coordinates TreeTable controller state with presentational building blocks.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { TreeTableCoreProps } from '../types.js';
import { StyledTable, StyledTableContainer } from './TreeTableStyles.js';
import { TreeTableRows } from './internal/TreeTableRows.js';
import { TreeTableHeader } from './internal/TreeTableHeader.js';
import { TreeTableContextMenu } from './internal/TreeTableContextMenu.js';
import { useTreeTableStructure } from './hooks/useTreeTableStructure.js';
import { useTreeTableColumnWidths } from './hooks/useTreeTableColumnWidths.js';
import { useTreeTableSelectAll } from './hooks/useTreeTableSelectAll.js';
import { useTreeTableSelectionOverlay } from './hooks/useTreeTableSelectionOverlay.js';
import { useTreeTableEditing } from './hooks/useTreeTableEditing.js';
import { useTreeTableRowInteractions } from './hooks/useTreeTableRowInteractions.js';
import { createTreeTableColumns } from './internal/createTreeTableColumns.js';

export function TreeTableCore({
  controller,
  viewHeight,
  viewWidth: _viewWidth,
  useTrashColumns = false,
  depthOffset = 0,
  disableDragAndDrop = false,
  hideDragHandler = false,
  rowClickAction = 'Select/Navigate',
  selectionMode = 'multiple',
  NodeTypeIcon: CustomNodeTypeIcon,
  NodeContextMenu: CustomNodeContextMenu,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu: _onRowContextMenu,
  pageNodeId,
  treeId,
}: TreeTableCoreProps): ReactElement {
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [contextMenuState, setContextMenuState] = useState<{ anchorEl: HTMLElement | null; node: TreeNode | null }>({
    anchorEl: null,
    node: null,
  });
  const [hoverDropTargetId, setHoverDropTargetId] = useState<string | null>(null);
  const [forbiddenTargets, setForbiddenTargets] = useState<Set<NodeId>>(new Set());

  const structure = useTreeTableStructure({ controller });
  const { columnWidths, containerRef, handleResizeStart, resizingColumn } = useTreeTableColumnWidths({ pageNodeId });
  const { selectAll, selectAllHydrated, setSelectAll } = useTreeTableSelectAll({ pageNodeId });

  const {
    editingNodeId,
    setEditingNodeId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
    editingError,
    setEditingError,
    validateInline,
    handleStartEdit,
  } = useTreeTableEditing({ controller });

  const {
    visualSelectionSet,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    batchSelect,
  } = useTreeTableSelectionOverlay({
    data: structure.data,
    rowSelection: structure.rowSelection,
    selectAll,
    selectAllHydrated,
    setSelectAll,
    controller,
    visibleData: structure.visibleData,
    getDescendants: structure.getDescendants,
  });

  const { handleRowClick, handleRowDoubleClick } = useTreeTableRowInteractions({
    controller,
    rowSelection: structure.rowSelection,
    selectionMode,
    rowClickAction,
    onRowClick,
    onRowDoubleClick,
    selectAll,
    handleStartEdit,
  });

  const columns = useMemo(() => createTreeTableColumns({
    columnWidths,
    selectAll,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    pageNodeId,
    selectAllHydrated,
    hasSelectedAncestor: structure.hasSelectedAncestor,
    rowSelection: structure.rowSelection,
    collectDescendantIds: structure.collectDescendantIds,
    batchSelect,
    depthOffset,
    nodesWithChildren: structure.nodesWithChildren,
    expandedRowIds: structure.expandedRowIds,
    editingNodeId,
    hideDragHandler,
    disableDragAndDrop,
    IconComponent,
    rowClickAction,
    selectionMode,
    controller,
    validateInline,
    handleStartEdit,
    editingField,
    editingValue,
    setEditingValue,
    editingError,
    setEditingError,
    setEditingNodeId,
    setEditingField,
    treeId,
    setContextMenuState,
    visualSelectionSet,
    useTrashColumns,
  }), [
    columnWidths,
    selectAll,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    pageNodeId,
    selectAllHydrated,
    structure.hasSelectedAncestor,
    structure.rowSelection,
    structure.collectDescendantIds,
    batchSelect,
    depthOffset,
    structure.nodesWithChildren,
    structure.expandedRowIds,
    editingNodeId,
    hideDragHandler,
    disableDragAndDrop,
    IconComponent,
    rowClickAction,
    selectionMode,
    controller,
    validateInline,
    handleStartEdit,
    editingField,
    editingValue,
    editingError,
    treeId,
    setContextMenuState,
    visualSelectionSet,
    useTrashColumns,
  ]);

  const table = useReactTable({
    data: structure.visibleData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => String(row.id ?? ''),
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
    state: {
      rowSelection: structure.rowSelection,
      sorting,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      if (selectAll) return;
      if (typeof updater === 'function') {
        const newSelection = updater(structure.rowSelection);
        const selectedIds = Object.keys(newSelection).filter((id) => newSelection[id]);
        controller?.onNodeSelect?.(selectedIds, true);
      }
    },
  });

  const handleContextMenuClose = () => {
    setContextMenuState({ anchorEl: null, node: null });
  };

  return (
    <StyledTableContainer ref={containerRef} sx={{ height: viewHeight || '100%', width: '100%' }}>
      <StyledTable>
        <TreeTableHeader
          table={table}
          columnWidths={columnWidths}
          resizingColumn={resizingColumn}
          handleResizeStart={handleResizeStart}
        />

        <TreeTableRows
          table={table}
          visibleData={structure.visibleData}
          columnWidths={columnWidths}
          columnsLength={columns.length}
          selectAll={selectAll}
          selectAllHydrated={selectAllHydrated}
          hasSelectedAncestor={structure.hasSelectedAncestor}
          rowSelection={structure.rowSelection}
          collectDescendantIds={structure.collectDescendantIds}
          batchSelect={batchSelect}
          depthOffset={depthOffset}
          treeId={treeId}
          pageNodeId={pageNodeId}
          handleRowClick={handleRowClick}
          handleRowDoubleClick={handleRowDoubleClick}
          hoverDropTargetId={hoverDropTargetId}
          setHoverDropTargetId={setHoverDropTargetId}
          forbiddenTargets={forbiddenTargets}
          setForbiddenTargets={setForbiddenTargets}
          getDescendants={structure.getDescendants}
          controller={controller}
          disableDragAndDrop={disableDragAndDrop}
          visualSelectionSet={visualSelectionSet}
        />
      </StyledTable>

      <TreeTableContextMenu
        contextMenuState={contextMenuState}
        onClose={handleContextMenuClose}
        treeId={treeId}
        controller={controller}
        ContextMenuComponent={ContextMenuComponent}
      />
    </StyledTableContainer>
  );
}
