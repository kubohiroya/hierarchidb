import type { NodeId } from '@hierarchidb/core-types';
import type { LocationQueryAPI, LocationType } from '@hierarchidb/location-api';
import type { ResourceVectorLayer } from '@hierarchidb/ui-map';
import {
  LOCATION_MVT_CIRCLE_LAYER_ID,
  LOCATION_MVT_ICON_LAYER_ID,
  LOCATION_MVT_LABEL_LAYER_ID,
  LOCATION_MVT_PROMOTE_ID,
  LOCATION_MVT_SOURCE_LAYER,
  type LocationMvtStyleExpressions,
} from './locationMvtStyleExpressions.js';

export type BuildLocationVectorLayersArgs = {
  nodeId: NodeId | string;
  sourceId: string;
  layerIdPrefix?: string;
  dbName: string;
  queryApiProvider: () => Promise<LocationQueryAPI>;
  styles: LocationMvtStyleExpressions;
  visible?: boolean;
  absolutePath?: string;
  layerPriorityBase?: number;
  layerLabel?: string;
  minzoom?: number;
  maxzoom?: number;
};

const toLayerId = (prefix: string | undefined, layerId: string): string =>
  prefix ? `${prefix}-${layerId}` : layerId;

export const buildLocationVectorLayers = ({
  nodeId,
  sourceId,
  layerIdPrefix,
  dbName,
  queryApiProvider,
  styles,
  visible = true,
  absolutePath,
  layerPriorityBase = 300,
  layerLabel,
  minzoom = 0,
  maxzoom = 22,
}: BuildLocationVectorLayersArgs): ResourceVectorLayer[] => {
  const stringNodeId = String(nodeId);
  const tileDataProvider = async (
    z: number,
    x: number,
    y: number,
    tileNodeId?: string
  ): Promise<ArrayBuffer | null> => {
    const api = await queryApiProvider();
    return api.getVectorTile((tileNodeId ?? stringNodeId) as NodeId, z, x, y);
  };
  const baseLayer = {
    nodeId: stringNodeId,
    nodeType: 'location' as const,
    dbName,
    tileDataProvider,
    promoteId: LOCATION_MVT_PROMOTE_ID,
    absolutePath,
    layerSetId: 'location' as const,
    layerLabel: layerLabel ?? absolutePath ?? stringNodeId,
  };

  return [
    {
      ...baseLayer,
      layerPriority: layerPriorityBase + 2,
      layerConfig: {
        layerId: toLayerId(layerIdPrefix, LOCATION_MVT_CIRCLE_LAYER_ID),
        sourceId,
        sourceLayer: LOCATION_MVT_SOURCE_LAYER,
        layerType: 'circle',
        minzoom,
        maxzoom,
        visible,
        filter: styles.locationTypeFilter,
        paint: {
          'circle-radius': styles.circleRadius,
          'circle-color': styles.circleColor,
          'circle-opacity': 0.8,
        },
      },
    },
    {
      ...baseLayer,
      layerPriority: layerPriorityBase + 1,
      layerConfig: {
        layerId: toLayerId(layerIdPrefix, LOCATION_MVT_ICON_LAYER_ID),
        sourceId,
        sourceLayer: LOCATION_MVT_SOURCE_LAYER,
        layerType: 'symbol',
        minzoom,
        maxzoom,
        visible,
        filter: styles.locationTypeFilter,
        layout: {
          'icon-image': styles.iconImage,
          'icon-size': styles.iconSize,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
    },
    {
      ...baseLayer,
      layerPriority: layerPriorityBase,
      layerConfig: {
        layerId: toLayerId(layerIdPrefix, LOCATION_MVT_LABEL_LAYER_ID),
        sourceId,
        sourceLayer: LOCATION_MVT_SOURCE_LAYER,
        layerType: 'symbol',
        minzoom,
        maxzoom,
        visible,
        filter: styles.labelFilter,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': styles.labelSize,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': styles.labelColor,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
          'text-opacity': styles.labelOpacity,
        },
      },
    },
  ];
};

export type LocationVectorLayerLocationType = LocationType;
