import type { NodeId } from '@hierarchidb/core-types';
import {
  buildLocationMvtStyleExpressions,
  buildLocationVectorLayers,
} from '@hierarchidb/location-plugin/common';
import type {
  LocationIconConfig,
  LocationLabelConfig,
  LocationQueryAPI,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '@hierarchidb/location-api';
import type {
  LayerSetVisibility,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { useMemo } from 'react';
import { LOCATION_TYPE_COLORS, LOCATION_TYPE_OPTIONS } from './constants.js';
import type { LocationLayerEntry } from './useFolderLayers.js';

type UseLocationVectorLayersArgs = {
  enabled: boolean;
  locationLayers: LocationLayerEntry[];
  layerSetVisibility: LayerSetVisibility;
  enabledLocationKinds: LocationType[];
  maxZoom: number;
};

const LOCATION_TYPES = LOCATION_TYPE_OPTIONS.map((option) => option.id);

const buildDefaultRepresentationConfig = (
  maxZoom: number
): LocationRepresentationByZoomLevelConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      pointFromZoom: 0,
      polygonFromZoom: Math.round(maxZoom * 0.4),
      iconFromZoom: Math.round(maxZoom * 0.6),
      iconFixedFromZoom: Math.round(maxZoom * 0.8),
    };
    return acc;
  }, {} as LocationRepresentationByZoomLevelConfig);

const buildDefaultIconConfig = (): LocationIconConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: LOCATION_TYPE_COLORS[type],
      iconId:
        type === 'airport'
          ? 'flight_takeoff'
          : type === 'port'
            ? 'directions_boat'
            : type === 'railway_station'
              ? 'train'
              : type === 'interchange'
                ? 'fork_right'
                : 'location_city',
      sizeRange: [12, 28],
    };
    return acc;
  }, {} as LocationIconConfig);

const buildDefaultLabelConfig = (maxZoom: number): LocationLabelConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: LOCATION_TYPE_COLORS[type],
      zoomRange: [Math.round(maxZoom * 0.6), Math.round(maxZoom * 0.8)],
      sizeRange: [10, 18],
    };
    return acc;
  }, {} as LocationLabelConfig);

let locationQueryPromise: Promise<LocationQueryAPI> | null = null;

const getLocationQueryAPI = async () => {
  if (!locationQueryPromise) {
    locationQueryPromise = ensureWorkerAPI().then((api) => api.getLocationQueryAPI());
  }
  return locationQueryPromise;
};

export const useLocationVectorLayers = ({
  enabled,
  locationLayers,
  layerSetVisibility,
  enabledLocationKinds,
  maxZoom,
}: UseLocationVectorLayersArgs): ResourceVectorLayer[] =>
  useMemo(() => {
    if (!enabled) return [];
    if (!layerSetVisibility.location) return [];
    if (locationLayers.length === 0) return [];
    const representationConfig = buildDefaultRepresentationConfig(maxZoom);
    const iconConfig = buildDefaultIconConfig();
    const labelConfig = buildDefaultLabelConfig(maxZoom);
    const styles = buildLocationMvtStyleExpressions({
      locationTypes: LOCATION_TYPES,
      enabledLocationTypes: enabledLocationKinds,
      iconConfig,
      labelConfig,
      representationConfig,
      tilesMaxZoom: maxZoom,
      typeColors: LOCATION_TYPE_COLORS,
    });
    const dbName = getDBName(getBuildDatabasePrefix(), 'location');
    return locationLayers.flatMap((layer) =>
      buildLocationVectorLayers({
        nodeId: layer.nodeId as NodeId,
        sourceId: layer.sourceId,
        layerIdPrefix: layer.layerId,
        dbName,
        queryApiProvider: getLocationQueryAPI,
        styles,
        visible: true,
        absolutePath: layer.absolutePath,
        layerLabel: layer.absolutePath ?? layer.layerId,
      })
    );
  }, [enabled, enabledLocationKinds, layerSetVisibility.location, locationLayers, maxZoom]);
