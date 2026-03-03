/**
 * @file MapWithVectorTiles.tsx
 * @description Integrated map component with vector tile support
 */

import type React from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import { VectorTileLayer } from './VectorTileLayer.js';
import {
  type BaseMapProps,
  type MapClickEvent,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '~/types/unified-map-props';
import type { MapLibreMapProps } from './MapLibreMap.js';
import { useMapWithVectorTiles } from './useMapWithVectorTiles.js';

// Re-export for backward compatibility - but mark as deprecated
/**
 * @deprecated Use VectorTileLayerConfig from unified-map-props instead
 */
export type LayerOptions = VectorTileLayerConfig;

export type MapWithVectorTilesProps = BaseMapProps & VectorTileDataSource & {
  /** Vector tile layer configuration */
  layerConfig?: VectorTileLayerConfig;

  /** Optional built-in control toggles */
  controls?: MapLibreMapProps['controls'];

  // Backward compatibility props (deprecated)
  /**
   * @deprecated Use layerConfig instead
   */
  layerOptions?: VectorTileLayerConfig;

  /**
   * @deprecated Use onLoad instead
   */
  onMapLoad?: (map: MapLibreMapInstance) => void;

  /**
   * @deprecated Use onClick instead
   */
  onMapClick?: (event: MapClickEvent) => void;
};

export const MapWithVectorTiles: React.FC<MapWithVectorTilesProps> = ({
  // Vector tile data source props
  dbName,
  nodeId,
  tiles,
  tileDataProvider,

  // Base map props
  initialViewState,
  mapStyleUrl,
  mapStyleObject,
  width,
  height,
  style,
  onLoad,
  onViewStateChange,
  onClick,
  mapOptions,
  controls,
  identifyFeatureOnClick,

  // Layer configuration
  layerConfig,

  // Backward compatibility props - deprecated
  layerOptions,
  onMapLoad,
  onMapClick,
}) => {
  const {
    MapComponent,
    mapInstance,
    handleMapLoad,
    initialViewState: resolvedInitialViewState,
    width: resolvedWidth,
    height: resolvedHeight,
    normalizedStyle,
    fallbackStyle,
    mergedLayerConfig,
    mapStyleProps,
  } = useMapWithVectorTiles({
    initialViewState,
    mapStyleUrl,
    mapStyleObject,
    width,
    height,
    style,
    onLoad,
    onMapLoad,
    layerConfig,
    layerOptions,
  });

  if (!MapComponent) {
    return <div style={fallbackStyle} />;
  }

  return (
    <MapComponent
      initialViewState={resolvedInitialViewState}
      {...mapStyleProps}
      width={resolvedWidth}
      height={resolvedHeight}
      style={normalizedStyle}
      onLoad={handleMapLoad}
      onViewStateChange={onViewStateChange}
      onClick={onClick || onMapClick}
      identifyFeatureOnClick={identifyFeatureOnClick}
      mapOptions={mapOptions}
      controls={controls}
    >
      {mapInstance && (dbName || tiles || tileDataProvider) && (
        <VectorTileLayer
          map={mapInstance}
          dbName={dbName}
          nodeId={nodeId}
          layerId={mergedLayerConfig.layerId!}
          sourceId={mergedLayerConfig.sourceId!}
          tiles={tiles}
          paint={mergedLayerConfig.paint}
          layout={mergedLayerConfig.layout}
          filter={mergedLayerConfig.filter}
          minzoom={mergedLayerConfig.minzoom}
          maxzoom={mergedLayerConfig.maxzoom}
          layerType={mergedLayerConfig.layerType}
          sourceLayer={mergedLayerConfig.sourceLayer}
          visible={mergedLayerConfig.visible}
          tileDataProvider={tileDataProvider}
        />
      )}
    </MapComponent>
  );
};
