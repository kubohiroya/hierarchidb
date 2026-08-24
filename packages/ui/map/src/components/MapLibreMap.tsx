/**
 * @file MapLibreMap.tsx
 * @description Shared MapLibre GL map component for HierarchiDB
 */

import { MapProvider, Map as ReactMapLibreMap } from '@vis.gl/react-maplibre';
import type React from 'react';
import { type MapLibreMapProps, useMapLibreMap } from './useMapLibreMap.js';

// Load MapLibre CSS as a static import for bundler (rolldown-vite) compatibility.
// Dynamic CSS imports are not supported by rolldown; a static import is used instead.
// This file is only used in browser/React DOM contexts, so importing CSS at module level is safe.
import 'maplibre-gl/dist/maplibre-gl.css';

// Re-export types for backward compatibility
export type { MapInteractionOptions, MapViewState } from '~/types/unified-map-props';
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
          canvasContextAttributes={
            mapOptions.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : undefined
          }
          minZoom={resolvedZoomBounds.minZoom}
          maxZoom={resolvedZoomBounds.maxZoom}
        >
          {mapLoaded && children}
        </ReactMapLibreMap>
      </MapProvider>
    </div>
  );
};
