import type { TileBBox } from './vtStageGeometryTypes.js';

const toDeg = (r: number): number => r * 180 / Math.PI;

export const tileToBBox = (z: number, x: number, y: number): TileBBox => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

export const bboxIntersects = (a: TileBBox, b: TileBBox): boolean => (
  a.minX <= b.maxX
  && a.maxX >= b.minX
  && a.minY <= b.maxY
  && a.maxY >= b.minY
);

export const expandTileBBox = (bbox: TileBBox, buffer: number, extent: number): TileBBox => {
  if (!Number.isFinite(buffer) || buffer <= 0) return bbox;
  if (!Number.isFinite(extent) || extent <= 0) return bbox;
  const lonSpan = bbox.maxX - bbox.minX;
  const latSpan = bbox.maxY - bbox.minY;
  if (!Number.isFinite(lonSpan) || !Number.isFinite(latSpan)) return bbox;
  const factor = buffer / extent;
  const lonMargin = lonSpan * factor;
  const latMargin = latSpan * factor;
  return {
    minX: bbox.minX - lonMargin,
    minY: bbox.minY - latMargin,
    maxX: bbox.maxX + lonMargin,
    maxY: bbox.maxY + latMargin,
  };
};

export const resolveMaxVerticesPerTile = (indexMaxPoints: number): number => (
  Number.isFinite(indexMaxPoints) && indexMaxPoints > 0 ? indexMaxPoints : 100000
);

