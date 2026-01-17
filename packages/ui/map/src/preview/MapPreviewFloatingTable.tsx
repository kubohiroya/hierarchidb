import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, MoreVert as MoreVertIcon, Search as SearchIcon } from '@mui/icons-material';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-grid';

export type MapPreviewErrorSummary = {
  count: number;
  messages: string[];
};

export type MapPreviewErrorSummaryById = Map<string, MapPreviewErrorSummary>;

export type MapPreviewSearchConfig = {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
};

export type MapPreviewErrorColumnLabels = {
  status: string;
  errorCount: string;
  errorMessage: string;
};

export type MapPreviewStatusLabels = {
  completed: string;
  failed: string;
};

export type MapPreviewFloatingTableProps<Row extends { id: string | number }> = {
  title: string;
  showTitle?: boolean;
  enableColumnSelector?: boolean;
  rows: Row[];
  columns: GridColumn<Row>[];
  search?: MapPreviewSearchConfig;
  countText?: string;
  loading?: boolean;
  error?: string;
  matchedRows?: Set<string>;
  selectable?: boolean;
  selectionMode?: 'single' | 'multiple';
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  rowSx?: (state: { selected: boolean; matched: boolean; hovered: boolean }) => Record<string, unknown> | undefined;
  tableContainerSx?: Record<string, unknown>;
  maxHeight?: number;
  toolbarComponent?: React.ReactNode;
  emptyContent?: React.ReactNode;
  errorSummaryById?: MapPreviewErrorSummaryById;
  errorColumnLabels?: MapPreviewErrorColumnLabels;
  statusLabels?: MapPreviewStatusLabels;
  formatErrorMessage?: (summary: MapPreviewErrorSummary) => string;
  containerSx?: Record<string, unknown>;
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
    search,
    countText,
    loading,
    error,
    matchedRows,
    selectable,
    selectionMode,
    selectedRows,
    onSelectionChange,
    sortColumn,
    sortDirection,
    onSort,
    rowSx,
    tableContainerSx,
    toolbarComponent,
    emptyContent,
    errorSummaryById,
    errorColumnLabels,
    statusLabels,
    formatErrorMessage,
    containerSx,
  } = props;
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string> | null>(null);
  const [hasUserColumnSelection, setHasUserColumnSelection] = useState(false);
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
        return (
          <Chip
            size="small"
            color={hasErrors ? 'error' : 'success'}
            label={hasErrors ? resolvedStatusLabels.failed : resolvedStatusLabels.completed}
          />
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
  }, [
    columns,
    errorSummaryById,
    resolvedErrorLabels,
    resolvedFormatMessage,
    resolvedStatusLabels.completed,
    resolvedStatusLabels.failed,
  ]);
  const resolvedColumnIds = useMemo(
    () => resolvedColumns.map((column) => String(column.id)),
    [resolvedColumns],
  );
  useEffect(() => {
    setVisibleColumnIds((prev) => {
      if (!hasUserColumnSelection || !prev) {
        return new Set(resolvedColumnIds);
      }
      const next = new Set(prev);
      const resolvedSet = new Set(resolvedColumnIds);
      Array.from(next).forEach((id) => {
        if (!resolvedSet.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [hasUserColumnSelection, resolvedColumnIds]);
  const filteredColumns = useMemo(() => {
    if (!visibleColumnIds) return resolvedColumns;
    return resolvedColumns.filter((column) => visibleColumnIds.has(String(column.id)));
  }, [resolvedColumns, visibleColumnIds]);

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
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {showTitle ? <Typography variant="subtitle2">{title}</Typography> : null}
        {search ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  search.onCommit?.();
                }
              }}
              placeholder={search.placeholder}
              inputProps={{ 'aria-label': search.ariaLabel }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 999,
                  paddingLeft: 0,
                },
                '& .MuiOutlinedInput-input': {
                  paddingLeft: 0,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" sx={{ ml: 2 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear search"
                      size="small"
                      onClick={() => search.onChange('')}
                      disabled={!search.value.trim()}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {enableColumnSelector ? (
              <IconButton
                aria-label="Select columns"
                size="small"
                onClick={() => setColumnSelectorOpen(true)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        ) : null}
        {countText ? (
          <Typography variant="body2" color="text.secondary">
            {countText}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 && emptyContent ? (
          emptyContent
        ) : (
          <GenericDataGrid
            columns={filteredColumns}
            rows={rows}
            maxHeight="100%"
            tableContainerSx={{
              height: '100%',
              overflowY: 'auto',
              overflowX: 'auto',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              minHeight: 0,
              flex: 1,
              ...(tableContainerSx ?? {}),
            }}
            rowHeight={38}
            stickyHeader
            dense
            hover
            striped
            enableVirtualization
            loading={loading}
            error={error ?? undefined}
            matchedRows={matchedRows}
            selectable={selectable}
            selectionMode={selectionMode}
            selectedRows={selectedRows}
            onSelectionChange={onSelectionChange}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
            rowSx={rowSx}
            toolbarComponent={toolbarComponent}
            showSearch={false}
            stopWheelPropagation
          />
        )}
      </Box>
      <Dialog
        open={columnSelectorOpen}
        onClose={() => setColumnSelectorOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Columns</DialogTitle>
        <DialogContent dividers>
          <FormGroup>
            {resolvedColumns.map((column) => {
              const id = String(column.id);
              return (
                <FormControlLabel
                  key={id}
                  control={(
                    <Checkbox
                      checked={visibleColumnIds?.has(id) ?? true}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setHasUserColumnSelection(true);
                        setVisibleColumnIds((prev) => {
                          const next = new Set(prev ?? resolvedColumnIds);
                          if (checked) {
                            next.add(id);
                          } else {
                            next.delete(id);
                          }
                          return next;
                        });
                      }}
                    />
                  )}
                  label={column.label}
                />
              );
            })}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnSelectorOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
