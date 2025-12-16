/**
 * @file BaseMapPreview.tsx
 * @description BaseMap preview component for base-dialog and panel views
 * Shows a live preview of the configured basemap settings
 */

// CrossViewSnackbar pulls tabular-store (node:module) into the browser bundle; omit to keep client-safe
// import { CrossViewSnackbar } from '@hierarchidb/ui-data-grid';
import { loadMapLibreMap, type MapViewState } from '@hierarchidb/ui-map';
import { DarkMode, LightMode, Map as MapIcon, Satellite, Terrain, Tune } from '@mui/icons-material';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import { lazy, Suspense, useMemo } from 'react';
import { getStyleAttribution } from '../../common/constants/builtInStyles.js';
import type { MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { resolvePreviewMapStyle } from '../utils/mapStyle.js';

export interface BaseMapPreviewProps {
  /** Map style configuration */
  mapStyle: MapStyle;
  /** Viewport configuration */
  viewport: MapViewport;
  /** Optional zxy string for map preview URL (zoom,lng,lat) */
  zxy?: string;
  /** Preview size */
  width?: string | number;
  height?: string | number;
  /** Show metadata overlay */
  showMetadata?: boolean;
  /** Interactive preview */
  interactive?: boolean;
  /** Title for the preview */
  title?: string;
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

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

/**
 * BaseMap Preview Component
 * Provides a preview of the basemap configuration
 */
export const BaseMapPreview: React.FC<BaseMapPreviewProps> = ({
  mapStyle,
  viewport,
  zxy,
  width = '100%',
  height = 300,
  showMetadata = true,
  interactive = false,
  title = 'BaseMap Preview',
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
    [viewport]
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
      const prefix =
        typeof import.meta !== 'undefined' ? import.meta.env?.VITE_APP_PREFIX : undefined;
      const sanitized = prefix?.replace(/^\/+|\/+$/g, '');
      const basePath = sanitized ? `/${sanitized}/` : '/';
      const mapUrl = `${baseUrl}${basePath}map?zxy=${zxyString}`;
      window.open(mapUrl, '_blank');
    }
  };

  // Get map style URL
  const mapStyleSource = useMemo(() => resolvePreviewMapStyle(mapStyle), [mapStyle]);

  // Get attribution
  const attribution = useMemo(() => {
    if (mapStyle.style !== 'custom') {
      return getStyleAttribution(mapStyle.style);
    }
    return '© Map contributors';
  }, [mapStyle]);

  const mapStyleProps = typeof mapStyleSource === 'string'
    ? { mapStyleUrl: mapStyleSource }
    : { mapStyleObject: mapStyleSource };

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
        <Suspense
          fallback={
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(247,250,252,0.6)',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Loading map preview…
              </Typography>
            </Box>
          }
        >
          <LazyMapLibreMap
            initialViewState={initialViewState}
            {...mapStyleProps}
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
            onLoad={() => undefined}
          />
        </Suspense>

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
            {/* Cross-view snackbar intentionally disabled in client bundle to avoid node:module dependency */}
          </>
        )}
      </Box>
    </Paper>
  );
};
