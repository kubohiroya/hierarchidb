export const ZOOM_BAND_MIN_ZOOM = 0;
export const ZOOM_BAND_MAX_ZOOM = 11;
export const ZOOM_BAND_MIN_RANGES = 1;
export const ZOOM_BAND_MAX_RANGES = 10;

export type ZoomBandRange = {
  min: number;
  max: number;
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

export const clampZoom = (value: number, minZoom = ZOOM_BAND_MIN_ZOOM, maxZoom = ZOOM_BAND_MAX_ZOOM): number => (
  Math.min(maxZoom, Math.max(minZoom, value))
);
