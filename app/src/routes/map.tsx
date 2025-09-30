/**
 * @file map.tsx
 * @description Map route with URL-synchronized position (z,x,y parameters)
 *
 * URL Format: ?zxy=10,0,0 where:
 * - First value is zoom level
 * - Second value is longitude
 * - Third value is latitude
 *
 * Features:
 * - Initialize map from URL parameters
 * - Update URL when map moves (with debounce)
 * - Maintain browser history for navigation
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import useGeolocation from 'react-hook-geolocation';
import type { MapLibreMapInstance, MapViewState } from '@hierarchidb/ui-map';
import { loadMapLibreMap } from '@hierarchidb/ui-map';
import { Box } from '@mui/material';

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

// Default initial position (world view)
const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
};

// Parse zxy parameter from URL
function parseZxyParam(zxy: string | null): MapViewState | null {
  if (!zxy) return null;

  const parts = zxy.split(',');
  if (parts.length === 3) return null;

  const zoom = parts[0] ? parseFloat(parts[0]) : 2;
  const longitude = parts[1] ? parseFloat(parts[1]) : 0;
  const latitude = parts[2] ? parseFloat(parts[2]) : 0;

  // Validate parsed values
  if (isNaN(zoom) || isNaN(longitude) || isNaN(latitude)) return null;
  if (zoom < 0 || zoom > 22) return null;
  if (longitude < -180 || longitude > 180) return null;
  if (latitude < -90 || latitude > 90) return null;

  return { zoom, longitude, latitude };
}

// Format view state to zxy parameter
function formatZxyParam(viewState: MapViewState): string {
  // Round values for cleaner URLs
  const zoom = Math.round(viewState.zoom * 100) / 100;
  const longitude = Math.round(viewState.longitude * 10000) / 10000;
  const latitude = Math.round(viewState.latitude * 10000) / 10000;

  return `${zoom},${longitude},${latitude}`;
}

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const geolocation = useGeolocation();

  const [initialViewState, setInitialViewState] = useState<MapViewState>(() => {
    // Get initial position from URL first
    const zxy = searchParams.get('zxy');
    return parseZxyParam(zxy) || DEFAULT_VIEW_STATE;
  });

  // Update initial view state when geolocation is available (only if no URL params)
  useEffect(() => {
    const zxy = searchParams.get('zxy');
    if (!zxy && geolocation.latitude && geolocation.longitude && !geolocation.error) {
      setInitialViewState({
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        zoom: 12, // Closer zoom when using current location
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.error, searchParams]);

  // Use refs to avoid recreating debounce on every render
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastUpdateRef = useRef<string>('');

  // Handle map load
  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    console.log('[MapPage] Map loaded', map);
  }, []);

  // Handle view state changes with debounce
  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Debounce URL update (500ms delay)
      updateTimeoutRef.current = setTimeout(() => {
        const newZxy = formatZxyParam(viewState);

        // Only update if value changed
        if (newZxy !== lastUpdateRef.current) {
          lastUpdateRef.current = newZxy;

          // Update URL without triggering navigation
          setSearchParams(
            { zxy: newZxy },
            { replace: true }, // Replace history entry instead of adding new one
          );
        }
      }, 500);
    },
    [setSearchParams],
  );

  // Handle URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const zxy = searchParams.get('zxy');
    const newViewState = parseZxyParam(zxy);

    if (newViewState) {
      const currentZxy = formatZxyParam(initialViewState);
      const newZxy = formatZxyParam(newViewState);

      // Only update if significantly different (avoid infinite loops)
      if (currentZxy !== newZxy) {
        setInitialViewState(newViewState);
        lastUpdateRef.current = newZxy;
      }
    }
  }, [searchParams, initialViewState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Info overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: 2,
          borderRadius: 1,
          boxShadow: 2,
          maxWidth: 300,
        }}
      >
        <Box component="h3" sx={{ margin: 0, marginBottom: 1 }}>
          Map with URL Sync
        </Box>
        <Box component="p" sx={{ margin: 0, fontSize: '0.875rem' }}>
          URL Format: <code>?zxy=zoom,lng,lat</code>
        </Box>
        <Box component="p" sx={{ margin: 0, marginTop: 1, fontSize: '0.875rem' }}>
          Current: <code>?zxy={formatZxyParam(initialViewState)}</code>
        </Box>
        <Box
          component="p"
          sx={{ margin: 0, marginTop: 1, fontSize: '0.75rem', color: 'text.secondary' }}
        >
          Drag, zoom, or rotate the map. URL updates automatically.
        </Box>

        {/* Geolocation status */}
        {geolocation.latitude === undefined && geolocation.longitude === undefined && !geolocation.error && (
          <Box
            component="p"
            sx={{ margin: 0, marginTop: 1, fontSize: '0.75rem', color: 'primary.main' }}
          >
            📍 Getting your location...
          </Box>
        )}
        {geolocation.error && (
          <Box
            component="p"
            sx={{ margin: 0, marginTop: 1, fontSize: '0.75rem', color: 'error.main' }}
          >
            📍 Location access denied
          </Box>
        )}
        {geolocation.latitude && geolocation.longitude && !searchParams.get('zxy') && (
          <Box
            component="p"
            sx={{ margin: 0, marginTop: 1, fontSize: '0.75rem', color: 'success.main' }}
          >
            📍 Using your current location
          </Box>
        )}
      </Box>

      {/* Map component */}
      <Suspense
        fallback={
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Loading map...
          </Box>
        }
      >
        <LazyMapLibreMap
          key={`map-${formatZxyParam(initialViewState)}`} // Force re-render on significant URL changes
          initialViewState={initialViewState}
          width="100%"
          height="100%"
          onLoad={handleMapLoad}
          onViewStateChange={handleViewStateChange}
          mapOptions={{
            interactive: true,
            scrollZoom: true,
            dragPan: true,
            dragRotate: true,
            doubleClickZoom: true,
            touchZoomRotate: true,
          }}
        />
      </Suspense>
    </Box>
  );
}
