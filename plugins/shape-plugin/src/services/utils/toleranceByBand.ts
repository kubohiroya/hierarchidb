import type { ToneCurveAnchor } from '@hierarchidb/ui-tone-curve-editor';

export const TOLERANCE_MIN = 0;
export const TOLERANCE_MAX = 12;

const resolveNumericToleranceValue = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? clampTolerance(value, fallback) : fallback
);

export const clampTolerance = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(TOLERANCE_MAX, Math.max(TOLERANCE_MIN, value));
};

const clampInRange = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
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
  return clampTolerance(typeof values[safeIndex] === 'number' ? values[safeIndex] : fallback, fallback);
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

const resolveToneCurveBoundaryRepValues = (zoomBandBoundaries: number[]): number[] => {
  return [...zoomBandBoundaries];
};

const resolveBandIndexForZoom = (zoomBandBoundaries: number[], zoom: number): number => {
  if (zoomBandBoundaries.length <= 1) {
    return 0;
  }

  const lastBoundary = zoomBandBoundaries[zoomBandBoundaries.length - 1];
  const firstBoundary = zoomBandBoundaries[0];
  if (
    typeof firstBoundary !== 'number'
    || typeof lastBoundary !== 'number'
    || !Number.isFinite(firstBoundary)
    || !Number.isFinite(lastBoundary)
  ) {
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
    if (
      typeof left !== 'number'
      || typeof right !== 'number'
      || !Number.isFinite(left)
      || !Number.isFinite(right)
    ) {
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
    result.push(clampTolerance(typeof value === 'number' ? value : fallback, fallback));
  });

  return result;
};

export const buildToneCurveAnchorsFromToleranceByBand = (
  toleranceByBand: number[] | undefined,
  zoomBandBoundaries: number[],
  fallback = 0.1,
  fallbackAnchors?: readonly number[],
): ToneCurveAnchor[] => {
  const bandCount = Math.max(0, zoomBandBoundaries.length - 1);
  if (bandCount === 0) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
  }

  const reps = resolveToneCurveBoundaryRepValues(zoomBandBoundaries);
  const boundaryCount = zoomBandBoundaries.length;
  const resolvedFallbackAnchors = fallbackAnchors ?? [];
  const rawNormalized = Array.from({ length: boundaryCount }, (_, index) => (
    index < reps.length
      ? resolveNumericToleranceValue(
        toleranceByBand?.[index],
        index < resolvedFallbackAnchors.length ? (resolvedFallbackAnchors[index] ?? fallback) : fallback,
      )
      : fallback
  ));

  return reps.map((x, index) => ({
    x,
    y: rawNormalized[index] ?? fallback,
  }));
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

  const normalizedAnchors = [...anchors]
    .filter((anchor): anchor is ToneCurveAnchor => Number.isFinite(anchor.x) && Number.isFinite(anchor.y))
    .sort((left: ToneCurveAnchor, right: ToneCurveAnchor) => left.x - right.x)
    .map((anchor) => ({
      x: clampInRange(anchor.x, zoomBandBoundaries[0] ?? 0, zoomBandBoundaries.at(-1) ?? 11),
      y: clampInRange(anchor.y, TOLERANCE_MIN, TOLERANCE_MAX),
    }));

  if (normalizedAnchors.length === 0) {
    return Array.from({ length: bandCount }, () => fallback);
  }
  if (normalizedAnchors.length === 1) {
    return Array.from({ length: bandCount }, () => clampTolerance(normalizedAnchors[0]?.y ?? fallback, fallback));
  }

  const result: number[] = [];
  const anchorCount = zoomBandBoundaries.length;

  for (let index = 0; index < anchorCount; index += 1) {
    const anchor = normalizedAnchors[index];
    if (anchor === undefined) {
      result.push(fallback);
      continue;
    }
    result.push(clampTolerance(anchor.y, fallback));
  }

  return result;
};
