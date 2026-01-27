import React, { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { Place as PlaceIcon } from '@mui/icons-material';
import { DataGridPreview } from '@hierarchidb/ui-grid';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';

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
  onClose?: () => void;
};

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:location:metadata';

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
  onClose,
}) => {
  const { windowState, handlers } = useFloatingWindow({
    persistKey: WINDOW_PERSIST_KEY,
    initialPosition: { x: 80, y: 140 },
    initialSize: { width: 560, height: 420 },
  });
  const { show } = handlers;

  useEffect(() => {
    if (!windowState.isVisible) {
      show();
    }
  }, [show, windowState.isVisible]);

  const [rowSummary, setRowSummary] = useState({ query: '', filtered: 0, total: 0 });

  useEffect(() => {
    const total = Array.isArray(rows) ? rows.length : 0;
    setRowSummary((prev) => {
      const query = prev.query.trim();
      return {
        query: prev.query,
        filtered: query ? prev.filtered : total,
        total,
      };
    });
  }, [rows]);

  const resolvedTitle = useMemo(() => {
    const total = rowSummary.total;
    if (!total) return title;
    const totalLabel = total.toLocaleString();
    const query = rowSummary.query.trim();
    if (query) {
      const filteredLabel = rowSummary.filtered.toLocaleString();
      return `${title} (${filteredLabel}/${totalLabel} rows)`;
    }
    return `${title} (${totalLabel} rows)`;
  }, [rowSummary.filtered, rowSummary.query, rowSummary.total, title]);

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
    const hasRows = Array.isArray(rows) && rows.length > 0;
    if (!tableId && !hasRows) {
      return (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      );
    }
    return (
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGridPreview
          pluginId={pluginId}
          tableId={tableId}
          rows={rows}
          columns={columns}
          height="100%"
          showTitle={false}
          showFilterControls={false}
          showFilterToggle={false}
          showRowCount={false}
          onRowSummaryChange={setRowSummary}
        />
      </Box>
    );
  }, [columns, emptyText, errorText, loading, loadingText, pluginId, rows, tableId]);

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
