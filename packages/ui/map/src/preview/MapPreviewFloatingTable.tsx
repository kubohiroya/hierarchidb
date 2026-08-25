import {
  type GridCellEditCommitResult,
  type GridCellEditParams,
  type GridColumn,
  type GridGroupingState,
  type GridSortingState,
  TanstackDataGrid,
} from '@hierarchidb/ui-grid';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { type FeatureTableSearchConfig, FeatureTableToolbar } from './FeatureTableToolbar.js';
import {
  buildFeatureCellEditRequest,
  type FeatureTableEditConfig,
  findFeatureTableEditableColumn,
} from './featureTableEditContract.js';
import { useMapPreviewFloatingTable } from './useMapPreviewFloatingTable.js';
import { useMapPreviewFloatingTableView } from './useMapPreviewFloatingTableView.js';

export type MapPreviewErrorSummary = {
  count: number;
  messages: string[];
  errorCount?: number;
  repairCount?: number;
};

export type MapPreviewErrorSummaryById = Map<string, MapPreviewErrorSummary>;

export type MapPreviewErrorColumnLabels = {
  status: string;
  errorCount: string;
  errorMessage: string;
};

export type MapPreviewStatusLabels = {
  completed: string;
  failed: string;
};

export type MapPreviewSearchConfig = FeatureTableSearchConfig;

export type MapPreviewFloatingTableProps<Row extends { id: string | number }> = {
  title: string;
  showTitle?: boolean;
  enableColumnSelector?: boolean;
  rows: Row[];
  columns: GridColumn<Row>[];
  persistKeyBase?: string;
  defaultGrouping?: GridGroupingState;
  grouping?: GridGroupingState;
  defaultSorting?: GridSortingState;
  search?: FeatureTableSearchConfig;
  countText?: string;
  loading?: boolean;
  error?: string;
  matchedRows?: Set<string>;
  selectable?: boolean;
  selectionMode?: 'single' | 'multiple';
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  rowSx?: (state: {
    selected: boolean;
    matched: boolean;
    hovered: boolean;
  }) => Record<string, unknown> | undefined;
  maxHeight?: number | string;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  formatErrorMessage?: (summary: MapPreviewErrorSummary) => string;
  statusAdornment?: (row: Row) => React.ReactNode;
  toolbarActions?: React.ReactNode;
  onCellClick?: (params: { row: Row; columnId: string }) => void;
  featureTableEdit?: FeatureTableEditConfig<Row>;
  containerSx?: Record<string, unknown>;
  rowFilterConfig?: {
    mode: 'all' | 'viewport';
    onModeChange: (mode: 'all' | 'viewport') => void;
    searchOnly: boolean;
    onSearchOnlyChange: (value: boolean) => void;
    labels?: {
      title?: string;
      allRows?: string;
      viewportRows?: string;
      searchOnly?: string;
    };
  };
};

export const buildErrorSummaryById = <TError,>(
  errors: TError[],
  options: {
    getId: (row: TError) => string | undefined | null;
    getMessage?: (row: TError) => string | undefined | null;
    getKind?: (row: TError) => 'error' | 'repair';
  }
): MapPreviewErrorSummaryById => {
  const summary = new Map<string, MapPreviewErrorSummary>();
  errors.forEach((row) => {
    const id = options.getId(row);
    if (!id) return;
    const key = String(id);
    const entry = summary.get(key) ?? {
      count: 0,
      messages: [],
      errorCount: 0,
      repairCount: 0,
    };
    const kind = options.getKind?.(row) ?? 'error';
    if (kind === 'repair') {
      entry.repairCount = (entry.repairCount ?? 0) + 1;
    } else {
      entry.errorCount = (entry.errorCount ?? 0) + 1;
    }
    entry.count = (entry.errorCount ?? 0) + (entry.repairCount ?? 0);
    const message = options.getMessage?.(row);
    if (message && !entry.messages.includes(message)) {
      entry.messages.push(message);
    }
    summary.set(key, entry);
  });
  return summary;
};

export const MapPreviewFloatingTable = <Row extends { id: string | number }>(
  props: MapPreviewFloatingTableProps<Row>
) => {
  const {
    title,
    showTitle = true,
    enableColumnSelector = true,
    rows,
    columns,
    persistKeyBase,
    defaultGrouping = [],
    grouping,
    defaultSorting = [],
    search,
    countText,
    loading,
    error,
    matchedRows,
    selectable,
    selectionMode,
    selectedRows,
    onSelectionChange,
    rowSx,
    maxHeight,
    emptyContent,
    errorSummaryById,
    errorColumnLabels,
    statusLabels,
    formatErrorMessage,
    statusAdornment,
    toolbarActions,
    onCellClick,
    featureTableEdit,
    containerSx,
    rowFilterConfig,
  } = props;
  const { resolvedStatusLabels, resolvedErrorLabels, resolvedFormatMessage } =
    useMapPreviewFloatingTable({
      statusLabels,
      errorColumnLabels,
      formatErrorMessage,
    });
  let resolvedColumns = columns;
  if (resolvedErrorLabels && errorSummaryById) {
    const statusColumn: GridColumn<Row> = {
      id: 'status',
      label: resolvedErrorLabels.status,
      width: 140,
      sortable: true,
      format: (_value, row) => {
        const summary = errorSummaryById.get(String(row.id));
        const hasErrors = Boolean(summary && summary.count > 0);
        const adornment = statusAdornment?.(row);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              size="small"
              color={hasErrors ? 'error' : 'success'}
              label={hasErrors ? resolvedStatusLabels.failed : resolvedStatusLabels.completed}
            />
            {adornment}
          </Box>
        );
      },
    };
    const errorCountColumn: GridColumn<Row> = {
      id: 'errorCount',
      label: resolvedErrorLabels.errorCount,
      width: 120,
      align: 'right',
      sortable: true,
      format: (_value, row) => errorSummaryById.get(String(row.id))?.count ?? 0,
    };
    const errorMessageColumn: GridColumn<Row> = {
      id: 'errorMessage',
      label: resolvedErrorLabels.errorMessage,
      width: 240,
      sortable: true,
      format: (_value, row) => {
        const summary = errorSummaryById.get(String(row.id));
        if (!summary) return '';
        return resolvedFormatMessage(summary);
      },
    };
    resolvedColumns = [statusColumn, ...columns, errorCountColumn, errorMessageColumn];
  }

  const editableColumnById = useMemo(() => {
    const entries =
      featureTableEdit?.editableColumns.map((column) => [column.columnId, column] as const) ?? [];
    return new Map(entries);
  }, [featureTableEdit?.editableColumns]);

  const gridColumns = useMemo(
    () =>
      resolvedColumns.map((column) => {
        const id = String(column.id);
        if (!featureTableEdit || !editableColumnById.has(id)) {
          return column;
        }
        return {
          ...column,
          editable: true,
        };
      }),
    [editableColumnById, featureTableEdit, resolvedColumns]
  );

  const handleFeatureCellEdit = useCallback(
    async (params: GridCellEditParams<Row>): Promise<void | GridCellEditCommitResult> => {
      if (!featureTableEdit) {
        return {
          ok: false,
          error: 'Feature table edit config is required for editable cell commits.',
        };
      }
      const editableColumn = findFeatureTableEditableColumn(
        featureTableEdit.editableColumns,
        params.columnId
      );
      if (!editableColumn) {
        return {
          ok: false,
          error: `Column "${params.columnId}" does not define a feature source mapping.`,
        };
      }
      const request = buildFeatureCellEditRequest(
        params,
        featureTableEdit.editOrigin,
        editableColumn
      );
      return featureTableEdit.onCellEditRequest(request);
    },
    [featureTableEdit]
  );

  const {
    columnSelectorOpen,
    columnVisibility,
    setColumnVisibility,
    columnSizing,
    setColumnSizing,
    sorting,
    setSorting,
    setGroupingState,
    isGroupingControlled,
    resolvedGrouping,
    handleOpenColumnSelector,
    handleCloseColumnSelector,
    handleColumnVisibilityToggle,
  } = useMapPreviewFloatingTableView({
    resolvedColumns: gridColumns,
    persistKeyBase,
    defaultGrouping,
    grouping,
    defaultSorting,
  });

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: { xs: 'calc(100% - 24px)', md: 560 },
        maxWidth: 'calc(100% - 24px)',
        maxHeight: { xs: '55%', md: '70%' },
        height: { xs: '55%', md: '70%' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 2,
        ...(containerSx ?? {}),
      }}
    >
      <FeatureTableToolbar
        title={title}
        showTitle={showTitle}
        search={search}
        toolbarActions={toolbarActions}
        enableColumnSelector={enableColumnSelector}
        onOpenColumnSelector={enableColumnSelector ? handleOpenColumnSelector : undefined}
        countText={countText}
      />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 && emptyContent ? (
          emptyContent
        ) : (
          <TanstackDataGrid
            columns={gridColumns}
            rows={rows}
            maxHeight={maxHeight ?? '100%'}
            enableVirtualization
            loading={loading}
            error={error ?? undefined}
            matchedRows={matchedRows}
            selectable={selectable}
            selectionMode={selectionMode}
            selectedRows={selectedRows}
            onSelectionChange={onSelectionChange}
            onCellClick={onCellClick}
            onCellEdit={featureTableEdit ? handleFeatureCellEdit : undefined}
            sorting={sorting}
            onSortingChange={setSorting}
            grouping={resolvedGrouping}
            onGroupingChange={isGroupingControlled ? undefined : setGroupingState}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            rowSx={rowSx}
          />
        )}
      </Box>
      <Dialog
        open={columnSelectorOpen}
        onClose={handleCloseColumnSelector}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: (theme) => theme.zIndex.modal + 20 }}
      >
        <DialogTitle>Column/Row Config</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Columns
          </Typography>
          <FormGroup>
            {gridColumns.map((column) => {
              const id = String(column.id);
              const isVisible = columnVisibility[id] !== false;
              return (
                <FormControlLabel
                  key={id}
                  control={
                    <Checkbox
                      checked={isVisible}
                      onChange={(event) => {
                        handleColumnVisibilityToggle(id, event.target.checked);
                      }}
                    />
                  }
                  label={column.label}
                />
              );
            })}
          </FormGroup>
          {rowFilterConfig ? (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2">{rowFilterConfig.labels?.title ?? 'Rows'}</Typography>
              <FormControl component="fieldset" sx={{ mt: 1 }}>
                <RadioGroup
                  value={rowFilterConfig.mode}
                  onChange={(event) =>
                    rowFilterConfig.onModeChange(event.target.value as 'all' | 'viewport')
                  }
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={rowFilterConfig.labels?.allRows ?? 'Show all locations in this node'}
                  />
                  <FormControlLabel
                    value="viewport"
                    control={<Radio />}
                    label={
                      rowFilterConfig.labels?.viewportRows ??
                      'Show locations in the current viewport'
                    }
                  />
                </RadioGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rowFilterConfig.searchOnly}
                      onChange={(event) => rowFilterConfig.onSearchOnlyChange(event.target.checked)}
                    />
                  }
                  label={
                    rowFilterConfig.labels?.searchOnly ??
                    'Show only locations matching the search field'
                  }
                />
              </FormControl>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseColumnSelector}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
