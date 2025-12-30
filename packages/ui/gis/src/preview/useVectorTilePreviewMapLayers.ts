import { useEffect } from 'react';
import type { Theme } from '@mui/material/styles';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';

type MapLibreInteractiveMap = MapLibreMapInstance & {
  on(event: string, cb: (...args: unknown[]) => void): void;
  on(event: string, layerId: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, layerId: string, cb: (...args: unknown[]) => void): void;
  setFilter(layerId: string, filter: unknown): void;
  getLayer(id: string): unknown;
  addLayer(layer: unknown, beforeId?: string): void;
};

type Args = {
  mapInstance: MapLibreMapInstance | null;
  baseLayerId: string;
  baseSourceId: string;
  tilesLayer: string;
  matchedIds: string[];
  selectedIds: string[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  invalidFeatureIds?: string[];
  featureIdProperty?: string;
  theme: Theme;
};

export const useVectorTilePreviewMapLayers = ({
  mapInstance,
  baseLayerId,
  baseSourceId,
  tilesLayer,
  matchedIds,
  selectedIds,
  hoveredId,
  setHoveredId,
  theme,
  invalidFeatureIds = [],
  featureIdProperty,
}: Args) => {
  const idProperty = featureIdProperty ?? 'id';
  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    const baseId = baseLayerId;
    const sourceId = baseSourceId;
    const sourceLayer = tilesLayer;
    const layerType = 'fill';
    const hasStyle = () =>
      Boolean(typeof map.getStyle === 'function' ? map.getStyle() : (map as { style?: unknown }).style);

    const ensureLayer = (id: string, color: string, opacity: number) => {
      if (!hasStyle()) return;
      if (!map.getLayer(baseId) || map.getLayer(id)) return;
      map.addLayer(
        {
          id,
          type: layerType,
          source: sourceId,
          paint: {
            'fill-color': color,
            'fill-opacity': opacity,
            'fill-outline-color': color,
          },
          filter: ['==', ['get', idProperty], '__none__'],
          'source-layer': sourceLayer,
        },
        undefined,
      );
    };

    const handleIdle = () => {
      if (!hasStyle()) return;
      if (!map.getLayer(baseId)) return;
      ensureLayer(`${baseId}-invalid`, theme.palette.error.main, 0.55);
      ensureLayer(`${baseId}-matched`, theme.palette.secondary.light, 0.45);
      ensureLayer(`${baseId}-selected`, theme.palette.primary.main, 0.5);
      ensureLayer(`${baseId}-hovered`, theme.palette.action.hover, 0.6);
    };

    map.on('idle', handleIdle);
    handleIdle();
    return () => {
      map.off('idle', handleIdle);
    };
  }, [baseLayerId, baseSourceId, idProperty, mapInstance, theme.palette, tilesLayer]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    const hasStyle = () =>
      Boolean(typeof map.getStyle === 'function' ? map.getStyle() : (map as { style?: unknown }).style);
    const updateFilter = (id: string, ids: string[]) => {
      if (!hasStyle()) return;
      if (!map.getLayer(id)) return;
      if (!ids.length) {
        map.setFilter(id, ['==', ['get', idProperty], '__none__']);
        return;
      }
      map.setFilter(id, ['in', ['get', idProperty], ['literal', ids]]);
    };
    updateFilter(`${baseLayerId}-invalid`, invalidFeatureIds);
    updateFilter(`${baseLayerId}-matched`, matchedIds);
    updateFilter(`${baseLayerId}-selected`, selectedIds);
    updateFilter(`${baseLayerId}-hovered`, hoveredId ? [hoveredId] : []);
  }, [baseLayerId, hoveredId, idProperty, invalidFeatureIds, mapInstance, matchedIds, selectedIds]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreInteractiveMap;
    const hasStyle = () =>
      Boolean(typeof map.getStyle === 'function' ? map.getStyle() : (map as { style?: unknown }).style);
    let attached = false;
    const handleMouseMove = (...args: unknown[]) => {
      const event = args[0] as { features?: Array<{ id?: unknown; properties?: Record<string, unknown> }> };
      const feature = event?.features?.[0];
      if (feature?.properties) {
        console.debug('[ShapePreview] hover properties', feature.properties);
      }
      const featureId = feature
        ? String(feature.properties?.[idProperty] ?? feature.properties?.id ?? feature.id ?? '')
        : '';
      setHoveredId(featureId || null);
    };
    const handleMouseLeave = () => {
      setHoveredId(null);
    };
    const ensureHandlers = () => {
      if (!hasStyle()) return;
      if (attached || !map.getLayer(baseLayerId)) return;
      map.on('mousemove', baseLayerId, handleMouseMove);
      map.on('mouseleave', baseLayerId, handleMouseLeave);
      attached = true;
    };
    map.on('idle', ensureHandlers);
    ensureHandlers();
    return () => {
      map.off('idle', ensureHandlers);
      if (attached) {
        map.off('mousemove', baseLayerId, handleMouseMove);
        map.off('mouseleave', baseLayerId, handleMouseLeave);
      }
    };
  }, [baseLayerId, idProperty, mapInstance, setHoveredId]);
};
