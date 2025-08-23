import React from 'react';
import { Box, Paper, Typography, Alert } from '@mui/material';
import type { NodeId } from '@hierarchidb/00-core';
import type { DownloadTask, VectorTileTask } from '~/types';

interface MapPreviewProps {
  nodeId: NodeId;
  downloadTasks: DownloadTask[];
  vectorTileTasks: VectorTileTask[];
  hasStarted: boolean;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  nodeId, // Will be used for fetching tiles in production
  downloadTasks,
  vectorTileTasks,
  hasStarted,
}) => {
  // Mock map preview - in production would use MapLibre or similar
  // nodeId will be used to fetch vector tiles from the API
  return (
    <Paper sx={{ height: '100%', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Map Preview
      </Typography>
      
      {!hasStarted ? (
        <Alert severity="info">
          Map preview will be available once batch processing starts
        </Alert>
      ) : (
        <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.100', borderRadius: 1, p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Map visualization would appear here
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 2 }}>
            Downloaded: {downloadTasks.filter(t => t.stage === 'success').length} / {downloadTasks.length}
          </Typography>
          <Typography variant="caption" display="block">
            Vector tiles: {vectorTileTasks.filter(t => t.stage === 'success').length} / {vectorTileTasks.length}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};