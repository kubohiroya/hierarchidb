import React, { useMemo } from 'react';
import { Box, Paper, Typography, Alert, IconButton, Tooltip } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import { MapWithVectorTiles, type MapViewState } from '@hierarchidb/ui-map';
import type { NodeId } from '@hierarchidb/common-core';
import type { DownloadTask, VectorTileTask } from '~/types';

interface MapPreviewProps {
  nodeId: NodeId;
  downloadTasks: DownloadTask[];
  vectorTileTasks: VectorTileTask[];
  hasStarted: boolean;
  /** Optional initial viewport */
  initialViewport?: {
    center: [number, number];
    zoom: number;
  };
  /** Optional zxy string for map preview URL (zoom,lng,lat) */
  zxy?: string;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  nodeId,
  downloadTasks,
  vectorTileTasks,
  hasStarted,
  initialViewport,
  zxy,
}) => {
  // Default viewport (world view)
  const defaultViewport = {
    center: [0, 0] as [number, number],
    zoom: 2
  };

  const viewport = initialViewport || defaultViewport;
  
  // Convert to MapLibre view state
  const initialViewState = useMemo<MapViewState>(() => ({
    longitude: viewport.center[0],
    latitude: viewport.center[1],
    zoom: viewport.zoom,
  }), [viewport]);

  // Generate zxy string from viewport if not provided
  const zxyString = useMemo(() => {
    if (zxy) return zxy;
    return `${viewport.zoom},${viewport.center[0]},${viewport.center[1]}`;
  }, [zxy, viewport]);

  // Handle open in new window
  const handleOpenMap = () => {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.VITE_APP_PREFIX ? `/${import.meta.env.VITE_APP_PREFIX}/` : '/';
    const mapUrl = `${baseUrl}${basePath}map?zxy=${zxyString}`;
    window.open(mapUrl, '_blank');
  };

  const successfulDownloads = downloadTasks.filter(t => t.stage === 'success').length;
  const successfulVectorTiles = vectorTileTasks.filter(t => t.stage === 'success').length;

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Map Preview
        </Typography>
        {hasStarted && (
          <Tooltip title="Open map in new window">
            <IconButton onClick={handleOpenMap} size="small">
              <OpenInNew />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      <Box sx={{ flex: 1, position: 'relative' }}>
        {!hasStarted ? (
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Alert severity="info">
              Map preview will be available once batch processing starts
            </Alert>
          </Box>
        ) : (
          <>
            {/* Map Component */}
            <MapWithVectorTiles
              initialViewState={initialViewState}
              nodeId={nodeId}
              width="100%"
              height="100%"
              dbName="shape-tiles"
              layerOptions={{
                layerId: 'shape-plugin-layer',
                sourceId: 'shape-plugin-source',
                paint: {
                  'fill-color': 'rgba(0, 136, 136, 0.7)',
                  'fill-outline-color': '#004444',
                },
                layerType: 'fill'
              }}
              mapOptions={{
                interactive: true,
                scrollZoom: true,
                dragPan: true,
                dragRotate: true,
                doubleClickZoom: true,
                touchZoomRotate: true,
              }}
            />
            
            {/* Progress Overlay */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                p: 1.5,
                borderRadius: 1,
                boxShadow: 2,
                minWidth: 200,
              }}
            >
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Processing Progress
              </Typography>
              <Typography variant="caption" display="block">
                Downloaded: {successfulDownloads} / {downloadTasks.length}
              </Typography>
              <Typography variant="caption" display="block">
                Vector tiles: {successfulVectorTiles} / {vectorTileTasks.length}
              </Typography>
            </Box>
            
            {/* Click to open indicator */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                boxShadow: 1,
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {zxyString}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
};