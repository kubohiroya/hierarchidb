import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon, Recycling as RecyclingIcon } from '@mui/icons-material';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';
import { MapPreviewFloatingTable } from './MapPreviewFloatingTable.js';

export type LocationPreviewListProps = {
  title: string;
  tableId?: string | null;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
  pluginId?: string;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  recyclingState?: 'none' | 'off' | 'on' | 'partial';
  onToggleRecycling?: () => void;
  onClose?: () => void;
};

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:location:metadata';

const formatCellValue = (value: unknown) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const LocationPreviewList: React.FC<LocationPreviewListProps> = ({
  title,
  tableId,
  rows,
  columns,
  loading = false,
  loadingText = 'Loading metadata...',
  emptyText = 'No metadata available yet.',
  errorText,
  pluginId = 'location',
  selectedRows,
  onSelectionChange,
  recyclingState = 'none',
  onToggleRecycling,
  onClose,
}) => {
  const { windowState, handlers } = useFloatingWindow({
    persistKey: WINDOW_PERSIST_KEY,
    initialPosition: { x: 80, y: 140 },
    initialSize: { width: 560, height: 420 },
  });
  const { show } = handlers;

  useEffect(() => {
    show();
  }, [show]);

  const [searchValue, setSearchValue] = useState('');
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const resolvedColumns = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    const keys = new Set<string>();
    normalizedRows.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [columns, normalizedRows]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return normalizedRows;
    return normalizedRows.filter((row) => (
      resolvedColumns.some((column) => {
        const value = row[column];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    ));
  }, [normalizedRows, resolvedColumns, searchValue]);

  const resolvedTitle = useMemo(() => {
    const total = normalizedRows.length;
    if (!total) return title;
    const totalLabel = total.toLocaleString();
    const query = searchValue.trim();
    if (query) {
      const filteredLabel = filteredRows.length.toLocaleString();
      return `${title} (${filteredLabel}/${totalLabel} rows)`;
    }
    return `${title} (${totalLabel} rows)`;
  }, [filteredRows.length, normalizedRows.length, searchValue, title]);

  const gridColumns = useMemo<GridColumn<(typeof normalizedRows)[number]>[]>(() => (
    resolvedColumns.map((column) => ({
      id: column,
      label: column,
      width: column === 'metadata' ? 240 : 140,
      sortable: true,
      format: (value) => formatCellValue(value),
    }))
  ), [resolvedColumns]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {loadingText}
          </Typography>
        </Stack>
      );
    }
    if (errorText) {
      return (
        <Typography variant="body2" color="error.main">
          {errorText}
        </Typography>
      );
    }
    const hasRows = normalizedRows.length > 0;
    if (!tableId && !hasRows) {
      return (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      );
    }
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MapPreviewFloatingTable
          title={resolvedTitle}
          showTitle={false}
          rows={filteredRows as Array<{ id: string | number }>}
          columns={gridColumns}
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: 'Search',
            ariaLabel: 'Search metadata',
          }}
          selectable
          selectionMode="multiple"
          selectedRows={selectedRows}
          onSelectionChange={onSelectionChange}
          enableColumnSelector
          toolbarActions={onToggleRecycling ? (
            <IconButton
              aria-label="Toggle recycling"
              size="small"
              onClick={onToggleRecycling}
              disabled={recyclingState === 'none'}
            >
              <RecyclingIcon
                fontSize="small"
                color={recyclingState === 'on' ? 'success' : recyclingState === 'partial' ? 'warning' : 'inherit'}
              />
            </IconButton>
          ) : null}
          maxHeight="100%"
          containerSx={{
            position: 'static',
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            maxHeight: '100%',
            top: 'auto',
            right: 'auto',
            boxShadow: 'none',
          }}
        />
      </Box>
    );
  }, [emptyText, errorText, filteredRows, gridColumns, loading, loadingText, normalizedRows.length, onSelectionChange, onToggleRecycling, recyclingState, resolvedTitle, searchValue, selectedRows, tableId]);

  return (
    <FloatingWindow
      title={resolvedTitle}
      titleIcon={<PlaceIcon sx={{ fontSize: '1rem', ml: 1 }} />}
      initialState={windowState}
      onStateChange={handlers.onStateChange}
      onClose={onClose}
    >
      <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {content}
      </Box>
    </FloatingWindow>
  );
};
