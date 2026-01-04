import { useCallback, useEffect, useRef } from 'react';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '../types/maplibre-public.js';
import { defaultFeatureIdAccessor } from '../lib/feature-identification.js';

export type UseMapFeatureHighlightsParams<HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  searchMatches: HighlightEntry[];
  hoverMatches: HighlightEntry[];
  selectedMatches: HighlightEntry[];
  onViewportLayerIdsChange?: (layerIds: Map<string, Set<string | number>>) => void;
};

export const useMapFeatureHighlights = <HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  searchMatches,
  hoverMatches,
  selectedMatches,
  onViewportLayerIdsChange,
}: UseMapFeatureHighlightsParams<HighlightEntry>): void => {
  const appliedSearchMatchesRef = useRef<HighlightEntry[]>([]);
  const appliedHoverRef = useRef<HighlightEntry[]>([]);
  const appliedSelectedRef = useRef<HighlightEntry[]>([]);

  const updateViewportFeatures = useCallback(() => {
    if (!mapInstance || !onViewportLayerIdsChange) return;
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
  }, [highlightLayerIds, mapInstance, onViewportLayerIdsChange]);

  const clearHighlightKey = useCallback(
    (entry: HighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.removeFeatureState({ source: entry.source, id: entry.id, key });
      } catch (error) {
        console.debug('[MapPreview] Failed to clear feature-state', error);
      }
    },
    [mapInstance],
  );

  const applyHighlightKey = useCallback(
    (entry: HighlightEntry | null, key: 'hdbSearch' | 'hdbHover' | 'hdbSelected') => {
      if (!mapInstance || !entry) return;
      try {
        mapInstance.setFeatureState({ source: entry.source, id: entry.id }, { [key]: true });
      } catch (error) {
        console.debug('[MapPreview] Failed to set feature-state', error);
      }
    },
    [mapInstance],
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
