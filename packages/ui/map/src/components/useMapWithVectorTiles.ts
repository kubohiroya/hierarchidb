import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import {
  DEFAULT_MAP_CONFIG,
  type VectorTileLayerConfig,
} from '~/types/unified-map-props';
import type { MapLibreMapProps } from './MapLibreMap.js';
import type { MapWithVectorTilesProps } from './MapWithVectorTiles.js';

type MapLibreComponent = React.ComponentType<MapLibreMapProps>;

type SafeStyle = Omit<React.CSSProperties, 'background'> & { background?: string };

let cachedMapLibreComponent: MapLibreComponent | null = null;
let mapLibreComponentPromise: Promise<MapLibreComponent> | null = null;

const getCachedMapComponent = (): MapLibreComponent | null => cachedMapLibreComponent;

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

const { viewState: defaultViewState, vectorTileLayer: defaultLayerConfig } = DEFAULT_MAP_CONFIG;

export const useMapWithVectorTiles = ({
  initialViewState = defaultViewState,
  mapStyleUrl = DEFAULT_MAP_CONFIG.mapStyleUrl,
  mapStyleObject,
  width = DEFAULT_MAP_CONFIG.dimensions.width,
  height = DEFAULT_MAP_CONFIG.dimensions.height,
  style,
  onLoad,
  onMapLoad,
  layerConfig,
  layerOptions,
}: Pick<
  MapWithVectorTilesProps,
  | 'initialViewState'
  | 'mapStyleUrl'
  | 'mapStyleObject'
  | 'width'
  | 'height'
  | 'style'
  | 'onLoad'
  | 'onMapLoad'
  | 'layerConfig'
  | 'layerOptions'
>) => {
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

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      onLoad?.(map);
      onMapLoad?.(map);
    },
    [onLoad, onMapLoad],
  );

  const fallbackStyle: React.CSSProperties = {
    width,
    height,
    position: 'relative',
    ...(normalizeStyle(style) ?? {}),
  };

  const mergedLayerConfig: VectorTileLayerConfig = {
    ...defaultLayerConfig,
    ...(layerConfig ?? {}),
    ...(layerOptions ?? {}),
  };

  const mapStyleProps = mapStyleObject ? { mapStyleObject } : { mapStyleUrl };

  return {
    MapComponent,
    mapInstance,
    handleMapLoad,
    initialViewState,
    width,
    height,
    normalizedStyle: normalizeStyle(style),
    fallbackStyle,
    mergedLayerConfig,
    mapStyleProps,
  };
};
