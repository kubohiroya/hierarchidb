import type {
  LocationIconConfig,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '@hierarchidb/location-api';
import { describe, expect, it } from 'vitest';
import {
  buildLocationMvtStyleExpressions,
  LOCATION_MVT_PROMOTE_ID,
  LOCATION_MVT_SOURCE_LAYER,
} from '../locationMvtStyleExpressions.js';

const LOCATION_TYPES: LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

const TYPE_COLORS: Record<LocationType, string> = {
  area_centroid: '#1f77b4',
  airport: '#ff7f0e',
  port: '#2ca02c',
  railway_station: '#d62728',
  interchange: '#9467bd',
};

const buildIconConfig = (): LocationIconConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: TYPE_COLORS[type],
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
      sizeRange: [12, 24],
    };
    return acc;
  }, {} as LocationIconConfig);

const buildLabelConfig = (): LocationLabelConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: TYPE_COLORS[type],
      zoomRange: [6, 10],
      sizeRange: [10, 18],
    };
    return acc;
  }, {} as LocationLabelConfig);

const buildRepresentationConfig = (): LocationRepresentationByZoomLevelConfig =>
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      pointFromZoom: 0,
      polygonFromZoom: 4,
      iconFromZoom: 6,
      iconFixedFromZoom: 10,
    };
    return acc;
  }, {} as LocationRepresentationByZoomLevelConfig);

describe('buildLocationMvtStyleExpressions', () => {
  it('uses the canonical location MVT source contract constants', () => {
    expect(LOCATION_MVT_SOURCE_LAYER).toBe('location_points');
    expect(LOCATION_MVT_PROMOTE_ID).toBe('pointId');
  });

  it('builds icon and label expressions from render classification properties', () => {
    const styles = buildLocationMvtStyleExpressions({
      locationTypes: LOCATION_TYPES,
      enabledLocationTypes: ['airport', 'port'],
      iconConfig: buildIconConfig(),
      labelConfig: buildLabelConfig(),
      representationConfig: buildRepresentationConfig(),
      tilesMaxZoom: 12,
      typeColors: TYPE_COLORS,
    });

    expect(styles.iconImage).toEqual(['get', 'iconKey']);
    expect(styles.locationTypeFilter).toEqual([
      'in',
      ['get', 'type'],
      ['literal', ['airport', 'port']],
    ]);
    expect(styles.labelFilter).toEqual(['all', styles.locationTypeFilter, ['has', 'name']]);
    expect(styles.iconSize.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(styles.labelSize.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
  });

  it('rejects invalid zoom ranges instead of clamping them', () => {
    const labelConfig = buildLabelConfig();
    labelConfig.airport = {
      ...labelConfig.airport,
      zoomRange: [13, 6],
    };

    expect(() =>
      buildLocationMvtStyleExpressions({
        locationTypes: LOCATION_TYPES,
        iconConfig: buildIconConfig(),
        labelConfig,
        representationConfig: buildRepresentationConfig(),
        tilesMaxZoom: 12,
        typeColors: TYPE_COLORS,
      })
    ).toThrow('[location mvt style] airport.labelConfig.zoomRange must be ordered within 0..12');
  });

  it('accepts the maximum configured label size before applying the internal preview scale', () => {
    const labelConfig = buildLabelConfig();
    labelConfig.airport = {
      ...labelConfig.airport,
      sizeRange: [24, 32],
    };

    const styles = buildLocationMvtStyleExpressions({
      locationTypes: LOCATION_TYPES,
      iconConfig: buildIconConfig(),
      labelConfig,
      representationConfig: buildRepresentationConfig(),
      tilesMaxZoom: 12,
      typeColors: TYPE_COLORS,
    });

    expect(JSON.stringify(styles.labelSize)).toContain('41.6');
  });
});
