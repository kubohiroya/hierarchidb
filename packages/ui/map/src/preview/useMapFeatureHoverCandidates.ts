import { useEffect } from 'react';
import type {
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
} from '../types/maplibre-public.js';
import { defaultFeatureIdAccessor, resolveIdentifyCandidates } from '../lib/feature-identification.js';

const isPointLayer = (feature: MapLibreGeoJSONFeature): boolean => {
  const layerType = feature.layer?.type;
  return layerType === 'circle' || layerType === 'symbol';
};

const hasPointGeometry = (
  feature: MapLibreGeoJSONFeature,
): feature is MapLibreGeoJSONFeature & { geometry: { type: 'Point'; coordinates: [number, number] } } => {
  const geometry = (feature as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
  if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return false;
  const [lng, lat] = geometry.coordinates;
  return typeof lng === 'number' && typeof lat === 'number';
};

const canSortByDistance = (features: MapLibreGeoJSONFeature[]): boolean =>
  features.length > 1 && features.every((feature) => isPointLayer(feature) && hasPointGeometry(feature));

const sortByDistance = (
  map: MapLibreMapInstance,
  event: MapLibreMapMouseEvent,
  features: MapLibreGeoJSONFeature[],
): MapLibreGeoJSONFeature[] => {
  if (!event.point || !canSortByDistance(features)) return features;
  const mapWithProject = map as MapLibreMapInstance & {
    project: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
  };
  const { x, y } = event.point;
  const scored = features.map((feature, index) => {
    const [lng, lat] = (feature as { geometry: { coordinates: [number, number] } }).geometry.coordinates;
    const projected = mapWithProject.project({ lng, lat });
    const distance = Math.hypot(projected.x - x, projected.y - y);
    return { feature, distance, index };
  });
  scored.sort((a, b) => a.distance - b.distance || a.index - b.index);
  return scored.map((entry) => entry.feature);
};

const sortByPriorityAndDistance = (
  map: MapLibreMapInstance,
  event: MapLibreMapMouseEvent,
  features: MapLibreGeoJSONFeature[],
  layerPriorityById?: Map<string, number>,
): MapLibreGeoJSONFeature[] => {
  if (!layerPriorityById || layerPriorityById.size === 0) {
    return sortByDistance(map, event, features);
  }
  const canSortDistance = canSortByDistance(features);
  const mapWithProject = canSortDistance
    ? (map as MapLibreMapInstance & {
        project: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
      })
    : null;
  const { x, y } = event.point ?? { x: 0, y: 0 };
  const scored = features.map((feature, index) => {
    const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : '';
    const priority = layerPriorityById.get(layerId) ?? 0;
    let distance = 0;
    if (canSortDistance && mapWithProject && event.point) {
      const [lng, lat] = (feature as { geometry: { coordinates: [number, number] } }).geometry.coordinates;
      const projected = mapWithProject.project({ lng, lat });
      distance = Math.hypot(projected.x - x, projected.y - y);
    }
    return { feature, priority, distance, index };
  });
  scored.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (canSortDistance && a.distance !== b.distance) return a.distance - b.distance;
    return a.index - b.index;
  });
  return scored.map((entry) => entry.feature);
};

export type UseMapFeatureHoverCandidatesParams<HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  layerPriorityById?: Map<string, number>;
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  radius?: number;
  onHoverChange: (entries: HighlightEntry[], features: MapLibreGeoJSONFeature[]) => void;
};

export const useMapFeatureHoverCandidates = <HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  layerPriorityById,
  buildHighlightEntry,
  radius = 6,
  onHoverChange,
}: UseMapFeatureHoverCandidatesParams<HighlightEntry>) => {
  useEffect(() => {
    if (!mapInstance) return undefined;
    const handleMouseMove = (event: MapLibreMapMouseEvent) => {
      const activeLayerIds = highlightLayerIds.filter((layerId) => Boolean(mapInstance.getLayer(layerId)));
      if (activeLayerIds.length === 0) {
        onHoverChange([], []);
        return;
      }
      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: activeLayerIds,
        radius,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const orderedFeatures = sortByPriorityAndDistance(mapInstance, event, result.features, layerPriorityById);
      const entries = orderedFeatures
        .map((feature) => buildHighlightEntry(feature))
        .filter((entry): entry is HighlightEntry => Boolean(entry));
      onHoverChange(entries, orderedFeatures);
    };

    const handleMouseLeave = () => {
      onHoverChange([], []);
    };

    const canvas = mapInstance.getCanvas();
    mapInstance.on('mousemove', handleMouseMove as (...args: unknown[]) => void);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      mapInstance.off('mousemove', handleMouseMove as (...args: unknown[]) => void);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [buildHighlightEntry, highlightLayerIds, layerPriorityById, mapInstance, onHoverChange, radius]);
};
