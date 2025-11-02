/**
 * TreeTableCore
 * Coordinates TreeTable controller state with presentational building blocks.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
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
  trashAction = 'restore',
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
  const {
    columnWidths,
    setContainerElement,
    setObserverTarget,
    handleResizeStart,
    resizingColumn,
  } = useTreeTableColumnWidths({ pageNodeId });

  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
    const parent = node?.parentElement ?? null;
    const grandParent = parent?.parentElement ?? null;
    setObserverTarget(grandParent ?? parent ?? null);
  }, [setContainerElement, setObserverTarget]);
  const { selectAll, selectAllHydrated, setSelectAll } = useTreeTableSelectAll({ pageNodeId });

  const {
    editingNodeId,
    setEditingNodeId,
    editingField,
    setEditingField,
    editingValue,
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

  const { t: selectAllT } = useTranslation('common', { keyPrefix: 'treeTable.selectAll' });
  const { t: commonT, i18n } = useTranslation('common');
  const languageKey = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';

  const formatTimestamp = useCallback(
    (value?: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '-';
      }
      const target = new Date(value);
      if (Number.isNaN(target.getTime())) {
        return '-';
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const diffMs = startOfToday.getTime() - startOfTarget.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const diffDays = Math.floor(diffMs / dayMs);

      const timeFormatOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
      if (languageKey.startsWith('ja')) {
        timeFormatOptions.hour12 = false;
      }
      const timeFormatter = new Intl.DateTimeFormat(languageKey, timeFormatOptions);
      const time = timeFormatter.format(target);

      if (diffDays === 0) {
        return commonT('treeTable.timestamps.today', { time });
      }
      if (diffDays === 1) {
        return commonT('treeTable.timestamps.yesterday', { time });
      }
      if (diffDays === 2) {
        return commonT('treeTable.timestamps.twoDaysAgo', { time });
      }

      const dateFormatter = new Intl.DateTimeFormat(languageKey, {
        year: 'numeric',
        month: languageKey.startsWith('ja') ? 'numeric' : 'long',
        day: 'numeric',
      });
      const date = dateFormatter.format(target);
      return commonT('treeTable.timestamps.dateTime', { date, time });
    },
    [commonT, languageKey],
  );

  const columns = useMemo(() => createTreeTableColumns({
    columnWidths,
    selectAll,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    pageNodeId,
    selectAllHydrated,
    selectAllLabels: {
      select: selectAllT('select'),
      clear: selectAllT('clear'),
    },
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
    iconInteractive: !useTrashColumns,
    rowClickAction,
    selectionMode,
    controller,
    validateInline,
    handleStartEdit,
    editingField,
    editingValue,
    editingError,
    setEditingError,
    setEditingNodeId,
    setEditingField,
    treeId,
    setContextMenuState,
    visualSelectionSet,
    useTrashColumns,
    trashAction,
    formatTimestamp,
    trashRemovedHeader: (useTrashColumns ? commonT('treeTable.columns.removed') : undefined) ?? undefined,
  }), [columnWidths, selectAll, allRowsSelected, someSelected, handleSelectAll, pageNodeId, selectAllHydrated, selectAllT, commonT, structure.hasSelectedAncestor, structure.rowSelection, structure.collectDescendantIds, structure.nodesWithChildren, structure.expandedRowIds, batchSelect, depthOffset, editingNodeId, hideDragHandler, disableDragAndDrop, IconComponent, useTrashColumns, rowClickAction, selectionMode, controller, validateInline, handleStartEdit, editingField, editingValue, editingError, setEditingError, setEditingNodeId, setEditingField, treeId, setContextMenuState, visualSelectionSet, trashAction, formatTimestamp]);

  const expandedState = useMemo(() => {
    const record: Record<string, boolean> = {};
    structure.expandedRowIds.forEach((id) => {
      record[String(id)] = true;
    });
    return record;
  }, [structure.expandedRowIds]);

  const table = useReactTable({
    data: structure.tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSubRows: structure.getSubRows,
    getRowId: (row) => String(row.id ?? ''),
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
    state: {
      rowSelection: structure.rowSelection,
      sorting,
      expanded: expandedState,
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
    <StyledTableContainer ref={handleContainerRef} sx={{ height: viewHeight || '100%', width: '100%' }}>
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
          useTrashColumns={useTrashColumns}
          trashAction={trashAction}
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
