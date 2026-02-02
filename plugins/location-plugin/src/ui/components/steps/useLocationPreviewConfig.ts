import { useMemo } from 'react';
import type {
  LocationEntity,
  LocationIconConfig,
  LocationLabelConfig,
  LocationRepresentationByZoomLevelConfig,
} from '../../../common/types/index.js';
import {
  DEFAULT_ICON_IDS,
  DEFAULT_ICON_SIZE_RANGE,
  DEFAULT_LABEL_SIZE_RANGE,
  DEFAULT_MAX_ZOOM,
  DEFAULT_TYPE_COLORS,
  KNOWN_LOCATION_TYPES,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
} from './locationMapPreviewConstants.js';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRange = (value: number[] | number, min: number, max: number): [number, number] => {
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
  return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
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
  KNOWN_LOCATION_TYPES.reduce((acc, type) => {
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
  return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = {
      color: DEFAULT_TYPE_COLORS[type],
      zoomRange,
      sizeRange: DEFAULT_LABEL_SIZE_RANGE,
    };
    return acc;
  }, {} as LocationLabelConfig);
};

export const useLocationPreviewConfig = (draft: Partial<LocationEntity>) => {
  const tilesMaxZoom = clamp(draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const representationConfig = useMemo(() => {
    const defaults = buildDefaultRepresentationConfig(tilesMaxZoom);
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.representationByZoomLevelConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationRepresentationByZoomLevelConfig);
  }, [draft.representationByZoomLevelConfig, tilesMaxZoom]);
  const iconConfig = useMemo(() => {
    const defaults = buildDefaultIconConfig();
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.iconConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationIconConfig);
  }, [draft.iconConfig]);
  const labelConfig = useMemo(() => {
    const defaults = buildDefaultLabelConfig(tilesMaxZoom);
    return KNOWN_LOCATION_TYPES.reduce((acc, type) => {
      acc[type] = draft.labelConfig?.[type] ?? defaults[type];
      return acc;
    }, {} as LocationLabelConfig);
  }, [draft.labelConfig, tilesMaxZoom]);

  return {
    tilesMaxZoom,
    representationConfig,
    iconConfig,
    labelConfig,
  };
};

