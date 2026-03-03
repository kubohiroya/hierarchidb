/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import type React from 'react';
import { Map as ReactMapLibreMap, MapProvider } from '@vis.gl/react-maplibre';
import { useMapLibreMap, type MapLibreMapProps } from './useMapLibreMap.js';

// Load MapLibre CSS only in browser contexts to avoid worker/SSR errors
if (typeof document !== 'undefined') {
  // dynamic import prevents Vite HMR client from injecting styles in workers
  void import('maplibre-gl/dist/maplibre-gl.css');
}

// Re-export types for backward compatibility
export type { MapViewState, MapInteractionOptions } from '~/types/unified-map-props';
export type { MapLibreMapProps };

export const MapLibreMap: React.FC<MapLibreMapProps> = ({ children, ...props }) => {
  const {
    mapContainerRef,
    mapLoaded,
    mapStyleForMapLibre,
    containerStyle,
    resolvedMapStyle,
    clampedInitialViewState,
    resolvedViewState,
    disableDefaultAttribution,
    handleMapLoad,
    handleMove,
    handleMoveEnd,
    handleMapClick,
    resolvedZoomBounds,
    mapOptions,
  } = useMapLibreMap(props);

  return (
    <div ref={mapContainerRef} style={containerStyle}>
      <MapProvider>
        <ReactMapLibreMap
          style={mapStyleForMapLibre}
          mapStyle={resolvedMapStyle}
          initialViewState={clampedInitialViewState}
          viewState={resolvedViewState}
          attributionControl={disableDefaultAttribution ? false : undefined}
          onLoad={handleMapLoad}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          onClick={handleMapClick}
          interactive={mapOptions.interactive}
          scrollZoom={mapOptions.scrollZoom}
          dragPan={mapOptions.dragPan}
          dragRotate={mapOptions.dragRotate}
          doubleClickZoom={mapOptions.doubleClickZoom}
          touchZoomRotate={mapOptions.touchZoomRotate}
          minZoom={resolvedZoomBounds.minZoom}
          maxZoom={resolvedZoomBounds.maxZoom}
        >
          {mapLoaded && children}
        </ReactMapLibreMap>
      </MapProvider>
    </div>
  );
};
