import type { ToneCurveAnchor } from '@hierarchidb/ui-tone-curve-editor';

export const TOLERANCE_MIN = 0;
export const TOLERANCE_MAX = 2;

const resolveNumericToleranceValue = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? clampTolerance(value, fallback) : fallback
);

export const clampTolerance = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(TOLERANCE_MAX, Math.max(TOLERANCE_MIN, value));
};

export const resolveToleranceByBand = (
  values: number[] | undefined,
  bandIndex: number,
  fallback: number,
): number => {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  const normalizedIndex = Number.isFinite(bandIndex) ? Math.floor(bandIndex) : 0;
  const safeIndex = Math.max(0, Math.min(values.length - 1, normalizedIndex));
  return clampTolerance(values[safeIndex], fallback);
};

export const normalizeToleranceByBand = (
  values: number[] | undefined,
  bandCount: number,
  fallback: number,
): number[] => {
  if (!Number.isFinite(bandCount) || bandCount < 1) {
    return [];
  }
  const normalizedCount = Math.max(1, Math.floor(bandCount));
  if (!Array.isArray(values) || values.length === 0) {
    return Array.from({ length: normalizedCount }, () => fallback);
  }

  const result: number[] = [];
  for (let index = 0; index < normalizedCount; index += 1) {
    result[index] = resolveNumericToleranceValue(values[index], fallback);
  }
  return result;
};

const resolveBandBoundaryRepValues = (zoomBandBoundaries: number[]): number[] => {
  const count = Math.max(0, zoomBandBoundaries.length - 1);
  return zoomBandBoundaries.slice(0, count);
};

const resolveBandIndexForZoom = (zoomBandBoundaries: number[], zoom: number): number => {
  if (zoomBandBoundaries.length <= 1) {
    return 0;
  }

  const lastBoundary = zoomBandBoundaries[zoomBandBoundaries.length - 1];
  const firstBoundary = zoomBandBoundaries[0];
  if (!Number.isFinite(firstBoundary) || !Number.isFinite(lastBoundary)) {
    return 0;
  }

  if (zoom <= firstBoundary) {
    return 0;
  }
  if (zoom >= lastBoundary) {
    return Math.max(0, zoomBandBoundaries.length - 2);
  }

  for (let index = 0; index < zoomBandBoundaries.length - 1; index += 1) {
    const left = zoomBandBoundaries[index];
    const right = zoomBandBoundaries[index + 1];
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      continue;
    }
    if (zoom >= left && zoom < right) {
      return index;
    }
  }
  return Math.max(0, zoomBandBoundaries.length - 2);
};

export const resampleToleranceByBand = (
  values: number[] | undefined,
  oldZoomBandBoundaries: number[],
  nextZoomBandBoundaries: number[],
  fallback: number,
): number[] => {
  const oldBandCount = Math.max(0, oldZoomBandBoundaries.length - 1);
  const nextBandCount = Math.max(0, nextZoomBandBoundaries.length - 1);
  if (nextBandCount < 1) {
    return [];
  }

  const normalizedOld = normalizeToleranceByBand(values, oldBandCount, fallback);
  const reps = resolveBandBoundaryRepValues(nextZoomBandBoundaries);
  const result: number[] = [];

  reps.forEach((repZoom) => {
    const bandIndex = resolveBandIndexForZoom(oldZoomBandBoundaries, repZoom);
    const value = normalizedOld[bandIndex];
    result.push(clampTolerance(value, fallback));
  });

  return result;
};

export const buildToneCurveAnchorsFromToleranceByBand = (
  toleranceByBand: number[] | undefined,
  zoomBandBoundaries: number[],
  fallback = 0.1,
): ToneCurveAnchor[] => {
  const bandCount = Math.max(0, zoomBandBoundaries.length - 1);
  if (bandCount === 0) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
  }

  const reps = resolveBandBoundaryRepValues(zoomBandBoundaries);
  const normalized = normalizeToleranceByBand(toleranceByBand, bandCount, fallback);
  return reps.map((x, index) => ({ x, y: normalized[index] ?? 0.1 }));
};

export const buildToleranceByBandFromToneCurveAnchors = (
  anchors: ReadonlyArray<ToneCurveAnchor> | undefined,
  zoomBandBoundaries: number[],
  fallback: number,
): number[] => {
  const bandCount = Math.max(0, zoomBandBoundaries.length - 1);
  if (bandCount === 0) {
    return [];
  }
  if (!anchors || anchors.length === 0) {
    return Array.from({ length: bandCount }, () => fallback);
  }

  const sortedAnchors = [...anchors].sort((left, right) => left.x - right.x);
  const reps = resolveBandBoundaryRepValues(zoomBandBoundaries);
  const result: number[] = [];
  let anchorIndex = 0;

  for (const rep of reps) {
    while (
      anchorIndex + 1 < sortedAnchors.length
      && (sortedAnchors[anchorIndex + 1]?.x ?? Number.NEGATIVE_INFINITY) <= rep
    ) {
      anchorIndex += 1;
    }
    const anchor = sortedAnchors[Math.min(anchorIndex, sortedAnchors.length - 1)];
    const value = anchor?.y;
    result.push(clampTolerance(typeof value === 'number' ? value : fallback, fallback));
  }

  return result;
};
