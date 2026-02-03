export const ZOOM_BAND_MIN_ZOOM = 1;
export const ZOOM_BAND_MAX_ZOOM = 11;
export const ZOOM_BAND_MIN_RANGES = 1;
export const ZOOM_BAND_MAX_RANGES = 10;
export const DEFAULT_ZOOM_BAND_BOUNDARIES = [1, 2, 3, 6];

export type ZoomBandRange = {
  min: number;
  max: number;
};

export type ZoomBandSettingsSource = 'common' | 'entity' | 'default';

export type ZoomBandSettings = {
  boundaries: number[];
  source: ZoomBandSettingsSource;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeZoomBandBoundaries = (
  boundaries: number[],
  minZoom = ZOOM_BAND_MIN_ZOOM,
  maxZoom = ZOOM_BAND_MAX_ZOOM,
  maxRanges = ZOOM_BAND_MAX_RANGES,
): number[] => {
  const maxHandles = Math.max(1, maxRanges + 1);
  const raw = boundaries
    .map((value) => Math.round(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
    .slice(0, maxHandles);

  if (raw.length === 0) {
    return [minZoom];
  }

  const normalized: number[] = [minZoom];
  const lastRaw = raw[raw.length - 1];
  const resolvedLast = clamp(
    typeof lastRaw === 'number' ? lastRaw : minZoom,
    minZoom,
    maxZoom,
  );

  const middle = raw.filter((value) => value > minZoom && value < resolvedLast);
  const maxMiddle = Math.max(0, maxHandles - 2);
  const trimmed = middle.slice(0, maxMiddle);

  for (let i = 0; i < trimmed.length; i += 1) {
    const remaining = trimmed.length - i - 1;
    const prev = normalized[normalized.length - 1]!;
    const minValue = Math.max(prev + 1, minZoom);
    const maxValue = Math.max(minValue, resolvedLast - remaining - 1);
    normalized.push(clamp(trimmed[i]!, minValue, maxValue));
  }

  if (normalized.length < maxHandles && resolvedLast > normalized[normalized.length - 1]!) {
    normalized.push(Math.max(resolvedLast, normalized[normalized.length - 1]!));
  }

  return normalized;
};

export const buildEvenZoomBandBoundaries = (
  rangeCount: number,
  minZoom = ZOOM_BAND_MIN_ZOOM,
  maxZoom = ZOOM_BAND_MAX_ZOOM,
): number[] => {
  if (rangeCount <= 0) return [minZoom];
  if (rangeCount === 1) return [minZoom, maxZoom];
  const span = maxZoom - minZoom;
  const raw = Array.from({ length: rangeCount + 1 }, (_, index) => {
    const fraction = index / rangeCount;
    return minZoom + span * fraction;
  });
  return normalizeZoomBandBoundaries(raw, minZoom, maxZoom, rangeCount);
};

export const buildZoomBandRanges = (
  boundaries: number[],
  minZoom = ZOOM_BAND_MIN_ZOOM,
  maxZoom = ZOOM_BAND_MAX_ZOOM,
): ZoomBandRange[] => {
  const normalized = normalizeZoomBandBoundaries(boundaries, minZoom, maxZoom);
  if (normalized.length < 2) return [];
  const ranges: ZoomBandRange[] = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    const min = normalized[i]!;
    const max = normalized[i + 1]!;
    ranges.push({ min, max });
  }
  return ranges;
};

export const areZoomBandBoundariesEqual = (left?: number[], right?: number[]): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export const resolveZoomBandSettings = (params: {
  commonBoundaries?: number[];
  entityBoundaries?: number[];
  preferCommon?: boolean;
  fallbackBoundaries?: number[];
  minZoom?: number;
  maxZoom?: number;
  maxRanges?: number;
}): ZoomBandSettings => {
  const minZoom = params.minZoom ?? ZOOM_BAND_MIN_ZOOM;
  const maxZoom = params.maxZoom ?? ZOOM_BAND_MAX_ZOOM;
  const maxRanges = params.maxRanges ?? ZOOM_BAND_MAX_RANGES;
  const fallback = params.fallbackBoundaries ?? DEFAULT_ZOOM_BAND_BOUNDARIES;

  const normalizeCandidate = (boundaries?: number[]) => (
    Array.isArray(boundaries)
      ? normalizeZoomBandBoundaries(boundaries, minZoom, maxZoom, maxRanges)
      : undefined
  );

  const common = normalizeCandidate(params.commonBoundaries);
  const entity = normalizeCandidate(params.entityBoundaries);
  const fallbackNormalized = normalizeZoomBandBoundaries(fallback, minZoom, maxZoom, maxRanges);

  if (params.preferCommon) {
    if (common && common.length > 0) return { boundaries: common, source: 'common' };
    if (entity && entity.length > 0) return { boundaries: entity, source: 'entity' };
    return { boundaries: fallbackNormalized, source: 'default' };
  }

  if (entity && entity.length > 0) return { boundaries: entity, source: 'entity' };
  if (common && common.length > 0) return { boundaries: common, source: 'common' };
  return { boundaries: fallbackNormalized, source: 'default' };
};
