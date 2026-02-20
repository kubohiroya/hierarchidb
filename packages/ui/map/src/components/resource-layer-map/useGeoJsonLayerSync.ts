import { useEffect, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import { normalizePaintLiteralArrays } from '~/utils/maplibre-style-utils';
import type { ResourceGeoJsonLayer } from './ResourceLayerMap.types.js';

type LayerMap = MapLibreMapInstance & {
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  setFilter?: (id: string, filter: unknown) => void;
  setLayoutProperty?: (id: string, key: string, value: unknown) => void;
  setPaintProperty?: (id: string, key: string, value: unknown) => void;
  moveLayer?: (id: string, beforeId?: string) => void;
};

const isSetLike = (value: unknown): value is Set<string> => value instanceof Set;

export const useGeoJsonLayerSync = ({
  mapInstance,
  orderedGeoJsonLayers,
}: {
  mapInstance: MapLibreMapInstance | null;
  orderedGeoJsonLayers: ResourceGeoJsonLayer[];
}): void => {
  const geoJsonLayerIdsRef = useRef<Set<string>>(new Set());
  const geoJsonSourceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as LayerMap;
    if (!orderedGeoJsonLayers.length) {
      geoJsonLayerIdsRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      geoJsonSourceIdsRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
      geoJsonLayerIdsRef.current = new Set();
      geoJsonSourceIdsRef.current = new Set();
      return;
    }

    const sourceData = new Map<string, FeatureCollection>();
    orderedGeoJsonLayers.forEach((layer) => {
      if (!sourceData.has(layer.sourceId)) {
        sourceData.set(layer.sourceId, layer.data);
      }
    });

    const nextLayerIds = new Set(orderedGeoJsonLayers.map((layer) => layer.layerId));
    const nextSourceIds = new Set(sourceData.keys());

    geoJsonLayerIdsRef.current.forEach((layerId) => {
      if (!nextLayerIds.has(layerId) && map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    geoJsonSourceIdsRef.current.forEach((sourceId) => {
      if (!nextSourceIds.has(sourceId) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });

    sourceData.forEach((data, sourceId) => {
      const source = map.getSource(sourceId) as { setData?: (data: FeatureCollection) => void } | undefined;
      if (source?.setData) {
        source.setData(data);
        return;
      }
      if (source) {
        map.removeSource(sourceId);
      }
      map.addSource(sourceId, { type: 'geojson', data });
    });

    orderedGeoJsonLayers.forEach((layer) => {
      const paint = normalizePaintLiteralArrays(layer.paint ?? {});
      if (!map.getLayer(layer.layerId)) {
        map.addLayer(
          {
            id: layer.layerId,
            type: layer.layerType,
            source: layer.sourceId,
            paint,
            layout: layer.layout ?? {},
            ...(layer.filter ? { filter: layer.filter } : {}),
          },
          layer.beforeId,
        );
        return;
      }
      map.setFilter?.(layer.layerId, layer.filter ?? null);
      Object.entries(layer.layout ?? {}).forEach(([key, value]) => {
        map.setLayoutProperty?.(layer.layerId, key, value);
      });
      Object.entries(paint).forEach(([key, value]) => {
        map.setPaintProperty?.(layer.layerId, key, value);
      });
      if (map.moveLayer && layer.beforeId !== undefined) {
        map.moveLayer(layer.layerId, layer.beforeId);
      }
    });

    geoJsonLayerIdsRef.current = nextLayerIds;
    geoJsonSourceIdsRef.current = nextSourceIds;
  }, [mapInstance, orderedGeoJsonLayers]);

  useEffect(() => () => {
    const map = mapInstance as LayerMap | null;
    if (!map) return;
    if (isSetLike(geoJsonLayerIdsRef.current)) {
      geoJsonLayerIdsRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
    }
    if (isSetLike(geoJsonSourceIdsRef.current)) {
      geoJsonSourceIdsRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    }
  }, [mapInstance]);
};
