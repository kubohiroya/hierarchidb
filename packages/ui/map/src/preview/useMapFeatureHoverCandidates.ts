import { useEffect } from 'react';
import type {
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
} from '../types/maplibre-public.js';
import { defaultFeatureIdAccessor, resolveIdentifyCandidates } from '../lib/feature-identification.js';

export type UseMapFeatureHoverCandidatesParams<HighlightEntry extends { source: string; id: string | number }> = {
  mapInstance: MapLibreMapInstance | null;
  highlightLayerIds: string[];
  buildHighlightEntry: (feature?: MapLibreGeoJSONFeature | null) => HighlightEntry | null;
  radius?: number;
  onHoverChange: (entries: HighlightEntry[], features: MapLibreGeoJSONFeature[]) => void;
};

export const useMapFeatureHoverCandidates = <HighlightEntry extends { source: string; id: string | number }>({
  mapInstance,
  highlightLayerIds,
  buildHighlightEntry,
  radius = 6,
  onHoverChange,
}: UseMapFeatureHoverCandidatesParams<HighlightEntry>) => {
  useEffect(() => {
    if (!mapInstance) return undefined;
    const handleMouseMove = (event: MapLibreMapMouseEvent) => {
      const result = resolveIdentifyCandidates(mapInstance, event, {
        layerIds: highlightLayerIds,
        radius,
        getFeatureId: defaultFeatureIdAccessor,
      });
      const entries = result.features
        .map((feature) => buildHighlightEntry(feature))
        .filter((entry): entry is HighlightEntry => Boolean(entry));
      onHoverChange(entries, result.features);
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
  }, [buildHighlightEntry, highlightLayerIds, mapInstance, onHoverChange, radius]);
};
