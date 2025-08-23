/**
 * @file MapWithVectorTiles.tsx
 * @description Integrated map component with vector tile support
 */

import React, { useCallback, useState } from 'react';
import type { Map as MapLibreMapInstance, FilterSpecification } from 'maplibre-gl';
import MapLibreMap, { type MapViewState } from './MapLibreMap';
import VectorTileLayer from './VectorTileLayer';

export interface LayerOptions {
  layerId?: string;
  sourceId?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: FilterSpecification;
  minzoom?: number;
  maxzoom?: number;
  layerType?: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background';
  sourceLayer?: string;
}

export interface MapWithVectorTilesProps {
  /** Database name for vector tiles */
  dbName?: string;
  
  /** Node ID for data lookup */
  nodeId?: string;
  
  /** Initial view state */
  initialViewState?: MapViewState;
  
  /** Map style URL or object */
  mapStyle?: string;
  
  /** Map container dimensions */
  width?: string | number;
  height?: string | number;
  
  /** Additional container styles */
  style?: React.CSSProperties;
  
  /** Vector tile layer options */
  layerOptions?: LayerOptions;
  
  /** Custom vector tile URLs */
  tiles?: string[];
  
  /** Custom tile data provider */
  tileDataProvider?: (z: number, x: number, y: number, nodeId?: string) => Promise<ArrayBuffer | null>;
  
  /** Callback when map loads */
  onMapLoad?: (map: MapLibreMapInstance) => void;
  
  /** Callback when view state changes */
  onViewStateChange?: (viewState: MapViewState) => void;
  
  /** Callback when map is clicked */
  onMapClick?: (event: any) => void;
  
  /** Additional map options */
  mapOptions?: {
    interactive?: boolean;
    scrollZoom?: boolean;
    dragPan?: boolean;
    dragRotate?: boolean;
    doubleClickZoom?: boolean;
    touchZoomRotate?: boolean;
  };
}

const defaultViewState: MapViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
};

const defaultLayerOptions: LayerOptions = {
  layerId: 'vector-tile-layer',
  sourceId: 'vector-tile-source',
  paint: {
    'fill-color': 'rgba(0, 136, 136, 0.7)',
    'fill-outline-color': '#004444',
  },
  layerType: 'fill',
  minzoom: 0,
  maxzoom: 14,
};

export const MapWithVectorTiles: React.FC<MapWithVectorTilesProps> = ({
  dbName,
  nodeId,
  initialViewState = defaultViewState,
  mapStyle = 'https://demotiles.maplibre.org/style.json',
  width = '100%',
  height = '500px',
  style,
  layerOptions = {},
  tiles,
  tileDataProvider,
  onMapLoad,
  onViewStateChange,
  onMapClick,
  mapOptions,
}) => {
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  const mergedLayerOptions = { ...defaultLayerOptions, ...layerOptions };

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setMapInstance(map);
    onMapLoad?.(map);
  }, [onMapLoad]);

  return (
    <MapLibreMap
      initialViewState={initialViewState}
      mapStyle={mapStyle}
      width={width}
      height={height}
      style={style}
      onLoad={handleMapLoad}
      onViewStateChange={onViewStateChange}
      onClick={onMapClick}
      mapOptions={mapOptions}
    >
      {mapInstance && (dbName || tiles || tileDataProvider) && (
        <VectorTileLayer
          map={mapInstance}
          dbName={dbName}
          nodeId={nodeId}
          layerId={mergedLayerOptions.layerId!}
          sourceId={mergedLayerOptions.sourceId!}
          tiles={tiles}
          paint={mergedLayerOptions.paint}
          layout={mergedLayerOptions.layout}
          filter={mergedLayerOptions.filter}
          minzoom={mergedLayerOptions.minzoom}
          maxzoom={mergedLayerOptions.maxzoom}
          layerType={mergedLayerOptions.layerType}
          sourceLayer={mergedLayerOptions.sourceLayer}
          tileDataProvider={tileDataProvider}
        />
      )}
    </MapLibreMap>
  );
};

export default MapWithVectorTiles;