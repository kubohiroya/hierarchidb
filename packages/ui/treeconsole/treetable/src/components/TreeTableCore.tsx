/**
 * TreeTableCore
 * Coordinates TreeTable controller atoms with presentational building blocks.
 */

import { NodeTypeIcon } from '@hierarchidb/components';
import { NodeContextMenu } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { Skeleton, TableBody, TableCell, TableRow } from '@mui/material';
import type { ReactElement } from 'react';
import type { TreeTableCoreProps } from '~/types';
import { useTreeTableCoreModel } from './hooks/useTreeTableCoreModel.js';
import { TreeTableContextMenu } from './internal/TreeTableContextMenu.js';
import { TreeTableHeader } from './internal/TreeTableHeader.js';
import { TreeTableRows } from './internal/TreeTableRows.js';
import { StyledTable, StyledTableContainer, StyledTableHead } from './TreeTableStyles.js';

export function TreeTableCore({
  controller,
  viewHeight,
  viewWidth: _viewWidth,
  useArchiveColumns = false,
  archiveAction = 'restore',
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
  sortMode,
  onSortModeChange,
}: TreeTableCoreProps): ReactElement {
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  const {
    table,
    structure,
    columns,
    columnWidths,
    columnWidthsReady,
    resizingColumn,
    selectAll,
    selectAllHydrated,
    visualSelectionSet,
    batchSelect,
    handleResizeStart,
    handleContainerRef,
    handleRowClick,
    handleRowDoubleClick,
    contextMenuState,
    handleContextMenuClose,
    hoverDropTargetId,
    setHoverDropTargetId,
    forbiddenTargets,
    setForbiddenTargets,
  } = useTreeTableCoreModel({
    controller,
    pageNodeId,
    treeId,
    selectAllPersistence,
    selectionIdPrefix,
    depthOffset,
    hideDragHandler,
    disableDragAndDrop,
    useArchiveColumns,
    archiveAction,
    rowClickAction,
    selectionMode,
    IconComponent,
    onRowClick,
    onRowDoubleClick,
    buildSessionIndicator,
    sortMode,
    onSortModeChange,
  });

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
              <Skeleton
                variant={isSelection ? 'rectangular' : 'text'}
                width={isSelection ? 16 : '80%'}
                height={isSelection ? 16 : undefined}
              />
            </TableCell>
          );
        })}
      </TableRow>
    ));

  return (
    <StyledTableContainer
      ref={handleContainerRef}
      sx={{ height: viewHeight || '100%', width: '100%' }}
    >
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
              archiveAction={archiveAction}
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
        collectDescendantIds={structure.collectDescendantIds}
        ContextMenuComponent={ContextMenuComponent}
      />
    </StyledTableContainer>
  );
}
