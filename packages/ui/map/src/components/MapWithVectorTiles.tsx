/**
 * @file MapWithVectorTiles.tsx
 * @description Integrated map component with vector tile support
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import { VectorTileLayer } from './VectorTileLayer.js';
import {
  type BaseMapProps,
  DEFAULT_MAP_CONFIG,
  type MapClickEvent,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '../types/unified-map-props.js';
import type { MapLibreMapProps } from './MapLibreMap.js';

type MapLibreComponent = React.ComponentType<MapLibreMapProps>;

let cachedMapLibreComponent: MapLibreComponent | null = null;
let mapLibreComponentPromise: Promise<MapLibreComponent> | null = null;

const getCachedMapComponent = (): MapLibreComponent | null => cachedMapLibreComponent;

type SafeStyle = Omit<React.CSSProperties, 'background'> & { background?: string };

const normalizeStyle = (style?: React.CSSProperties): SafeStyle | undefined => {
  if (!style) return undefined;
  const { background, ...rest } = style;
  const safeBackground = typeof background === 'string' ? background : undefined;
  return safeBackground !== undefined ? { ...rest, background: safeBackground } : { ...rest };
};

const loadMapLibreComponent = async (): Promise<MapLibreComponent> => {
  if (cachedMapLibreComponent) return cachedMapLibreComponent;
  if (!mapLibreComponentPromise) {
    mapLibreComponentPromise = import('./MapLibreMap.js').then((mod) => {
      cachedMapLibreComponent = mod.MapLibreMap;
      return cachedMapLibreComponent;
    });
  }
  return mapLibreComponentPromise;
};

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
                                                                        mapStyleUrl = DEFAULT_MAP_CONFIG.mapStyleUrl,
                                                                        mapStyleObject,
                                                                        width = DEFAULT_MAP_CONFIG.dimensions.width,
                                                                        height = DEFAULT_MAP_CONFIG.dimensions.height,
                                                                        style,
                                                                        onLoad,
                                                                        onViewStateChange,
                                                                        onClick,
                                                                        mapOptions,
                                                                        controls,
                                                                        identifyFeatureOnClick,

                                                                        // Layer configuration
                                                                        layerConfig = {},

                                                                        // Backward compatibility props - deprecated
                                                                        layerOptions = {},
                                                                        onMapLoad,
                                                                        onMapClick,
                                                                      }) => {
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [MapComponent, setMapComponent] = useState<MapLibreComponent | null>(getCachedMapComponent);

  useEffect(() => {
    if (MapComponent) return;
    let mounted = true;
    void loadMapLibreComponent().then((component) => {
      if (mounted) setMapComponent(() => component);
    });
    return () => {
      mounted = false;
    };
  }, [MapComponent]);

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    setMapInstance(map);
    // Support both new and old callback names
    onLoad?.(map);
    onMapLoad?.(map); // Backward compatibility
  }, [onLoad, onMapLoad]);

  if (!MapComponent) {
    const fallbackStyle: React.CSSProperties = {
      width,
      height,
      position: 'relative',
      ...(normalizeStyle(style) ?? {}),
    };
    return <div style={fallbackStyle} />;
  }

  // Merge layer config with backward compatibility support
  const mergedLayerConfig = { ...defaultLayerConfig, ...layerConfig, ...layerOptions };

  const mapStyleProps = mapStyleObject ? { mapStyleObject } : { mapStyleUrl };

  return (
    <MapComponent
      initialViewState={initialViewState}
      {...mapStyleProps}
      width={width}
      height={height}
      style={normalizeStyle(style)}
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
