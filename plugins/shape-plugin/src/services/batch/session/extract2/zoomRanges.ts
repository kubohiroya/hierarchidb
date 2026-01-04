export type ZoomRangeSegment = {
  minZoom: number;
  maxZoom: number;
  zoomLevels: number[];
  label: string;
};

const buildZoomLevels = (minZoom: number, maxZoom: number): number[] => (
  Array.from({ length: Math.max(0, maxZoom - minZoom + 1) }, (_, index) => minZoom + index)
);

export const buildZoomRangeSegments = (params: {
  minZoom: number;
  maxZoom: number;
  breakpoints?: number[];
}): ZoomRangeSegment[] => {
  const lower = Math.min(params.minZoom, params.maxZoom);
  const upper = Math.max(params.minZoom, params.maxZoom);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return [];
  }

  const clamp = (value: number): number => Math.min(Math.max(value, lower), upper);
  const raw = Array.isArray(params.breakpoints) && params.breakpoints.length >= 2
    ? params.breakpoints
    : [lower, upper];
  const points = Array.from(new Set(raw.map((value) => clamp(Number(value)))))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (points.length === 0) {
    return [{
      minZoom: lower,
      maxZoom: upper,
      zoomLevels: buildZoomLevels(lower, upper),
      label: `z${lower}-${upper}`,
    }];
  }

  if (points[0] !== lower) points.unshift(lower);
  if (points[points.length - 1] !== upper) points.push(upper);

  const segments: ZoomRangeSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const minZoom = points[index];
    const maxZoom = points[index + 1];
    if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) continue;
    segments.push({
      minZoom,
      maxZoom,
      zoomLevels: buildZoomLevels(minZoom, maxZoom),
      label: `z${minZoom}-${maxZoom}`,
    });
  }

  return segments.length > 0 ? segments : [{
    minZoom: lower,
    maxZoom: upper,
    zoomLevels: buildZoomLevels(lower, upper),
    label: `z${lower}-${upper}`,
  }];
};
