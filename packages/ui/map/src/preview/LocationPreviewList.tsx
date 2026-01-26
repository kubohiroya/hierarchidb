import React, { useEffect, useMemo } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { DataGridPreview } from '@hierarchidb/ui-grid';
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';

export type LocationPreviewListProps = {
  title: string;
  tableId?: string | null;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  pluginId?: string;
  onClose?: () => void;
};

const WINDOW_PERSIST_KEY = 'hierarchidb:ui:floating-window:location:metadata';

export const LocationPreviewList: React.FC<LocationPreviewListProps> = ({
  title,
  tableId,
  loading = false,
  loadingText = 'Loading metadata...',
  emptyText = 'No metadata available yet.',
  pluginId = 'location',
  onClose,
}) => {
  const { windowState, handlers } = useFloatingWindow({
    persistKey: WINDOW_PERSIST_KEY,
    initialPosition: { x: 80, y: 140 },
    initialSize: { width: 560, height: 420 },
  });

  useEffect(() => {
    handlers.show();
  }, [handlers.show]);

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
    if (!tableId) {
      return (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      );
    }
    return (
      <Box sx={{ height: '100%', minHeight: 0 }}>
        <DataGridPreview pluginId={pluginId} tableId={tableId} />
      </Box>
    );
  }, [emptyText, loading, loadingText, pluginId, tableId]);

  return (
    <FloatingWindow
      title={title}
      initialState={windowState}
      onStateChange={handlers.onStateChange}
      onClose={onClose}
    >
      <Box sx={{ height: '100%', minHeight: 0 }}>
        {content}
      </Box>
    </FloatingWindow>
  );
};
