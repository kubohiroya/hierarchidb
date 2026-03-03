import type React from 'react';
import { useMemo } from 'react';
import { Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon, Recycling as RecyclingIcon } from '@mui/icons-material';
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import { JsonTreeView } from '@hierarchidb/ui-json-treeview';
import { MapPreviewFloatingTable } from './MapPreviewFloatingTable.js';
import { useLocationPreviewListView } from './useLocationPreviewListView.js';

export type LocationPreviewListProps = {
  title: string;
  tableId?: string | null;
  rows?: Array<Record<string, unknown>>;
  columns?: string[];
  columnFormatters?: Record<string, (value: unknown, row: Record<string, unknown>) => React.ReactNode>;
  toolbarActions?: React.ReactNode;
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
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
  pluginId?: string;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  recyclingState?: 'none' | 'off' | 'on' | 'partial';
  onToggleRecycling?: () => void;
  onClose?: () => void;
};

export const LocationPreviewList: React.FC<LocationPreviewListProps> = ({
  title,
  tableId,
  rows,
  columns,
  columnFormatters,
  toolbarActions,
  rowFilterConfig,
  loading = false,
  loadingText = 'Loading metadata...',
  emptyText = 'No metadata available yet.',
  errorText,
  selectedRows,
  onSelectionChange,
  recyclingState = 'none',
  onToggleRecycling,
  onClose,
}) => {
  const {
    windowState,
    handlers,
    searchValue,
    setSearchValue,
    jsonDialogOpen,
    jsonDialogValue,
    jsonDialogTitle,
    closeJsonDialog,
    normalizedRows,
    filteredRows,
    resolvedTitle,
    gridColumns,
    handleCellClick,
  } = useLocationPreviewListView({
    title,
    rows,
    columns,
    columnFormatters,
    rowFilterConfig,
  });

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
          maxHeight="100%"
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
          onCellClick={handleCellClick}
          enableColumnSelector
          rowFilterConfig={rowFilterConfig}
          toolbarActions={onToggleRecycling || toolbarActions ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {onToggleRecycling ? (
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
              {toolbarActions}
            </Box>
          ) : null}
          containerSx={{
            position: 'static',
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            maxHeight: '100%',
            flex: 1,
            minHeight: 0,
            top: 'auto',
            right: 'auto',
            boxShadow: 'none',
          }}
        />
      </Box>
    );
  }, [emptyText, errorText, filteredRows, gridColumns, handleCellClick, loading, loadingText, normalizedRows.length, onSelectionChange, onToggleRecycling, recyclingState, resolvedTitle, rowFilterConfig, searchValue, selectedRows, tableId, toolbarActions]);

  return (
    <FloatingWindow
      title={resolvedTitle}
      titleIcon={<PlaceIcon sx={{ fontSize: '1rem', ml: 1 }} />}
      initialState={windowState}
      onStateChange={handlers.onStateChange}
      onClose={onClose}
    >
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {content}
      </Box>
      <Dialog
        open={jsonDialogOpen}
        onClose={closeJsonDialog}
        maxWidth="md"
        fullWidth
        sx={{ zIndex: (theme) => theme.zIndex.modal + 30 }}
      >
        <DialogTitle>{jsonDialogTitle}</DialogTitle>
        <DialogContent dividers>
          <JsonTreeView data={jsonDialogValue} defaultExpandedDepth={2} maxHeight={420} />
        </DialogContent>
      </Dialog>
    </FloatingWindow>
  );
};
