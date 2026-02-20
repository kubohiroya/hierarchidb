import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  type MapLibreMapInstance,
  type MapLibreStyle,
  type MapViewState,
} from '@hierarchidb/ui-map';
import { atom, type PrimitiveAtom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MapStyle, MapViewport } from '~/common/types/BaseMapEntity';
import { resolveMapStyleSource } from '~/ui/utils/mapStyle';

export interface ViewportStepParams {
  value: MapViewport | undefined;
  mapStyle?: MapStyle;
  onChange: (next: MapViewport) => void;
}

const FALLBACK_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const OSM_RASTER_STYLE = {
  version: 8,
  name: 'osm-basemap',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

const areViewStatesEqual = (a: MapViewState, b: MapViewState) => {
  const eps = 1e-6;
  return (
    Math.abs(a.longitude - b.longitude) < eps &&
    Math.abs(a.latitude - b.latitude) < eps &&
    Math.abs(a.zoom - b.zoom) < eps &&
    Math.abs((a.bearing ?? 0) - (b.bearing ?? 0)) < eps
  );
};

export const useViewportStep = ({ value, mapStyle, onChange }: ViewportStepParams) => {
  const { t } = useTranslation('basemap-plugin');
  const controlId = useId();
  type AtomStore = ReturnType<typeof createStore>;
  const initial = useMemo<MapViewState>(
    () => ({
      longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
      latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
      zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
      bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
      pitch: 0,
    }),
    [value]
  );

  const [viewState, setViewState] = useState<MapViewState>(initial);
  const [canRenderMap, setCanRenderMap] = useState(false);
  const lastEmittedRef = useRef<MapViewState>(initial);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const dragStoreRef = useRef<AtomStore>(createStore());
  const dragAtomRef = useRef<PrimitiveAtom<MapViewState>>(atom(initial));

  const setDragViewState = useCallback((next: MapViewState) => {
    dragStoreRef.current.set(dragAtomRef.current, next);
  }, []);

  useEffect(() => {
    setCanRenderMap(true);
  }, []);

  useEffect(() => {
    const next: MapViewState = {
      longitude: value?.center[0] ?? FALLBACK_VIEWPORT.center[0],
      latitude: value?.center[1] ?? FALLBACK_VIEWPORT.center[1],
      zoom: value?.zoom ?? FALLBACK_VIEWPORT.zoom,
      bearing: value?.bearing ?? FALLBACK_VIEWPORT.bearing,
      pitch: 0,
    };
    setViewState((prev) => (areViewStatesEqual(prev, next) ? prev : next));
    setDragViewState(next);
    lastEmittedRef.current = next;
    if (mapRef.current) {
      const mapState: MapViewState = {
        longitude: mapRef.current.getCenter().lng,
        latitude: mapRef.current.getCenter().lat,
        zoom: mapRef.current.getZoom(),
        bearing: mapRef.current.getBearing(),
        pitch: mapRef.current.getPitch(),
      };
      if (!areViewStatesEqual(mapState, next)) {
        mapRef.current.jumpTo({
          center: [next.longitude, next.latitude],
          zoom: next.zoom,
          bearing: next.bearing ?? 0,
          pitch: 0,
        });
      }
    }
  }, [setDragViewState, value]);

  const mapStyleSource = useMemo(() => {
    if (mapStyle) return resolveMapStyleSource(mapStyle);
    return OSM_RASTER_STYLE as unknown as MapLibreStyle;
  }, [mapStyle]);

  const mapStyleProps = useMemo(
    () =>
      typeof mapStyleSource === 'string'
        ? { mapStyleUrl: mapStyleSource }
        : { mapStyleObject: mapStyleSource },
    [mapStyleSource]
  );

  const mapInteractionOptions = useMemo(
    () => ({
      interactive: true,
      scrollZoom: true,
      dragPan: true,
      dragRotate: false,
      doubleClickZoom: true,
      touchZoomRotate: true,
    }),
    []
  );

  const navigationControls = useMemo(
    () => ({ navigation: { position: 'top-right' as const } }),
    []
  );

  const commitViewState = useCallback(
    (next: MapViewState, source: 'form' | 'map-end') => {
      setViewState((prev) => {
        if (areViewStatesEqual(prev, next)) return prev;
        return next;
      });
      if (areViewStatesEqual(lastEmittedRef.current, next)) return;
      lastEmittedRef.current = next;
      if (source === 'form' && mapRef.current) {
        mapRef.current.jumpTo({
          center: [next.longitude, next.latitude],
          zoom: next.zoom,
          bearing: next.bearing ?? 0,
          pitch: 0,
        });
      }
      onChange({
        center: [next.longitude, next.latitude],
        zoom: next.zoom,
        bearing: next.bearing ?? 0,
        pitch: 0,
      });
    },
    [onChange]
  );

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    mapRef.current = map;
  }, []);

  const handleViewStateChange = useCallback(
    (next: MapViewState) => {
      setDragViewState(next);
      setViewState((prev) => (areViewStatesEqual(prev, next) ? prev : next));
    },
    [setDragViewState]
  );

  const handleViewStateChangeEnd = useCallback(
    (next: MapViewState) => {
      setDragViewState(next);
      const latest = dragStoreRef.current.get(dragAtomRef.current);
      commitViewState(latest ?? next, 'map-end');
    },
    [commitViewState, setDragViewState]
  );

  const setViewportFromInput = useCallback(
    (next: Partial<MapViewport>) => {
      const updated: MapViewState = {
        longitude: next.center?.[0] ?? viewState.longitude,
        latitude: next.center?.[1] ?? viewState.latitude,
        zoom: next.zoom ?? viewState.zoom,
        bearing: next.bearing ?? viewState.bearing ?? 0,
        pitch: 0,
      };
      commitViewState(updated, 'form');
    },
    [commitViewState, viewState]
  );

  const formatCoord = (val: number, digits: number = 4) => {
    if (!Number.isFinite(val)) return '0.0000';
    return val.toFixed(digits);
  };

  return {
    t,
    controlId,
    initial,
    viewState,
    canRenderMap,
    mapStyleProps,
    mapInteractionOptions,
    navigationControls,
    handleMapLoad,
    handleViewStateChange,
    handleViewStateChangeEnd,
    setViewportFromInput,
    formatCoord,
  };
};
