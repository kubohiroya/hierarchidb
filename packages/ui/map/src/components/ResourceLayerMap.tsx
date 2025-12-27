/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MapLibreMapInstance, MapLibreStyle } from '../types/maplibre-public.js';
import type { FeatureCollection } from 'geojson';
import { VectorTileLayer } from './VectorTileLayer.js';
import {
  DEFAULT_MAP_CONFIG,
  type BaseMapProps,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '../types/unified-map-props.js';
import { MapLibreMap, type MapLibreMapProps } from './MapLibreMap.js';

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

type MapLayerType = NonNullable<VectorTileLayerConfig['layerType']>;
type LayerStyleOverrides = Partial<Record<MapLayerType, Record<string, unknown>>>;

export type ResourceVectorLayer = VectorTileDataSource & {
  nodeId: string;
  nodeType: 'shape' | 'location' | 'route';
  absolutePath?: string;
  layerConfig?: VectorTileLayerConfig;
};

export type ResourceGeoJsonLayer = {
  layerId: string;
  sourceId: string;
  data: FeatureCollection;
  layerType: 'line' | 'circle' | 'fill' | 'symbol';
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  beforeId?: string;
  absolutePath?: string;
};

export type ResourceLayerMapProps = BaseMapProps & {
  basemapStyles?: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers?: ResourceGeoJsonLayer[];
  styleOverrides?: Record<string, unknown>;
  styleOverridesByType?: LayerStyleOverrides;
  highlightOverridesByType?: LayerStyleOverrides;
  controls?: MapLibreMapProps['controls'];
};

const LAYER_PAINT_KEYS: Record<MapLayerType, Set<string>> = {
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color']),
  line: new Set(['line-color', 'line-opacity', 'line-width']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius']),
  symbol: new Set(['text-color', 'text-halo-color', 'text-halo-width']),
  raster: new Set(['raster-opacity', 'raster-brightness-max', 'raster-brightness-min', 'raster-contrast']),
  background: new Set(['background-color', 'background-opacity', 'background-pattern']),
};

const pickStyleOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  overrides?: Record<string, unknown>,
  overridesByType?: LayerStyleOverrides,
): Record<string, unknown> => {
  const allowed = LAYER_PAINT_KEYS[layerType ?? 'fill'];
  if (!allowed) return {};
  const globalOverrides = overrides ?? {};
  const typedOverrides = overridesByType?.[layerType ?? 'fill'] ?? {};
  return Object.fromEntries(
    Object.entries({ ...typedOverrides, ...globalOverrides }).filter(([key]) => allowed.has(key))
  );
};

type SortableLayer = {
  absolutePath?: string;
  nodeId?: string;
  layerId?: string;
  sourceId?: string;
};

const sortByPath = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
  const {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    styleOverrides,
    styleOverridesByType,
    highlightOverridesByType,
    mapStyleUrl,
    mapStyleObject,
    onLoad,
    ...baseMapProps
  } = props as ResourceLayerMapProps & {
    mapStyleUrl?: string;
    mapStyleObject?: MapLibreStyle;
  };

  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);

  const orderedBasemaps = useMemo(() => (basemapStyles ? sortByPath(basemapStyles) : []), [basemapStyles]);
  const orderedLayers = useMemo(() => sortByPath(vectorLayers), [vectorLayers]);
  const orderedGeoJsonLayers = useMemo(
    () => (geoJsonLayers ? sortByPath(geoJsonLayers) : []),
    [geoJsonLayers]
  );

  const resolvedBaseStyle = useMemo(() => {
    if (orderedBasemaps.length) return orderedBasemaps[0]?.style;
    if (mapStyleObject) return mapStyleObject;
    return mapStyleUrl ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [mapStyleObject, mapStyleUrl, orderedBasemaps]);

  const mapStyleProps =
    typeof resolvedBaseStyle === 'string'
      ? { mapStyleUrl: resolvedBaseStyle }
      : { mapStyleObject: resolvedBaseStyle };

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  useEffect(() => {
    if (!mapInstance || !orderedGeoJsonLayers.length) return;
    const map = mapInstance as MapLibreMapInstance & {
      addSource: (id: string, source: unknown) => void;
      addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
    };

    orderedGeoJsonLayers.forEach((layer) => {
      if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
      if (map.getSource(layer.sourceId)) map.removeSource(layer.sourceId);
      map.addSource(layer.sourceId, { type: 'geojson', data: layer.data });
      map.addLayer(
        {
          id: layer.layerId,
          type: layer.layerType,
          source: layer.sourceId,
          paint: layer.paint ?? {},
          layout: layer.layout ?? {},
        },
        layer.beforeId,
      );
    });

    return () => {
      orderedGeoJsonLayers.forEach((layer) => {
        if (map.getLayer(layer.layerId)) map.removeLayer(layer.layerId);
        if (map.getSource(layer.sourceId)) map.removeSource(layer.sourceId);
      });
    };
  }, [mapInstance, orderedGeoJsonLayers]);

  return (
    <MapLibreMap
      {...baseMapProps}
      {...mapStyleProps}
      onLoad={handleMapLoad}
    >
      {mapInstance &&
        orderedLayers.map((layer) => {
          const layerConfig = { ...DEFAULT_MAP_CONFIG.vectorTileLayer, ...layer.layerConfig };
          const layerType = layerConfig.layerType ?? 'fill';
          const paintOverrides = pickStyleOverrides(layerType, styleOverrides, styleOverridesByType);
          const highlightOverrides = highlightOverridesByType?.[layerType] ?? {};
          const layerPaint = { ...(layerConfig.paint ?? {}), ...paintOverrides, ...highlightOverrides };
          const layerId = layerConfig.layerId ?? `resource-layer-${layer.nodeId}`;
          const sourceId = layerConfig.sourceId ?? `resource-source-${layer.nodeId}`;

          return (
            <VectorTileLayer
              key={layerId}
              map={mapInstance}
              dbName={layer.dbName}
              nodeId={layer.nodeId}
              tiles={layer.tiles}
              tileDataProvider={layer.tileDataProvider}
              layerId={layerId}
              sourceId={sourceId}
              promoteId={layer.promoteId}
              featureState={layer.featureState}
              paint={layerPaint}
              layout={layerConfig.layout}
              filter={layerConfig.filter}
              minzoom={layerConfig.minzoom}
              maxzoom={layerConfig.maxzoom}
              layerType={layerType}
              sourceLayer={layerConfig.sourceLayer}
              visible={layerConfig.visible}
            />
          );
        })}
    </MapLibreMap>
  );
};
