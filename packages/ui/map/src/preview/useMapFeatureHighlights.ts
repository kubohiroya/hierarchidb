import { useCallback, useEffect, useRef } from 'react';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '~/types/maplibre-public';
import { defaultFeatureIdAccessor } from '~/lib/feature-identification';

type MapLibreSourceWithType = { type?: string };
type MapLibreLayerWithSource = { source?: string; sourceLayer?: string; 'source-layer'?: string };

export type UseMapFeatureHighlightsParams<HighlightEntry extends { source: string; id: string | number; sourceLayer?: string; layerId?: string }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  searchMatches: HighlightEntry[];
  hoverMatches: HighlightEntry[];
  selectedMatches: HighlightEntry[];
  onViewportLayerIdsChange?: (layerIds: Map<string, Set<string | number>>) => void;
  onMissingLayers?: (layerIds: string[]) => void;
};

export const useMapFeatureHighlights = <HighlightEntry extends { source: string; id: string | number; sourceLayer?: string; layerId?: string }>({
  mapInstance,
  highlightLayerIds,
  searchMatches,
  hoverMatches,
  selectedMatches,
  onViewportLayerIdsChange,
  onMissingLayers,
}: UseMapFeatureHighlightsParams<HighlightEntry>): void => {
  const appliedSearchMatchesRef = useRef<HighlightEntry[]>([]);
  const appliedHoverRef = useRef<HighlightEntry[]>([]);
  const appliedSelectedRef = useRef<HighlightEntry[]>([]);
  const missingLayerTimerRef = useRef<number | null>(null);
  const lastMissingLayerIdsRef = useRef<string[]>([]);

  const resolveSourceLayer = useCallback((entry: HighlightEntry): string | undefined => {
    if (entry.sourceLayer) return entry.sourceLayer;
    if (!mapInstance || !entry.layerId || typeof mapInstance.getLayer !== 'function') return undefined;
    const layer = mapInstance.getLayer(entry.layerId) as MapLibreLayerWithSource | undefined;
    if (!layer) return undefined;
    if (layer.source && layer.source !== entry.source) return undefined;
    if (typeof layer.sourceLayer === 'string') return layer.sourceLayer;
    if (typeof layer['source-layer'] === 'string') return layer['source-layer'];
    return undefined;
  }, [mapInstance]);

  const isVectorSource = useCallback((sourceId: string): boolean => {
    if (!mapInstance || typeof mapInstance.getSource !== 'function') return false;
    const source = mapInstance.getSource(sourceId) as MapLibreSourceWithType | undefined;
    return source?.type === 'vector';
  }, [mapInstance]);

  const hasSource = useCallback((sourceId: string): boolean => {
    if (!mapInstance || typeof mapInstance.getSource !== 'function') return false;
    return Boolean(mapInstance.getSource(sourceId));
  }, [mapInstance]);

  const hasLayer = useCallback((layerId?: string): boolean => {
    if (!layerId) return true;
    if (!mapInstance || typeof mapInstance.getLayer !== 'function') return false;
    return Boolean(mapInstance.getLayer(layerId));
  }, [mapInstance]);

  const updateViewportFeatures = useCallback(() => {
    if (!mapInstance) return;
    if (typeof mapInstance.getLayer === 'function') {
      const missingLayerIds = highlightLayerIds.filter((layerId) => !mapInstance.getLayer(layerId));
      if (missingLayerIds.length > 0) {
        if (missingLayerTimerRef.current) {
          window.clearTimeout(missingLayerTimerRef.current);
        }
        missingLayerTimerRef.current = window.setTimeout(() => {
          if (!mapInstance) return;
          const stillMissing = highlightLayerIds.filter((layerId) => !mapInstance.getLayer(layerId));
          if (stillMissing.length === 0) return;
          lastMissingLayerIdsRef.current = stillMissing;
          onMissingLayers?.(stillMissing);
        }, 250);
        return;
      }
    }
    if (missingLayerTimerRef.current) {
      window.clearTimeout(missingLayerTimerRef.current);
      missingLayerTimerRef.current = null;
    }
    if (lastMissingLayerIdsRef.current.length > 0) {
      lastMissingLayerIdsRef.current = [];
      onMissingLayers?.([]);
    }
    if (!onViewportLayerIdsChange) return;
    const canvas = mapInstance.getCanvas();
    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = mapInstance.queryRenderedFeatures(
        [
          [0, 0],
          [canvas.width, canvas.height],
        ],
        { layers: highlightLayerIds },
      ) as MapLibreGeoJSONFeature[];
    } catch (error) {
      console.debug('[MapPreview] Failed to query viewport features', error);
      return;
    }

    const idsByLayer = new Map<string, Set<string | number>>();
    highlightLayerIds.forEach((layerId) => {
      idsByLayer.set(layerId, new Set());
    });

    for (const feature of features) {
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      if (!layerId) continue;
      if (!idsByLayer.has(layerId)) continue;
      const id = defaultFeatureIdAccessor(feature);
      if (id === undefined || id === null) continue;
      idsByLayer.get(layerId)?.add(id);
    }

    onViewportLayerIdsChange(idsByLayer);
  }, [highlightLayerIds, mapInstance, onMissingLayers, onViewportLayerIdsChange]);

  const clearHighlightKey = useCallback(
    (entry: HighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        if (typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()) return;
        if (!hasLayer(entry.layerId)) return;
        if (!hasSource(entry.source)) {
          console.debug('[MapPreview] Missing source for feature state', { source: entry.source, id: entry.id, layerId: entry.layerId });
          return;
        }
        const sourceLayer = resolveSourceLayer(entry);
        if (!sourceLayer && isVectorSource(entry.source)) {
          console.debug('[MapPreview] Missing sourceLayer for vector source', { source: entry.source, id: entry.id, layerId: entry.layerId });
          return;
        }
        const target = sourceLayer
          ? { source: entry.source, id: entry.id, key, sourceLayer }
          : { source: entry.source, id: entry.id, key };
        mapInstance.removeFeatureState(target);
      } catch (error) {
        console.debug('[MapPreview] Failed to clear feature-atoms', error);
      }
    },
    [hasLayer, hasSource, isVectorSource, mapInstance, resolveSourceLayer],
  );

  const applyHighlightKey = useCallback(
    (entry: HighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        if (typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()) return;
        if (!hasLayer(entry.layerId)) return;
        if (!hasSource(entry.source)) {
          console.debug('[MapPreview] Missing source for feature state', { source: entry.source, id: entry.id, layerId: entry.layerId });
          return;
        }
        const sourceLayer = resolveSourceLayer(entry);
        if (!sourceLayer && isVectorSource(entry.source)) {
          console.debug('[MapPreview] Missing sourceLayer for vector source', { source: entry.source, id: entry.id, layerId: entry.layerId });
          return;
        }
        const target = sourceLayer
          ? { source: entry.source, id: entry.id, sourceLayer }
          : { source: entry.source, id: entry.id };
        mapInstance.setFeatureState(target, { [key]: true });
      } catch (error) {
        console.debug('[MapPreview] Failed to set feature-atoms', error);
      }
    },
    [hasLayer, hasSource, isVectorSource, mapInstance, resolveSourceLayer],
  );

  useEffect(() => {
    if (!mapInstance || !onViewportLayerIdsChange) return;
    updateViewportFeatures();
    const handleViewportChange = () => updateViewportFeatures();
    mapInstance.on('moveend', handleViewportChange);
    mapInstance.on('zoomend', handleViewportChange);
    return () => {
      mapInstance.off('moveend', handleViewportChange);
      mapInstance.off('zoomend', handleViewportChange);
      if (missingLayerTimerRef.current) {
        window.clearTimeout(missingLayerTimerRef.current);
        missingLayerTimerRef.current = null;
      }
    };
  }, [mapInstance, onViewportLayerIdsChange, updateViewportFeatures]);

  useEffect(() => {
    if (!mapInstance) return;
    appliedSearchMatchesRef.current.forEach((entry) => {clearHighlightKey(entry, 'hdbSearch');});
    searchMatches.forEach((entry) => {applyHighlightKey(entry, 'hdbSearch');});
    appliedSearchMatchesRef.current = searchMatches;
  }, [applyHighlightKey, clearHighlightKey, mapInstance, searchMatches]);

  useEffect(() => {
    if (!mapInstance) return;
    appliedHoverRef.current.forEach((entry) => {clearHighlightKey(entry, 'hdbHover');});
    hoverMatches.forEach((entry) => {applyHighlightKey(entry, 'hdbHover');});
    appliedHoverRef.current = hoverMatches;
  }, [applyHighlightKey, clearHighlightKey, hoverMatches, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    appliedSelectedRef.current.forEach((entry) => {clearHighlightKey(entry, 'hdbSelected');});
    selectedMatches.forEach((entry) => {applyHighlightKey(entry, 'hdbSelected');});
    appliedSelectedRef.current = selectedMatches;
  }, [applyHighlightKey, clearHighlightKey, mapInstance, selectedMatches]);
};
