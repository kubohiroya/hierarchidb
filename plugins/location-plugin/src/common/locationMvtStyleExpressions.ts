import type {
  LocationIconConfig,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '@hierarchidb/location-api';

export const LOCATION_MVT_SOURCE_LAYER = 'location_points' as const;
export const LOCATION_MVT_PROMOTE_ID = 'pointId' as const;
export const LOCATION_MVT_CIRCLE_LAYER_ID = 'location-points-circle' as const;
export const LOCATION_MVT_ICON_LAYER_ID = 'location-points-icon' as const;
export const LOCATION_MVT_LABEL_LAYER_ID = 'location-points-label' as const;

const ICON_BASE_PX = 24;
const MIN_ZOOM_LEVEL = 0;
const MIN_ICON_SIZE = 8;
const MAX_ICON_SIZE = 48;
const MIN_LABEL_SIZE = 8;
const MAX_LABEL_SIZE = 32;
const LABEL_SIZE_SCALE = 1.3;

export type LocationMvtStyleExpressions = {
  locationTypeFilter?: unknown[];
  labelFilter: unknown[];
  circleRadius: unknown[];
  circleColor: unknown[];
  iconImage: unknown[];
  iconSize: unknown[];
  labelColor: unknown[];
  labelSize: unknown[];
  labelOpacity: unknown[];
};

export type BuildLocationMvtStyleExpressionsArgs = {
  locationTypes: readonly LocationType[];
  enabledLocationTypes?: readonly string[];
  iconConfig: LocationIconConfig;
  labelConfig: LocationLabelConfig;
  representationConfig: LocationRepresentationByZoomLevelConfig;
  tilesMaxZoom: number;
  typeColors: Record<LocationType, string>;
};

type ZoomScaledMatchConfig = {
  startZoom: number;
  fixedZoom: number;
  minValue: number;
  maxValue: number;
};

type ThresholdZoomMatchConfig = ZoomScaledMatchConfig & {
  baseStartZoom: number;
};

const requireFiniteNumber = (label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[location mvt style] ${label} must be a finite number`);
  }
  return value;
};

const requireRange = (
  label: string,
  value: readonly number[] | number,
  min: number,
  max: number
): [number, number] => {
  const range = Array.isArray(value) ? value : [value, value];
  if (range.length !== 2) {
    throw new Error(`[location mvt style] ${label} must have exactly two values`);
  }
  const first = requireFiniteNumber(`${label}[0]`, range[0]);
  const second = requireFiniteNumber(`${label}[1]`, range[1]);
  if (first < min || first > max || second < min || second > max || first > second) {
    throw new Error(`[location mvt style] ${label} must be ordered within ${min}..${max}`);
  }
  return [first, second];
};

const requireZoom = (label: string, value: unknown, maxZoom: number): number => {
  const zoom = requireFiniteNumber(label, value);
  if (zoom < MIN_ZOOM_LEVEL || zoom > maxZoom) {
    throw new Error(`[location mvt style] ${label} must be within ${MIN_ZOOM_LEVEL}..${maxZoom}`);
  }
  return zoom;
};

const requireTypeCoverage = <T>(
  label: string,
  config: Record<LocationType, T>,
  locationTypes: readonly LocationType[]
): void => {
  locationTypes.forEach((type) => {
    if (!config[type]) {
      throw new Error(`[location mvt style] ${label}.${type} is required`);
    }
  });
};

const buildTypeMatchExpression = (
  propertyName: string,
  entries: Array<[LocationType, unknown]>,
  fallback: unknown
): unknown[] => {
  const expression: unknown[] = ['match', ['get', propertyName]];
  entries.forEach(([type, value]) => {
    expression.push(type, value);
  });
  expression.push(fallback);
  return expression;
};

const buildCategoryFilter = (
  enabledLocationTypes: readonly string[] | undefined,
  locationTypes: readonly LocationType[]
): unknown[] | undefined => {
  if (!enabledLocationTypes) return undefined;
  if (enabledLocationTypes.length === 0) return ['in', ['get', 'type'], ['literal', []]];
  const allowed = enabledLocationTypes.filter((type): type is LocationType =>
    locationTypes.includes(type as LocationType)
  );
  if (allowed.length === locationTypes.length) return undefined;
  return ['in', ['get', 'type'], ['literal', allowed]];
};

const buildZoomScaledMatchExpression = (
  entries: Array<[LocationType, ZoomScaledMatchConfig]>,
  fallback: number,
  minZoom: number,
  maxZoom: number
): unknown[] => {
  const stops = new Set<number>([minZoom, maxZoom]);
  entries.forEach(([, config]) => {
    stops.add(config.startZoom);
    stops.add(config.fixedZoom);
  });
  const sortedStops = Array.from(stops).sort((a, b) => a - b);
  const sizeAtZoom = (config: ZoomScaledMatchConfig, zoom: number) => {
    if (zoom < config.startZoom) return 0;
    if (zoom >= config.fixedZoom) return config.maxValue;
    if (config.fixedZoom === config.startZoom) return config.maxValue;
    const ratio = (zoom - config.startZoom) / (config.fixedZoom - config.startZoom);
    return config.minValue + (config.maxValue - config.minValue) * ratio;
  };
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  sortedStops.forEach((zoom) => {
    expression.push(
      zoom,
      buildTypeMatchExpression(
        'type',
        entries.map(([type, config]) => [type, sizeAtZoom(config, zoom)]),
        fallback
      )
    );
  });
  return expression;
};

const buildThresholdedZoomMatchExpression = (
  entries: Array<[LocationType, ThresholdZoomMatchConfig]>,
  fallback: number,
  minZoom: number,
  maxZoom: number
): unknown[] => {
  const stops = new Set<number>([minZoom, maxZoom]);
  entries.forEach(([, config]) => {
    stops.add(config.startZoom);
    if (config.startZoom + 1 <= maxZoom) {
      stops.add(config.startZoom + 1);
    }
    stops.add(config.fixedZoom);
  });
  const sortedStops = Array.from(stops).sort((a, b) => a - b);
  const sizeAtZoom = (config: ThresholdZoomMatchConfig, zoom: number) => {
    if (zoom <= config.startZoom) return 0;
    const denominator = config.fixedZoom - config.baseStartZoom;
    if (denominator <= 0) return config.maxValue;
    const boundedZoom = Math.min(Math.max(zoom, config.baseStartZoom), config.fixedZoom);
    const ratio = (boundedZoom - config.baseStartZoom) / denominator;
    return config.minValue + (config.maxValue - config.minValue) * ratio;
  };
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  sortedStops.forEach((zoom) => {
    expression.push(
      zoom,
      buildTypeMatchExpression(
        'type',
        entries.map(([type, config]) => [type, sizeAtZoom(config, zoom)]),
        fallback
      )
    );
  });
  return expression;
};

const toIconScaleRange = (sizeRange: [number, number]): [number, number] => [
  sizeRange[0] / ICON_BASE_PX,
  sizeRange[1] / ICON_BASE_PX,
];

export const buildLocationMvtStyleExpressions = ({
  locationTypes,
  enabledLocationTypes,
  iconConfig,
  labelConfig,
  representationConfig,
  tilesMaxZoom,
  typeColors,
}: BuildLocationMvtStyleExpressionsArgs): LocationMvtStyleExpressions => {
  const maxZoom = requireZoom('tilesMaxZoom', tilesMaxZoom, 24);
  requireTypeCoverage('iconConfig', iconConfig, locationTypes);
  requireTypeCoverage('labelConfig', labelConfig, locationTypes);
  requireTypeCoverage('representationConfig', representationConfig, locationTypes);

  const locationTypeFilter = buildCategoryFilter(enabledLocationTypes, locationTypes);
  const labelFilter = locationTypeFilter
    ? ['all', locationTypeFilter, ['has', 'name']]
    : ['has', 'name'];

  const circleRadiusEntries: Array<[LocationType, ThresholdZoomMatchConfig]> = locationTypes.map(
    (type) => {
      const rep = representationConfig[type];
      return [
        type,
        {
          startZoom: requireZoom(`${type}.pointFromZoom`, rep.pointFromZoom, maxZoom),
          baseStartZoom: MIN_ZOOM_LEVEL,
          fixedZoom: Math.min(11, maxZoom),
          minValue: 2,
          maxValue: 8.6,
        },
      ];
    }
  );

  const iconSizeEntries: Array<[LocationType, ZoomScaledMatchConfig]> = locationTypes.map(
    (type) => {
      const rep = representationConfig[type];
      const startZoom = requireZoom(`${type}.iconFromZoom`, rep.iconFromZoom, maxZoom);
      const fixedZoom = requireZoom(`${type}.iconFixedFromZoom`, rep.iconFixedFromZoom, maxZoom);
      if (fixedZoom < startZoom) {
        throw new Error(`[location mvt style] ${type}.iconFixedFromZoom must be >= iconFromZoom`);
      }
      const range = requireRange(
        `${type}.iconConfig.sizeRange`,
        iconConfig[type].sizeRange,
        MIN_ICON_SIZE,
        MAX_ICON_SIZE
      );
      const [minScale, maxScale] = toIconScaleRange(range);
      return [type, { startZoom, fixedZoom, minValue: minScale, maxValue: maxScale }];
    }
  );

  const labelSizeEntries: Array<[LocationType, ZoomScaledMatchConfig]> = locationTypes.map(
    (type) => {
      const entry = labelConfig[type];
      const zoomRange = requireRange(
        `${type}.labelConfig.zoomRange`,
        entry.zoomRange,
        MIN_ZOOM_LEVEL,
        maxZoom
      );
      const baseRange = requireRange(
        `${type}.labelConfig.sizeRange`,
        entry.sizeRange,
        MIN_LABEL_SIZE,
        MAX_LABEL_SIZE
      );
      const scaledRange: [number, number] = [
        baseRange[0] * LABEL_SIZE_SCALE,
        baseRange[1] * LABEL_SIZE_SCALE,
      ];
      return [
        type,
        {
          startZoom: zoomRange[0],
          fixedZoom: zoomRange[1],
          minValue: scaledRange[0],
          maxValue: scaledRange[1],
        },
      ];
    }
  );

  const labelOpacityEntries: Array<[LocationType, ThresholdZoomMatchConfig]> = locationTypes.map(
    (type) => {
      const zoomRange = requireRange(
        `${type}.labelConfig.zoomRange`,
        labelConfig[type].zoomRange,
        MIN_ZOOM_LEVEL,
        maxZoom
      );
      return [
        type,
        {
          startZoom: zoomRange[0],
          fixedZoom: Math.min(zoomRange[0] + 1, maxZoom),
          baseStartZoom: MIN_ZOOM_LEVEL,
          minValue: 0,
          maxValue: 1,
        },
      ];
    }
  );

  return {
    locationTypeFilter,
    labelFilter,
    circleRadius: buildThresholdedZoomMatchExpression(
      circleRadiusEntries,
      0,
      MIN_ZOOM_LEVEL,
      maxZoom
    ),
    circleColor: buildTypeMatchExpression(
      'type',
      locationTypes.map((type) => [type, iconConfig[type].color ?? typeColors[type]]),
      typeColors.area_centroid
    ),
    iconImage: ['get', 'iconKey'],
    iconSize: buildZoomScaledMatchExpression(iconSizeEntries, 0, MIN_ZOOM_LEVEL, maxZoom),
    labelColor: buildTypeMatchExpression(
      'type',
      locationTypes.map((type) => [type, labelConfig[type].color ?? typeColors[type]]),
      typeColors.area_centroid
    ),
    labelSize: buildZoomScaledMatchExpression(labelSizeEntries, 0, MIN_ZOOM_LEVEL, maxZoom),
    labelOpacity: buildThresholdedZoomMatchExpression(
      labelOpacityEntries,
      0,
      MIN_ZOOM_LEVEL,
      maxZoom
    ),
  };
};
