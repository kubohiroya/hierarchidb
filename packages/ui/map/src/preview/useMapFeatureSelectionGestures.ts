import { useEffect, useRef } from 'react';
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

export type SelectionGestureMode = 'replace' | 'toggle' | 'add' | 'clear' | 'box';

export type UseMapFeatureSelectionGesturesParams<HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  layerPriorityById?: Map<string, number>;
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  radius?: number;
  onSelectionChange: (mode: SelectionGestureMode, entries: HighlightEntry[]) => void;
};

export const useMapFeatureSelectionGestures = <HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  layerPriorityById,
  buildHighlightEntry,
  radius = 6,
  onSelectionChange,
}: UseMapFeatureSelectionGesturesParams<HighlightEntry>) => {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (!mapInstance) return undefined;

    const handleClick = (event: MapLibreMapMouseEvent) => {
      if (skipClickRef.current) {
        skipClickRef.current = false;
        return;
      }
      const originalEvent = event.originalEvent as MouseEvent | undefined;
      const metaKey = Boolean(originalEvent?.metaKey);
      const shiftKey = Boolean(originalEvent?.shiftKey);

      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: highlightLayerIds,
        radius,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const orderedFeatures = sortByPriorityAndDistance(mapInstance, event, result.features, layerPriorityById);
      const entries = orderedFeatures
        .map((feature) => buildHighlightEntry(feature))
        .filter((entry): entry is HighlightEntry => Boolean(entry));

      if (entries.length === 0) {
        onSelectionChange('clear', []);
        return;
      }

      if (metaKey) {
        onSelectionChange('toggle', entries);
        return;
      }

      if (shiftKey) {
        onSelectionChange('add', entries);
        return;
      }

      const firstEntry = entries[0];
      if (!firstEntry) {
        onSelectionChange('clear', []);
        return;
      }
      onSelectionChange('replace', [firstEntry]);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!event.metaKey || event.button !== 0) return;
      const canvas = mapInstance.getCanvas();
      const rect = canvas.getBoundingClientRect();
      dragStartRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      dragMovedRef.current = false;
      skipClickRef.current = false;
      (mapInstance as MapLibreMapInstance & { dragPan?: { disable?: () => void } }).dragPan?.disable?.();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStartRef.current) return;
      const canvas = mapInstance.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const dx = event.clientX - rect.left - dragStartRef.current.x;
      const dy = event.clientY - rect.top - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        dragMovedRef.current = true;
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!dragStartRef.current) return;
      const canvas = mapInstance.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const end = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const start = dragStartRef.current;
      dragStartRef.current = null;

      (mapInstance as MapLibreMapInstance & { dragPan?: { enable?: () => void } }).dragPan?.enable?.();

      if (!dragMovedRef.current) {
        return;
      }

      dragMovedRef.current = false;
      skipClickRef.current = true;

      const bounds: [[number, number], [number, number]] = [
        [Math.min(start.x, end.x), Math.min(start.y, end.y)],
        [Math.max(start.x, end.x), Math.max(start.y, end.y)],
      ];

      let features: MapLibreGeoJSONFeature[] = [];
      try {
        features = mapInstance.queryRenderedFeatures(bounds, { layers: highlightLayerIds }) as MapLibreGeoJSONFeature[];
      } catch (error) {
        console.debug('[MapPreview] Failed to query box selection features', error);
        return;
      }

      const entries = features
        .map((feature) => buildHighlightEntry(feature))
        .filter((entry): entry is HighlightEntry => Boolean(entry));

      if (entries.length === 0) {
        onSelectionChange('clear', []);
        return;
      }

      onSelectionChange('box', entries);
    };

    const canvas = mapInstance.getCanvas();
    mapInstance.on('click', handleClick as (...args: unknown[]) => void);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    return () => {
      mapInstance.off('click', handleClick as (...args: unknown[]) => void);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      (mapInstance as MapLibreMapInstance & { dragPan?: { enable?: () => void } }).dragPan?.enable?.();
    };
  }, [buildHighlightEntry, highlightLayerIds, layerPriorityById, mapInstance, onSelectionChange, radius]);
};
