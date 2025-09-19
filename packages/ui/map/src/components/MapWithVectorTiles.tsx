/**
 * @file MapWithVectorTiles.tsx
 * @description Integrated map component with vector tile support
 */

import React, { useCallback, useState } from 'react';
import type { MapLibreMapInstance } from '../types/maplibre-public';
import MapLibreMap from './MapLibreMap';
import VectorTileLayer from './VectorTileLayer';
import {
  BaseMapProps,
  DEFAULT_MAP_CONFIG,
  VectorTileDataSource,
  VectorTileLayerConfig,
} from '../types/unified-map-props';

// Re-export for backward compatibility - but mark as deprecated
/**
 * @deprecated Use VectorTileLayerConfig from unified-map-props instead
 */
export type LayerOptions = VectorTileLayerConfig;

export interface MapWithVectorTilesProps extends BaseMapProps, VectorTileDataSource {
  /** Vector tile layer configuration */
  layerConfig?: VectorTileLayerConfig;

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
  onMapClick?: (event: any) => void;
}

// Default values from unified config
const { viewState: defaultViewState, vectorTileLayer: defaultLayerConfig } = DEFAULT_MAP_CONFIG;

export const MapWithVectorTiles: React.FC<MapWithVectorTilesProps> = ({
                                                                        // Vector tile data source props
                                                                        dbName,
                                                                        nodeId,
                                                                        tiles,
                                                                        tileDataProvider,

                                                                        // Base map props
                                                                        initialViewState = defaultViewState,
                                                                        mapStyle = DEFAULT_MAP_CONFIG.mapStyle,
                                                                        width = DEFAULT_MAP_CONFIG.dimensions.width,
                                                                        height = DEFAULT_MAP_CONFIG.dimensions.height,
                                                                        style,
                                                                        onLoad,
                                                                        onViewStateChange,
                                                                        onClick,
                                                                        mapOptions,
                                                                        identifyFeatureOnClick,

                                                                        // Layer configuration
                                                                        layerConfig = {},

                                                                        // Backward compatibility props - deprecated
                                                                        layerOptions = {},
                                                                        onMapLoad,
                                                                        onMapClick,
                                                                      }) => {
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  // Merge layer config with backward compatibility support
  const mergedLayerConfig = { ...defaultLayerConfig, ...layerConfig, ...layerOptions };

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setMapInstance(map);
    // Support both new and old callback names
    onLoad?.(map);
    onMapLoad?.(map); // Backward compatibility
  }, [onLoad, onMapLoad]);

  return (
    <MapLibreMap
      initialViewState={initialViewState}
      mapStyle={mapStyle}
      width={width}
      height={height}
      style={style}
      onLoad={handleMapLoad}
      onViewStateChange={onViewStateChange}
      onClick={onClick || onMapClick}
      identifyFeatureOnClick={identifyFeatureOnClick}
      mapOptions={mapOptions}
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
    </MapLibreMap>
  );
};

export default MapWithVectorTiles;
