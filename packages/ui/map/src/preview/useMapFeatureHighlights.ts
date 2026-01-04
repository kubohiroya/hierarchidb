import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { MapFeatureIdentifyResult } from '../types/unified-map-props.js';
import type {
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
} from '../types/maplibre-public.js';
import {
  defaultFeatureIdAccessor,
  resolveIdentifyCandidates,
} from '../lib/feature-identification.js';

export type UseMapFeatureHighlightsParams<HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  searchMatches: HighlightEntry[];
  hoverMatch: HighlightEntry | null;
  selectedMatch: HighlightEntry | null;
  setHoverMatch: (entry: HighlightEntry | null) => void;
  setSelectedMatch: (entry: HighlightEntry | null) => void;
  onViewportLayerIdsChange?: (layerIds: Map<string, Set<string | number>>) => void;
};

export type UseMapFeatureHighlightsResult<HighlightEntry> = {
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  handleIdentify: (result: MapFeatureIdentifyResult) => void;
};

export const useMapFeatureHighlights = <HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  buildHighlightEntry,
  searchMatches,
  hoverMatch,
  selectedMatch,
  setHoverMatch,
  setSelectedMatch,
  onViewportLayerIdsChange,
}: UseMapFeatureHighlightsParams<HighlightEntry>): UseMapFeatureHighlightsResult<HighlightEntry> => {
  const appliedSearchMatchesRef = useRef<HighlightEntry[]>([]);
  const appliedHoverRef = useRef<HighlightEntry | null>(null);
  const appliedSelectedRef = useRef<HighlightEntry | null>(null);

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

  const setSingleHighlight = useCallback(
    (
      ref: MutableRefObject<HighlightEntry | null>,
      key: 'hdbHover' | 'hdbSelected',
      next: HighlightEntry | null,
    ) => {
      const current = ref.current;
      if (current && (!next || current.source !== next.source || current.id !== next.id)) {
        clearHighlightKey(current, key);
      }
      if (next) {
        applyHighlightKey(next, key);
      }
      ref.current = next;
    },
    [applyHighlightKey, clearHighlightKey],
  );

  const handleIdentify = useCallback(
    (result: MapFeatureIdentifyResult) => {
      const entry = buildHighlightEntry(result.features[0]);
      setSelectedMatch(entry);
    },
    [buildHighlightEntry, setSelectedMatch],
  );

  useEffect(() => {
    if (!mapInstance) return undefined;
    const handleMouseMove = (event: MapLibreMapMouseEvent) => {
      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: highlightLayerIds,
        radius: 6,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const entry = buildHighlightEntry(result.features[0]);
      setHoverMatch(entry);
    };

    const handleMouseLeave = () => {
      setHoverMatch(null);
    };

    const canvas = mapInstance.getCanvas();
    mapInstance.on('mousemove', handleMouseMove as (...args: unknown[]) => void);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      mapInstance.off('mousemove', handleMouseMove as (...args: unknown[]) => void);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [buildHighlightEntry, highlightLayerIds, mapInstance, setHoverMatch]);

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
    setSingleHighlight(appliedHoverRef, 'hdbHover', hoverMatch);
  }, [hoverMatch, mapInstance, setSingleHighlight]);

  useEffect(() => {
    if (!mapInstance) return;
    setSingleHighlight(appliedSelectedRef, 'hdbSelected', selectedMatch);
  }, [mapInstance, selectedMatch, setSingleHighlight]);

  return {
    buildHighlightEntry,
    handleIdentify,
  };
};
