/**
 * TreeTableCore
 * Coordinates TreeTable controller atoms with presentational building blocks.
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
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { Skeleton, TableBody, TableCell, TableRow } from '@mui/material';
import type { TreeNodeInUI, TreeTableCoreProps } from '../types.js';
import { StyledTable, StyledTableContainer, StyledTableHead } from './TreeTableStyles.js';
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
  useArchiveColumns = false,
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
  selectAllPersistence = 'page',
  selectionIdPrefix = 'row-selection',
  buildSessionIndicator,
}: TreeTableCoreProps): ReactElement {
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [contextMenuState, setContextMenuState] = useState<{
    anchorEl: HTMLElement | null;
    anchorPosition: { left: number; top: number } | null;
    node: TreeNodeInUI | TreeNode | null;
  }>({
    anchorEl: null,
    anchorPosition: null,
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
    columnWidthsReady,
  } = useTreeTableColumnWidths({ pageNodeId });

  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
    const parent = node?.parentElement ?? null;
    const grandParent = parent?.parentElement ?? null;
    setObserverTarget(grandParent ?? parent ?? null);
  }, [setContainerElement, setObserverTarget]);
  const { selectAll, selectAllHydrated, setSelectAll } = useTreeTableSelectAll({
    pageNodeId,
    persistence: selectAllPersistence,
  });

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

  const columns = useMemo(() => {
    const draftIds = new Set(
      structure.rawData
        .filter((n) => {
          const draftData = (n as { draftData?: unknown }).draftData;
          const draftMetadata = (n as { draftMetadata?: unknown }).draftMetadata;
          return (
            draftData !== undefined
          ) || (
            draftMetadata !== null && draftMetadata !== undefined
          );
        })
        .map((n) => n.id as string as NodeId)
    );

    const removedLabel = (commonT('treeTable.columns.removed', 'Removed') ?? 'Removed') as string;
    const nameLabel = (commonT('treeTable.columns.name', 'Name') ?? 'Name') as string;
    const descriptionLabel = (commonT('treeTable.columns.description', 'Description') ?? 'Description') as string;
    const createdLabel = (commonT('treeTable.columns.created', 'Created') ?? 'Created') as string;
    const updatedLabel = (commonT('treeTable.columns.updated', 'Updated') ?? 'Updated') as string;

    return createTreeTableColumns({
      draftFlags: {
        hasDraft: draftIds,
        hasDescendantDraft: (nodeId: NodeId) => {
          const descendants = structure.collectDescendantIds(nodeId);
          return descendants.some((id) => draftIds.has(id as NodeId));
        },
      },
      draftChipLabels: {
        self: commonT('treeTable.chips.draftSelf', 'Draft'),
        descendant: {
          singular: commonT('treeTable.chips.draftDescendantSingular', 'Draft in Subtree'),
          plural: commonT('treeTable.chips.draftDescendantPlural', 'Drafts in Subtree'),
        },
      },
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
      iconInteractive: !useArchiveColumns,
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
      useArchiveColumns,
      trashAction,
      formatTimestamp,
      trashRemovedHeader: useArchiveColumns ? removedLabel : undefined,
      selectionIdPrefix,
      columnLabels: {
        name: nameLabel,
        description: descriptionLabel,
        created: createdLabel,
        updated: updatedLabel,
        removed: removedLabel,
      },
      validationMessages: {
        invalidName: commonT('treeTable.validation.invalidName', 'Invalid name'),
        invalidDescription: commonT('treeTable.validation.invalidDescription', 'Invalid description'),
      },
      placeholders: {
        nameEdit: commonT('treeTable.placeholders.nameConfirm', 'Press Enter to confirm / Esc to cancel'),
        descriptionEdit: commonT('treeTable.placeholders.descriptionConfirm', 'Press Ctrl+Enter to confirm / Esc to cancel'),
      },
      emptyValue: commonT('treeTable.emptyCell', '-'),
      buildSessionIndicator,
    });
  }, [structure, commonT, columnWidths, selectAll, allRowsSelected, someSelected, handleSelectAll, pageNodeId, selectAllHydrated, selectAllT, batchSelect, depthOffset, editingNodeId, hideDragHandler, disableDragAndDrop, IconComponent, useArchiveColumns, rowClickAction, selectionMode, controller, validateInline, handleStartEdit, editingField, editingValue, editingError, setEditingError, setEditingNodeId, setEditingField, treeId, visualSelectionSet, trashAction, formatTimestamp, selectionIdPrefix, buildSessionIndicator]);

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
    setContextMenuState({ anchorEl: null, anchorPosition: null, node: null });
  };

  const renderSkeletonHeader = () => (
    <TableRow>
      {columns.map((column, index) => {
        const columnId = column.id ?? `col-${index}`;
        const width = columnWidths[columnId];
        const isSelection = columnId === 'selection';
        return (
          <TableCell
            key={`skeleton-header-${columnId}`}
            sx={{
              width: width ? `${width}px` : undefined,
              minWidth: width ? `${width}px` : undefined,
              maxWidth: width ? `${width}px` : undefined,
              paddingLeft: '4px',
              paddingRight: '4px',
            }}
          >
            <Skeleton variant="text" width={isSelection ? 24 : '60%'} />
          </TableCell>
        );
      })}
    </TableRow>
  );

  const renderSkeletonRows = (count = 8) =>
    Array.from({ length: count }).map((_, rowIndex) => (
      <TableRow key={`skeleton-row-${String(rowIndex)}`}>
        {columns.map((column, index) => {
          const columnId = column.id ?? `col-${index}`;
          const width = columnWidths[columnId];
          const isSelection = columnId === 'selection';
          return (
            <TableCell
              key={`skeleton-cell-${columnId}-${String(rowIndex)}`}
              sx={{
                width: width ? `${width}px` : undefined,
                minWidth: width ? `${width}px` : undefined,
                maxWidth: width ? `${width}px` : undefined,
                paddingLeft: '4px',
                paddingRight: '4px',
              }}
            >
              <Skeleton variant={isSelection ? 'rectangular' : 'text'} width={isSelection ? 16 : '80%'} height={isSelection ? 16 : undefined} />
            </TableCell>
          );
        })}
      </TableRow>
    ));

  return (
    <StyledTableContainer ref={handleContainerRef} sx={{ height: viewHeight || '100%', width: '100%' }}>
      <StyledTable>
        {columnWidthsReady ? (
          <>
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
              controller={controller ?? undefined}
              disableDragAndDrop={disableDragAndDrop}
              visualSelectionSet={visualSelectionSet}
              useArchiveColumns={useArchiveColumns}
              trashAction={trashAction}
            />
          </>
        ) : (
          <>
            <StyledTableHead>{renderSkeletonHeader()}</StyledTableHead>
            <TableBody>{renderSkeletonRows()}</TableBody>
          </>
        )}
      </StyledTable>

      <TreeTableContextMenu
        contextMenuState={contextMenuState}
        onClose={handleContextMenuClose}
        treeId={treeId}
        controller={controller ?? undefined}
        buildSessionIndicator={buildSessionIndicator}
        ContextMenuComponent={ContextMenuComponent}
      />
    </StyledTableContainer>
  );
}
