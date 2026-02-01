import type { NodeId } from '@hierarchidb/core-types';
import {
  type MapLibreMapInstance,
  type MapLibreStyle,
  type MapViewState,
} from '@hierarchidb/ui-map';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILT_IN_STYLES } from '../../common/constants/builtInStyles.js';
import type { BaseMapEntity } from '../../common/types/BaseMapEntity.js';
import { useBaseMapEntity } from '../hooks/useBaseMapEntity.js';
import { resolveMapStyleSource } from '../utils/mapStyle.js';

interface DemoFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: { name: string; nodeType: string };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }>;
}

export interface UseBaseMapDisplayParams {
  nodeId: NodeId;
  providedEntity?: BaseMapEntity;
  onLoad?: (map: MapLibreMapInstance) => void;
  onViewStateChange?: (viewState: MapViewState) => void;
  datasetId?: string;
  enableDemoOverlay: boolean;
}

export interface BaseMapStyleProps {
  mapStyleUrl?: string;
  mapStyleObject?: MapLibreStyle;
}

export const useBaseMapDisplay = ({
  nodeId,
  providedEntity,
  onLoad,
  onViewStateChange,
  datasetId,
  enableDemoOverlay,
}: UseBaseMapDisplayParams) => {
  const shouldFetch = !providedEntity && Boolean(nodeId);
  const {
    entity: fetchedEntity,
    loading: remoteLoading,
    error: remoteError,
  } = useBaseMapEntity(shouldFetch ? nodeId : null, {
    skip: !shouldFetch,
  });

  const entity = providedEntity ?? fetchedEntity ?? undefined;
  const [loading, setLoading] = useState(!providedEntity);
  const [error, setError] = useState<string | null>(null);
  const [_mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const unbindRef = useRef<null | (() => void)>(null);

  void datasetId;

  useEffect(() => {
    if (providedEntity) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(remoteLoading);
    setError(remoteError ? (remoteError.message ?? 'Failed to load map configuration') : null);
  }, [providedEntity, remoteLoading, remoteError]);

  const initialViewState = useMemo<MapViewState | undefined>(() => {
    if (!entity?.viewport) return undefined;

    return {
      longitude: entity.viewport.center[0],
      latitude: entity.viewport.center[1],
      zoom: entity.viewport.zoom,
      bearing: entity.viewport.bearing || 0,
      pitch: entity.viewport.pitch || 0,
    };
  }, [entity]);

  const mapStyleSource = useMemo<string | MapLibreStyle>(() => {
    if (!entity?.mapStyle) {
      return BUILT_IN_STYLES.streets.url;
    }
    return resolveMapStyleSource(entity.mapStyle);
  }, [entity?.mapStyle]);

  const mapStyleProps = useMemo<BaseMapStyleProps>(
    () =>
      typeof mapStyleSource === 'string'
        ? { mapStyleUrl: mapStyleSource }
        : { mapStyleObject: mapStyleSource },
    [mapStyleSource]
  );

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);

      map.once('styledata', () => {
        if (!enableDemoOverlay) return;
        const c = {
          lng: entity?.viewport?.center?.[0] ?? 0,
          lat: entity?.viewport?.center?.[1] ?? 0,
        } as { lng: number; lat: number };
        const dx = 0.05,
          dy = 0.03;
        const mkPoly = (cx: number, cy: number, w: number, h: number): [number, number][] => [
          [cx - w, cy - h],
          [cx + w, cy - h],
          [cx + w, cy + h],
          [cx - w, cy + h],
          [cx - w, cy - h],
        ];
        const demoData: DemoFeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'demo-1',
              properties: { name: 'Demo Area A', nodeType: 'basemap' },
              geometry: { type: 'Polygon', coordinates: [mkPoly(c.lng - 0.08, c.lat, dx, dy)] },
            },
            {
              type: 'Feature',
              id: 'demo-2',
              properties: { name: 'Demo Area B', nodeType: 'basemap' },
              geometry: { type: 'Polygon', coordinates: [mkPoly(c.lng + 0.08, c.lat, dx, dy)] },
            },
          ],
        };
        if (!map.getSource('demo-source')) {
          map.addSource('demo-source', { type: 'geojson', data: demoData });
        }
        if (!map.getLayer('demo-fill')) {
          map.addLayer({
            id: 'demo-fill',
            type: 'fill',
            source: 'demo-source',
            paint: {
              'fill-color': [
                'case',
                ['to-boolean', ['features-atoms', 'selected']],
                '#1976d2',
                ['to-boolean', ['features-atoms', 'hovered']],
                '#64b5f6',
                '#3f51b5',
              ],
              'fill-opacity': 0.25,
            },
          });
        }
        if (!map.getLayer('demo-outline')) {
          map.addLayer({
            id: 'demo-outline',
            type: 'line',
            source: 'demo-source',
            paint: {
              'line-color': [
                'case',
                ['to-boolean', ['features-atoms', 'selected']],
                '#0d47a1',
                ['to-boolean', ['features-atoms', 'hovered']],
                '#1976d2',
                '#283593',
              ],
              'line-width': [
                'case',
                ['to-boolean', ['features-atoms', 'selected']],
                3,
                ['to-boolean', ['features-atoms', 'hovered']],
                2.5,
                2,
              ],
            },
          });
        }
      });

      onLoad?.(map);
    },
    [enableDemoOverlay, entity?.viewport?.center, onLoad]
  );

  useEffect(() => {
    if (!_mapInstance) return;
    const unbind = unbindRef.current;
    return () => {
      unbind?.();
    };
  }, [_mapInstance]);

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      onViewStateChange?.(viewState);
    },
    [onViewStateChange]
  );

  return {
    entity,
    loading,
    error,
    initialViewState,
    mapStyleProps,
    handleMapLoad,
    handleViewStateChange,
  };
};
