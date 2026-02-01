import type React from 'react';
import { FeatureTableToolbar, type FeatureTableSearchConfig } from './FeatureTableToolbar.js';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  TanstackDataGrid,
  type GridColumn,
  type GridColumnSizingState,
  type GridColumnVisibilityState,
  type GridGroupingState,
  type GridSortingState,
  buildGridStateKey,
  loadGridStateValue,
  saveGridStateValue,
} from '@hierarchidb/ui-grid';

export type MapPreviewErrorSummary = {
  count: number;
  messages: string[];
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
  rowSx?: (state: { selected: boolean; matched: boolean; hovered: boolean }) => Record<string, unknown> | undefined;
  maxHeight?: number;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  formatErrorMessage?: (summary: MapPreviewErrorSummary) => string;
  statusAdornment?: (row: Row) => React.ReactNode;
  toolbarActions?: React.ReactNode;
  onCellClick?: (params: { row: Row; columnId: string }) => void;
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
  },
): MapPreviewErrorSummaryById => {
  const summary = new Map<string, MapPreviewErrorSummary>();
  errors.forEach((row) => {
    const id = options.getId(row);
    if (!id) return;
    const key = String(id);
    const entry = summary.get(key) ?? { count: 0, messages: [] };
    entry.count += 1;
    const message = options.getMessage?.(row);
    if (message) {
      entry.messages.push(message);
    }
    summary.set(key, entry);
  });
  return summary;
};

export const MapPreviewFloatingTable = <Row extends { id: string | number }>(
  props: MapPreviewFloatingTableProps<Row>,
) => {
  const {
    title,
    showTitle = true,
    enableColumnSelector = true,
    rows,
    columns,
    persistKeyBase,
    defaultGrouping = [],
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
    containerSx,
    rowFilterConfig,
  } = props;
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const visibilityKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'visibility') : null;
  const columnSizingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'columnSizing') : null;
  const sortingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'sorting') : null;
  const groupingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'grouping') : null;
  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityState>(() => (
    visibilityKey ? (loadGridStateValue<GridColumnVisibilityState>(visibilityKey) ?? {}) : {}
  ));
  const [columnSizing, setColumnSizing] = useState<GridColumnSizingState>(() => (
    columnSizingKey ? (loadGridStateValue<GridColumnSizingState>(columnSizingKey) ?? {}) : {}
  ));
  const [sorting, setSorting] = useState<GridSortingState>(() => {
    if (sortingKey) {
      const saved = loadGridStateValue<GridSortingState>(sortingKey);
      if (saved) return saved;
    }
    return defaultSorting;
  });
  const [grouping, setGrouping] = useState<GridGroupingState>(() => {
    if (groupingKey) {
      const saved = loadGridStateValue<GridGroupingState>(groupingKey);
      if (saved) return saved;
    }
    return defaultGrouping;
  });
  const resolvedStatusLabels: MapPreviewStatusLabels = statusLabels ?? {
    completed: 'Completed',
    failed: 'Failed',
  };
  const resolvedErrorLabels: MapPreviewErrorColumnLabels | null = errorColumnLabels ?? null;
  const resolvedFormatMessage = useMemo(()=>formatErrorMessage ?? ((summary:{messages:string[]}) => summary.messages.slice(0, 2).join(' / ')),
    [formatErrorMessage]);
  const resolvedColumns = useMemo(() => {
    if (!resolvedErrorLabels || !errorSummaryById) return columns;
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
    return [statusColumn, ...columns, errorCountColumn, errorMessageColumn];
  }, [columns, errorSummaryById, resolvedErrorLabels, resolvedFormatMessage, resolvedStatusLabels.completed, resolvedStatusLabels.failed, statusAdornment]);
  const resolvedColumnIds = useMemo(
    () => resolvedColumns.map((column) => String(column.id)),
    [resolvedColumns],
  );
  const prevColumnIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevColumnIdsRef.current;
    const isSame =
      prevIds.length === resolvedColumnIds.length &&
      prevIds.every((id, idx) => id === resolvedColumnIds[idx]);
    if (isSame) return;
    prevColumnIdsRef.current = resolvedColumnIds;
    setColumnVisibility((prev: GridColumnVisibilityState) => {
      const next = { ...prev };
      let changed = false;
      const resolvedSet = new Set(resolvedColumnIds);
      resolvedColumnIds.forEach((id) => {
        if (!(id in next)) {
          next[id] = true;
          changed = true;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!resolvedSet.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [resolvedColumnIds]);

  useEffect(() => {
    if (!visibilityKey) return;
    saveGridStateValue(visibilityKey, columnVisibility);
  }, [columnVisibility, visibilityKey]);

  useEffect(() => {
    if (!columnSizingKey) return;
    saveGridStateValue(columnSizingKey, columnSizing);
  }, [columnSizing, columnSizingKey]);

  useEffect(() => {
    if (!sortingKey) return;
    saveGridStateValue(sortingKey, sorting);
  }, [sorting, sortingKey]);

  useEffect(() => {
    if (!groupingKey) return;
    saveGridStateValue(groupingKey, grouping);
  }, [grouping, groupingKey]);

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
        onOpenColumnSelector={enableColumnSelector ? () => setColumnSelectorOpen(true) : undefined}
        countText={countText}
      />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 && emptyContent ? (
          emptyContent
        ) : (
          <TanstackDataGrid
            columns={resolvedColumns}
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
            sorting={sorting}
            onSortingChange={setSorting}
            grouping={grouping}
            onGroupingChange={setGrouping}
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
        onClose={() => setColumnSelectorOpen(false)}
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
            {resolvedColumns.map((column) => {
              const id = String(column.id);
              const isVisible = columnVisibility[id] !== false;
              return (
                <FormControlLabel
                  key={id}
                  control={(
                    <Checkbox
                      checked={isVisible}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setColumnVisibility((prev: GridColumnVisibilityState) => ({
                          ...prev,
                          [id]: checked,
                        }));
                      }}
                    />
                  )}
                  label={column.label}
                />
              );
            })}
          </FormGroup>
          {rowFilterConfig ? (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2">
                {rowFilterConfig.labels?.title ?? 'Rows'}
              </Typography>
              <FormControl component="fieldset" sx={{ mt: 1 }}>
                <RadioGroup
                  value={rowFilterConfig.mode}
                  onChange={(event) => rowFilterConfig.onModeChange(event.target.value as 'all' | 'viewport')}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label={rowFilterConfig.labels?.allRows ?? 'Show all locations in this node'}
                  />
                  <FormControlLabel
                    value="viewport"
                    control={<Radio />}
                    label={rowFilterConfig.labels?.viewportRows ?? 'Show locations in the current viewport'}
                  />
                </RadioGroup>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={rowFilterConfig.searchOnly}
                      onChange={(event) => rowFilterConfig.onSearchOnlyChange(event.target.checked)}
                    />
                  )}
                  label={rowFilterConfig.labels?.searchOnly ?? 'Show only locations matching the search field'}
                />
              </FormControl>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnSelectorOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
