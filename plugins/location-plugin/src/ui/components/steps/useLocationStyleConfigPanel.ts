import { useEffect, useMemo } from 'react';
import {
  Anchor,
  FlightTakeoff,
  ForkRight,
  LocationCity,
  Subway,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import type {
  LocationEntity,
  LocationIconConfig,
  LocationIconId,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
  LocationType,
} from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';

export const MIN_ZOOM_LEVEL = 0;
export const MAX_ZOOM_LEVEL = 22;
export const DEFAULT_MAX_ZOOM = 12;

export const LOCATION_TYPES: LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

const DEFAULT_TYPE_COLORS: Record<LocationType, string> = {
  area_centroid: '#d62728',
  airport: LOCATION_TYPE_STYLES.airport.color,
  port: '#1f77b4',
  railway_station: '#2ca02c',
  interchange: LOCATION_TYPE_STYLES.interchange.color,
};

const DEFAULT_ICON_IDS: Record<LocationType, LocationIconId> = {
  area_centroid: 'location_city',
  airport: 'flight_takeoff',
  port: 'directions_boat',
  railway_station: 'train',
  interchange: 'fork_right',
};

export const ICON_OPTIONS: Array<{ id: LocationIconId; Icon: SvgIconComponent; labelKey: string }> = [
  { id: 'location_city', Icon: LocationCity, labelKey: 'location_city' },
  { id: 'flight_takeoff', Icon: FlightTakeoff, labelKey: 'flight_takeoff' },
  { id: 'directions_boat', Icon: Anchor, labelKey: 'directions_boat' },
  { id: 'train', Icon: Subway, labelKey: 'train' },
  { id: 'fork_right', Icon: ForkRight, labelKey: 'fork_right' },
];

const DEFAULT_ICON_SIZE_RANGE: [number, number] = [2, 8];
const DEFAULT_LABEL_SIZE_RANGE: [number, number] = [2, 6];

export const MIN_ICON_SIZE = 0;
export const MAX_ICON_SIZE = 12;
export const MIN_LABEL_SIZE = 0;
export const MAX_LABEL_SIZE = 12;

export const sliderSx = { ml: 3, mr: 0, width: 'calc(100% - 24px)' };
export const sliderContainerSx = { m: 2 };

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const normalizeRange = (value: number[] | number, min: number, max: number): [number, number] => {
  const array = Array.isArray(value) ? value : [value, value];
  const first = clamp(Number(array[0] ?? min), min, max);
  const second = clamp(Number(array[1] ?? first), min, max);
  return first <= second ? [first, second] : [second, first];
};

const normalizeZoomStops = (values: number[], maxZoom: number): [number, number, number, number] => {
  const clamped = values.map((value) => clamp(Math.round(value), MIN_ZOOM_LEVEL, maxZoom));
  const normalized: number[] = [];
  let last = MIN_ZOOM_LEVEL;
  for (let index = 0; index < 4; index += 1) {
    const next = clamp(clamped[index] ?? last, last, maxZoom);
    normalized.push(next);
    last = next;
  }
  return normalized as [number, number, number, number];
};

const buildDefaultRepresentationConfig = (maxZoom: number): LocationRepresentationByZoomLevelConfig => {
  const stops = normalizeZoomStops([
    0,
    Math.round(maxZoom * 0.4),
    Math.round(maxZoom * 0.6),
    Math.round(maxZoom * 0.8),
  ], maxZoom);
  return LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      pointFromZoom: stops[0],
      polygonFromZoom: stops[1],
      iconFromZoom: stops[2],
      iconFixedFromZoom: stops[3],
    };
    return acc;
  }, {} as LocationRepresentationByZoomLevelConfig);
};

const buildDefaultIconConfig = (): LocationIconConfig => (
  LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: DEFAULT_TYPE_COLORS[type],
      iconId: DEFAULT_ICON_IDS[type],
      sizeRange: DEFAULT_ICON_SIZE_RANGE,
    };
    return acc;
  }, {} as LocationIconConfig)
);

const buildDefaultLabelConfig = (maxZoom: number): LocationLabelConfig => {
  const zoomRange = normalizeRange([
    Math.round(maxZoom * 0.6),
    Math.round(maxZoom * 0.8),
  ], MIN_ZOOM_LEVEL, maxZoom);
  return LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: DEFAULT_TYPE_COLORS[type],
      zoomRange,
      sizeRange: DEFAULT_LABEL_SIZE_RANGE,
    };
    return acc;
  }, {} as LocationLabelConfig);
};

export const useLocationStyleConfigPanel = (
  draftProp: Partial<LocationEntity>,
  onUpdate?: (updates: Partial<LocationEntity>) => void,
) => {
  const { translations } = useTranslation();
  const draft = draftProp ?? {};
  const tilesMaxZoom = clamp(draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

  const representationDefaults = useMemo(
    () => buildDefaultRepresentationConfig(tilesMaxZoom),
    [tilesMaxZoom],
  );
  const iconDefaults = useMemo(() => buildDefaultIconConfig(), []);
  const labelDefaults = useMemo(
    () => buildDefaultLabelConfig(tilesMaxZoom),
    [tilesMaxZoom],
  );

  const representationConfig = useMemo(() => (
    LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.representationByZoomLevelConfig?.[type] ?? representationDefaults[type];
      return acc;
    }, {} as LocationRepresentationByZoomLevelConfig)
  ), [draft.representationByZoomLevelConfig, representationDefaults]);

  const iconConfig = useMemo(() => (
    LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.iconConfig?.[type] ?? iconDefaults[type];
      return acc;
    }, {} as LocationIconConfig)
  ), [draft.iconConfig, iconDefaults]);

  const labelConfig = useMemo(() => (
    LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.labelConfig?.[type] ?? labelDefaults[type];
      return acc;
    }, {} as LocationLabelConfig)
  ), [draft.labelConfig, labelDefaults]);

  useEffect(() => {
    const needsRepresentation = LOCATION_TYPES.some((type) => !draft.representationByZoomLevelConfig?.[type]);
    if (needsRepresentation) {
      onUpdate?.({ representationByZoomLevelConfig: representationConfig });
    }
  }, [draft.representationByZoomLevelConfig, onUpdate, representationConfig]);

  useEffect(() => {
    const needsIcons = LOCATION_TYPES.some((type) => !draft.iconConfig?.[type]);
    if (needsIcons) {
      onUpdate?.({ iconConfig });
    }
  }, [draft.iconConfig, iconConfig, onUpdate]);

  useEffect(() => {
    const needsLabels = LOCATION_TYPES.some((type) => !draft.labelConfig?.[type]);
    if (needsLabels) {
      onUpdate?.({ labelConfig });
    }
  }, [draft.labelConfig, labelConfig, onUpdate]);

  return {
    translations,
    draft,
    tilesMaxZoom,
    representationConfig,
    iconConfig,
    labelConfig,
  };
};
