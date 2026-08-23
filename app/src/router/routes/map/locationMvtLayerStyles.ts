import type { LocationType } from '@hierarchidb/location-store';
import type { MapLibreFilter, VectorTileLayerConfig } from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  DEFAULT_LAYER_SETS,
  LOCATION_POINTS_ENTRY_ID,
  LOCATION_SYMBOLS_ENTRY_ID,
} from '@hierarchidb/ui-plugin-shell/ui-map';

export const LOCATION_MVT_SOURCE_LAYER = 'location_points';
export const LOCATION_MVT_PROMOTE_ID = 'pointId';

const LOCATION_MVT_TYPE_COLORS: Record<LocationType, string> = {
  area_centroid: '#1f77b4',
  airport: '#ff7f0e',
  port: '#2ca02c',
  railway_station: '#d62728',
  interchange: '#9467bd',
};

const LOCATION_LABEL_ENTRY_ID = LOCATION_SYMBOLS_ENTRY_ID;

const locationTypeColorExpression = (): unknown[] => {
  const expression: unknown[] = ['match', ['get', 'type']];
  Object.entries(LOCATION_MVT_TYPE_COLORS).forEach(([type, color]) => {
    expression.push(type, color);
  });
  expression.push(LOCATION_MVT_TYPE_COLORS.area_centroid);
  return expression;
};

const locationIconImageExpression = (): unknown[] => {
  const expression: unknown[] = ['match', ['get', 'type']];
  Object.keys(LOCATION_MVT_TYPE_COLORS).forEach((type) => {
    expression.push(type, `location-icon-${type}`);
  });
  expression.push('location-icon-area_centroid');
  return expression;
};

const resolveLayerSetEntryPriority = (entryId: string): number => {
  const layerSet = DEFAULT_LAYER_SETS.find((set) => set.id === 'location');
  if (!layerSet) return 0;
  const index = layerSet.entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) return layerSet.priority * 100;
  return layerSet.priority * 100 + (layerSet.entries.length - index);
};

export type LocationMvtLayerKind = 'points' | 'icons' | 'labels';

export type LocationMvtLayerStyle = {
  kind: LocationMvtLayerKind;
  layerPriority: number;
  layerConfig: VectorTileLayerConfig;
};

export const buildLocationMvtLayerStyles = (
  baseLayerId: string,
  baseSourceId: string,
  visible: boolean,
  filter?: MapLibreFilter
): LocationMvtLayerStyle[] => [
  {
    kind: 'points',
    layerPriority: resolveLayerSetEntryPriority(LOCATION_POINTS_ENTRY_ID),
    layerConfig: {
      layerId: `${baseLayerId}-points`,
      sourceId: `${baseSourceId}-points`,
      layerType: 'circle',
      sourceLayer: LOCATION_MVT_SOURCE_LAYER,
      visible,
      filter,
      paint: {
        'circle-color': locationTypeColorExpression(),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 11, 8],
        'circle-opacity': 0.82,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 8, 1],
      },
    },
  },
  {
    kind: 'icons',
    layerPriority: resolveLayerSetEntryPriority(LOCATION_SYMBOLS_ENTRY_ID),
    layerConfig: {
      layerId: `${baseLayerId}-icons`,
      sourceId: `${baseSourceId}-icons`,
      layerType: 'symbol',
      sourceLayer: LOCATION_MVT_SOURCE_LAYER,
      minzoom: 3,
      visible,
      filter,
      layout: {
        'icon-image': locationIconImageExpression(),
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 11, 1.25],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'symbol-sort-key': ['get', 'renderRank'],
      },
    },
  },
  {
    kind: 'labels',
    layerPriority: resolveLayerSetEntryPriority(LOCATION_LABEL_ENTRY_ID) + 1,
    layerConfig: {
      layerId: `${baseLayerId}-labels`,
      sourceId: `${baseSourceId}-labels`,
      layerType: 'symbol',
      sourceLayer: LOCATION_MVT_SOURCE_LAYER,
      minzoom: 6,
      visible,
      filter,
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 12, 14],
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'symbol-sort-key': ['get', 'renderRank'],
      },
      paint: {
        'text-color': '#202124',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2,
      },
    },
  },
];

export const getLocationMvtTypeFilter = (enabledTypes: readonly LocationType[]): MapLibreFilter => [
  'in',
  ['get', 'type'],
  ['literal', enabledTypes],
];
