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
import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router';
import useGeolocation from 'react-hook-geolocation';
import type { MapLibreMapInstance, MapViewState } from '@hierarchidb/ui-shell/ui-map';
import { loadMapLibreMap } from '@hierarchidb/ui-shell/ui-map';
import { Box } from '@mui/material';
import {
  DEFAULT_VIEW_STATE as LOADER_DEFAULT_VIEW_STATE,
  formatZxyParam,
  parseZxyParam,
  type MapViewState as LoaderMapViewState,
} from '../loaders/mapLoader.js';

type MapSearch = {
  zxy?: string;
};

const LazyMapLibreMap = lazy(async () => {
  const mod = await loadMapLibreMap();
  return { default: mod.MapLibreMap };
});

// const DEFAULT_VIEW_STATE: MapViewState = LOADER_DEFAULT_VIEW_STATE as MapViewState;

export default function MapPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/map' }) as MapSearch;
  const loaderViewState = useLoaderData({ from: '/map' }) as LoaderMapViewState;
  const geolocation = useGeolocation();
  const [initialViewState, setInitialViewState] = useState<MapViewState>(() => ({
    longitude: loaderViewState.longitude,
    latitude: loaderViewState.latitude,
    zoom: loaderViewState.zoom,
  }));

  useEffect(() => {
    setInitialViewState({
      longitude: loaderViewState.longitude,
      latitude: loaderViewState.latitude,
      zoom: loaderViewState.zoom,
    });
    lastUpdateRef.current = formatZxyParam(loaderViewState);
  }, [loaderViewState]);

  // Update initial view state when geolocation is available (only if no URL params)
  useEffect(() => {
    if (!search?.zxy && geolocation.latitude && geolocation.longitude && !geolocation.error) {
      setInitialViewState({
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        zoom: 12, // Closer zoom when using current location
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.error, search?.zxy]);

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

          // Update URL without triggering full remount
          navigate({
            to: '/map',
            search: (prev: MapSearch = {}) => ({ ...prev, zxy: newZxy }),
            replace: true,
          });
        }
      }, 500);
    },
    [navigate],
  );

  // Handle URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const newViewState = parseZxyParam(search?.zxy ?? null);

    if (newViewState) {
      const currentZxy = formatZxyParam(initialViewState);
      const newZxy = formatZxyParam(newViewState);

      // Only update if significantly different (avoid infinite loops)
      if (currentZxy !== newZxy) {
        setInitialViewState(newViewState);
        lastUpdateRef.current = newZxy;
      }
    }
  }, [search?.zxy, initialViewState]);

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
        {geolocation.latitude && geolocation.longitude && !search?.zxy && (
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
