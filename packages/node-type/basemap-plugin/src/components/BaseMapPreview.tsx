/**
 * @file BaseMapPreview.tsx
 * @description BaseMap preview component for base-dialog and panel views
 * Shows a live preview of the configured basemap settings
 */

import React, { useMemo } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { DarkMode, LightMode, Map as MapIcon, Satellite, Terrain, Tune } from '@mui/icons-material';
import { type MapLibreLayer, MapLibreMap, type MapLibreStyle, type MapViewState } from '@hierarchidb/ui-map';
import { CrossViewSnackbar } from '@hierarchidb/ui-core';
import { getBuiltInStyleUrl, getStyleAttribution } from '../constants/builtInStyles';

export interface BaseMapPreviewProps {
  /** Map style configuration */
  mapStyle: {
    style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
    customStyleUrl?: string;
    customStyleConfig?: Record<string, any>;
  };
  /** Viewport configuration */
  viewport: {
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  };
  /** Optional zxy string for map preview URL (zoom,lng,lat) */
  zxy?: string;
  /** Display options */
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
    attribution?: string;
    tags?: string[];
  };
  /** Preview size */
  width?: string | number;
  height?: string | number;
  /** Show metadata overlay */
  showMetadata?: boolean;
  /** Interactive preview */
  interactive?: boolean;
  /** Title for the preview */
  title?: string;
  /** Optional datasetId for cross-view highlight channel */
  datasetId?: string;
}

/**
 * Icon mapping for map styles
 */
const STYLE_ICONS: Record<string, React.ReactElement> = {
  streets: <MapIcon />,
  satellite: <Satellite />,
  terrain: <Terrain />,
  dark: <DarkMode />,
  light: <LightMode />,
  custom: <Tune />,
};

/**
 * BaseMap Preview Component
 * Provides a preview of the basemap configuration
 */
export const BaseMapPreview: React.FC<BaseMapPreviewProps> = ({
                                                                mapStyle,
                                                                viewport,
                                                                zxy,
                                                                displayOptions = {},
                                                                width = '100%',
                                                                height = 300,
                                                                showMetadata = true,
                                                                interactive = false,
                                                                title = 'BaseMap Preview',
                                                                datasetId,
                                                              }) => {
  // Convert to MapLibre view state
  const initialViewState = useMemo<MapViewState>(
    () => ({
      longitude: viewport.center[0],
      latitude: viewport.center[1],
      zoom: viewport.zoom,
      bearing: viewport.bearing || 0,
      pitch: viewport.pitch || 0,
    }),
    [viewport],
  );

  // Generate zxy string from viewport if not provided
  const zxyString = useMemo(() => {
    if (zxy) return zxy;
    return `${viewport.zoom},${viewport.center[0]},${viewport.center[1]}`;
  }, [zxy, viewport]);

  // Handle map click to open preview
  const handleMapClick = () => {
    if (!interactive) {
      const baseUrl = window.location.origin;
      const basePath = import.meta.env.VITE_APP_PREFIX
        ? `/${import.meta.env.VITE_APP_PREFIX}/`
        : '/';
      const mapUrl = `${baseUrl}${basePath}map?zxy=${zxyString}`;
      window.open(mapUrl, '_blank');
    }
  };

  // Get map style URL
  const mapStyleUrl = useMemo(() => {
    if (mapStyle.style === 'custom') {
      if (mapStyle.customStyleUrl) {
        return mapStyle.customStyleUrl;
      }
      if (mapStyle.customStyleConfig) {
        return mapStyle.customStyleConfig as MapLibreStyle;
      }
    }
    return getBuiltInStyleUrl(mapStyle.style);
  }, [mapStyle]);

  // Get attribution
  const attribution = useMemo(() => {
    if (displayOptions.attribution) {
      return displayOptions.attribution;
    }
    if (mapStyle.style !== 'custom') {
      return getStyleAttribution(mapStyle.style);
    }
    return '© Map contributors';
  }, [mapStyle, displayOptions.attribution]);

  return (
    <Paper
      elevation={1}
      sx={{
        width,
        overflow: 'hidden',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      {/* Header */}
      {showMetadata && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {STYLE_ICONS[mapStyle.style]}
            <Typography variant="subtitle1" fontWeight="medium">
              {title}
            </Typography>
            <Chip label={mapStyle.style} size="small" variant="outlined" color="primary" />
          </Stack>
        </Box>
      )}

      {/* Map Preview */}
      <Box
        sx={{
          position: 'relative',
          height,
          cursor: !interactive ? 'pointer' : 'grab',
        }}
        onClick={handleMapClick}
        title={!interactive ? `Click to open map at ${zxyString}` : undefined}
      >
        <MapLibreMap
          initialViewState={initialViewState}
          mapStyle={mapStyleUrl}
          width="100%"
          height="100%"
          mapOptions={{
            interactive,
            scrollZoom: interactive,
            dragPan: interactive,
            dragRotate: interactive,
            doubleClickZoom: interactive,
            touchZoomRotate: interactive,
          }}
          onLoad={(map) => {
            // Apply display options
            if (!displayOptions.showLabels) {
              // Hide all label layers
              const layers = map.getStyle().layers;
              layers.forEach((layer: MapLibreLayer) => {
                if (layer.type === 'symbol' && layer.id.includes('label')) {
                  map.setLayoutProperty(layer.id, 'visibility', 'none');
                }
              });
            }

            // Add 3D buildings if requested and available
            if (displayOptions.show3dBuildings) {
              // Check if the style supports 3D buildings
              if (!map.getLayer('building-3d')) {
                // Add a simple 3D building layer if not present
                const layers = map.getStyle().layers;
                const labelLayerId = layers.find((layer: MapLibreLayer) => {
                  if (layer.type !== 'symbol') return false;
                  const layout = layer.layout as Record<string, unknown> | undefined;
                  return typeof layout?.['text-field'] !== 'undefined';
                })?.id;

                if (map.getSource('openmaptiles') || map.getSource('composite')) {
                  map.addLayer(
                    {
                      id: 'building-3d',
                      source: map.getSource('openmaptiles') ? 'openmaptiles' : 'composite',
                      'source-layer': 'building',
                      type: 'fill-extrusion',
                      minzoom: 15,
                      paint: {
                        'fill-extrusion-color': '#aaa',
                        'fill-extrusion-height': [
                          'interpolate',
                          ['linear'],
                          ['zoom'],
                          15,
                          0,
                          15.05,
                          ['get', 'height'],
                        ],
                        'fill-extrusion-base': [
                          'interpolate',
                          ['linear'],
                          ['zoom'],
                          15,
                          0,
                          15.05,
                          ['get', 'min_height'],
                        ],
                        'fill-extrusion-opacity': 0.6,
                      },
                    },
                    labelLayerId,
                  );
                }
              }
            }
          }}
        />

        {/* Overlay Information */}
        {showMetadata && (
          <>
            {/* Coordinates */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                boxShadow: 1,
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {viewport.center[0].toFixed(4)}, {viewport.center[1].toFixed(4)} | z
                {viewport.zoom.toFixed(1)}
              </Typography>
            </Box>

            {/* Display Options */}
            {(displayOptions.show3dBuildings ||
              displayOptions.showTerrain ||
              displayOptions.showTraffic ||
              displayOptions.showTransit) && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  boxShadow: 1,
                }}
              >
                <Stack direction="row" spacing={0.5}>
                  {displayOptions.show3dBuildings && (
                    <Chip label="3D" size="small" variant="filled" color="primary" />
                  )}
                  {displayOptions.showTerrain && (
                    <Chip label="Terrain" size="small" variant="filled" color="primary" />
                  )}
                  {displayOptions.showTraffic && (
                    <Chip label="Traffic" size="small" variant="filled" color="primary" />
                  )}
                  {displayOptions.showTransit && (
                    <Chip label="Transit" size="small" variant="filled" color="primary" />
                  )}
                </Stack>
              </Box>
            )}

            {/* Tags */}
            {displayOptions.tags && displayOptions.tags.length > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  maxWidth: '60%',
                }}
              >
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {displayOptions.tags.slice(0, 3).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.7rem',
                      }}
                    />
                  ))}
                  {displayOptions.tags.length > 3 && (
                    <Chip
                      label={`+${displayOptions.tags.length - 3}`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.7rem',
                      }}
                    />
                  )}
                </Stack>
              </Box>
            )}

            {/* Attribution */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                px: 1,
                py: 0.25,
                fontSize: '10px',
                maxWidth: '40%',
                textAlign: 'right',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '10px' }}>
                {attribution}
              </Typography>
            </Box>
            {/* Cross-view snackbar when a dataset is specified */}
            {datasetId && (
              <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <CrossViewSnackbar datasetId={datasetId} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default BaseMapPreview;
