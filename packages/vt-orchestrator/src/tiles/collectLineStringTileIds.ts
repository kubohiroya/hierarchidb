import { packTileId } from './tileId.js';

export type LineStringCoordinate = readonly [number, number];

const MAX_TILE_ZOOM = 22;
const MAX_MERCATOR_LATITUDE = 85.05112877980659;
const PROJECTED_BOUNDARY_ULP_FACTOR = 8;

type ProjectedCoordinate = {
  x: number;
  y: number;
};

export const collectLineStringTileIds = (
  coordinates: readonly LineStringCoordinate[],
  zoom: number
): number[] => {
  const exactZoom = requireZoom(zoom);
  if (coordinates.length < 2) {
    return contractViolation('coordinates', 'must contain at least two positions');
  }
  const scale = 2 ** exactZoom;
  const projected = coordinates.map((coordinate, index) =>
    projectCoordinate(requireCoordinate(coordinate, index), scale)
  );
  const tileIds = new Set<number>();
  for (let index = 0; index < projected.length - 1; index += 1) {
    const start = projected[index];
    const end = projected[index + 1];
    if (!start || !end) {
      return contractViolation('coordinates', 'contains an incomplete segment');
    }
    collectSegmentTileIds(start, end, exactZoom, scale, tileIds);
  }
  return [...tileIds].sort((left, right) => left - right);
};

const requireZoom = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_TILE_ZOOM) {
    return contractViolation('zoom', `must be an integer in 0..${String(MAX_TILE_ZOOM)}`);
  }
  return value as number;
};

const requireCoordinate = (value: LineStringCoordinate, index: number): LineStringCoordinate => {
  if (!Array.isArray(value) || value.length !== 2) {
    return contractViolation(`coordinates[${String(index)}]`, 'must be a longitude/latitude pair');
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return contractViolation(`coordinates[${String(index)}][0]`, 'contains invalid longitude');
  }
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -MAX_MERCATOR_LATITUDE ||
    latitude > MAX_MERCATOR_LATITUDE
  ) {
    return contractViolation(
      `coordinates[${String(index)}][1]`,
      `must be within Web Mercator latitude range ±${String(MAX_MERCATOR_LATITUDE)}`
    );
  }
  return [longitude, latitude];
};

const projectCoordinate = (
  [longitude, latitude]: LineStringCoordinate,
  scale: number
): ProjectedCoordinate => {
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const x = ((longitude + 180) / 360) * scale;
  const y =
    latitude === MAX_MERCATOR_LATITUDE
      ? 0
      : latitude === -MAX_MERCATOR_LATITUDE
        ? scale
        : (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > scale || y < 0 || y > scale) {
    return contractViolation('coordinates', 'cannot be projected to the requested tile grid');
  }
  return { x, y };
};

const collectSegmentTileIds = (
  start: ProjectedCoordinate,
  projectedEnd: ProjectedCoordinate,
  zoom: number,
  scale: number,
  tileIds: Set<number>
): void => {
  const end = {
    x: resolveWrappedEndX(start.x, projectedEnd.x, scale),
    y: projectedEnd.y,
  };
  let tileX = resolveHorizontalTileIndex(start.x, scale);
  let tileY = resolveVerticalTileIndex(start.y, scale);
  const endTileX = resolveHorizontalTileIndex(end.x, scale);
  const endTileY = resolveVerticalTileIndex(end.y, scale);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);
  const segmentTileIds = new Set<number>();
  addTile(segmentTileIds, tileX, tileY, zoom, scale);
  addBoundaryTouchingTiles(segmentTileIds, start, zoom, scale);

  const deltaTileX = stepX === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaX);
  const deltaTileY = stepY === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaY);
  let nextBoundaryX = resolveNextBoundaryParameter(start.x, deltaX, tileX, stepX);
  let nextBoundaryY = resolveNextBoundaryParameter(start.y, deltaY, tileY, stepY);

  while (tileX !== endTileX || tileY !== endTileY) {
    const boundaryOrder = compareBoundaryParameters(nextBoundaryX, nextBoundaryY);
    if (boundaryOrder < 0) {
      tileX += stepX;
      nextBoundaryX += deltaTileX;
      addTile(segmentTileIds, tileX, tileY, zoom, scale);
      continue;
    }
    if (boundaryOrder > 0) {
      tileY += stepY;
      nextBoundaryY += deltaTileY;
      addTile(segmentTileIds, tileX, tileY, zoom, scale);
      continue;
    }
    addTile(segmentTileIds, tileX + stepX, tileY, zoom, scale);
    addTile(segmentTileIds, tileX, tileY + stepY, zoom, scale);
    tileX += stepX;
    tileY += stepY;
    nextBoundaryX += deltaTileX;
    nextBoundaryY += deltaTileY;
    addTile(segmentTileIds, tileX, tileY, zoom, scale);
  }

  addBoundaryTouchingTiles(segmentTileIds, end, zoom, scale);
  const horizontalBoundaryY = deltaY === 0 ? resolveProjectedTileBoundary(start.y, scale) : null;
  if (horizontalBoundaryY !== null && horizontalBoundaryY > 0 && horizontalBoundaryY < scale) {
    const primaryY = resolveVerticalTileIndex(start.y, scale);
    const adjacentY =
      primaryY === horizontalBoundaryY ? horizontalBoundaryY - 1 : horizontalBoundaryY;
    duplicateBoundaryRow(segmentTileIds, zoom, scale, adjacentY);
  }
  const verticalBoundaryX = deltaX === 0 ? resolveProjectedTileBoundary(start.x, scale) : null;
  if (verticalBoundaryX !== null) {
    const primaryX = resolveHorizontalTileIndex(start.x, scale);
    const adjacentX = primaryX === verticalBoundaryX ? verticalBoundaryX - 1 : verticalBoundaryX;
    duplicateBoundaryColumn(segmentTileIds, zoom, scale, adjacentX);
  }
  for (const tileId of segmentTileIds) tileIds.add(tileId);
};

const resolveWrappedEndX = (startX: number, endX: number, scale: number): number => {
  const directDelta = endX - startX;
  if (directDelta > scale / 2) return endX - scale;
  if (directDelta < -scale / 2) return endX + scale;
  return endX;
};

const resolveHorizontalTileIndex = (value: number, scale: number): number => {
  if (value === scale) return scale - 1;
  const index = Math.floor(value);
  if (!Number.isInteger(index)) {
    return contractViolation('projected longitude', 'does not resolve to a tile column');
  }
  return index;
};

const resolveVerticalTileIndex = (value: number, scale: number): number => {
  if (value === scale) return scale - 1;
  const index = Math.floor(value);
  if (!Number.isInteger(index) || index < 0 || index >= scale) {
    return contractViolation('projected coordinate', 'falls outside the tile grid');
  }
  return index;
};

const resolveNextBoundaryParameter = (
  projected: number,
  delta: number,
  tileIndex: number,
  step: number
): number => {
  if (step === 0) return Number.POSITIVE_INFINITY;
  const boundary = step > 0 ? tileIndex + 1 : tileIndex;
  return (boundary - projected) / delta;
};

const compareBoundaryParameters = (left: number, right: number): -1 | 0 | 1 => {
  if (Object.is(left, right)) return 0;
  if (!Number.isFinite(left)) return 1;
  if (!Number.isFinite(right)) return -1;
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * PROJECTED_BOUNDARY_ULP_FACTOR;
  if (Math.abs(left - right) <= tolerance) return 0;
  return left < right ? -1 : 1;
};

const addBoundaryTouchingTiles = (
  tileIds: Set<number>,
  coordinate: ProjectedCoordinate,
  zoom: number,
  scale: number
): void => {
  const x = resolveHorizontalTileIndex(coordinate.x, scale);
  const y = resolveVerticalTileIndex(coordinate.y, scale);
  const boundaryX = resolveProjectedTileBoundary(coordinate.x, scale);
  const xCandidates = boundaryX === null ? [x] : [boundaryX - 1, boundaryX];
  const yCandidates = resolveVerticalBoundaryCandidates(coordinate.y, y, scale);
  for (const candidateX of xCandidates) {
    for (const candidateY of yCandidates) {
      addTile(tileIds, candidateX, candidateY, zoom, scale);
    }
  }
};

const resolveVerticalBoundaryCandidates = (
  projected: number,
  index: number,
  scale: number
): number[] => {
  const boundary = resolveProjectedTileBoundary(projected, scale);
  return boundary !== null && boundary > 0 && boundary < scale ? [boundary - 1, boundary] : [index];
};

const resolveProjectedTileBoundary = (projected: number, scale: number): number | null => {
  const nearestBoundary = Math.round(projected);
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(projected), scale) * PROJECTED_BOUNDARY_ULP_FACTOR;
  return Math.abs(projected - nearestBoundary) <= tolerance ? nearestBoundary : null;
};

const duplicateBoundaryRow = (
  tileIds: Set<number>,
  zoom: number,
  scale: number,
  adjacentY: number
): void => {
  if (adjacentY < 0 || adjacentY >= scale) return;
  const coordinates = [...tileIds].map((tileId) => unpackTileIdForZoom(tileId, zoom));
  for (const coordinate of coordinates) addTile(tileIds, coordinate.x, adjacentY, zoom, scale);
};

const duplicateBoundaryColumn = (
  tileIds: Set<number>,
  zoom: number,
  scale: number,
  adjacentX: number
): void => {
  const coordinates = [...tileIds].map((tileId) => unpackTileIdForZoom(tileId, zoom));
  for (const coordinate of coordinates) addTile(tileIds, adjacentX, coordinate.y, zoom, scale);
};

const unpackTileIdForZoom = (tileId: number, zoom: number): { x: number; y: number } => {
  const tileIndexScale = 2 ** 22;
  const zoomOffset = zoom * tileIndexScale * tileIndexScale;
  const offset = tileId - zoomOffset;
  const x = Math.floor(offset / tileIndexScale);
  return { x, y: offset - x * tileIndexScale };
};

const addTile = (tileIds: Set<number>, x: number, y: number, zoom: number, scale: number): void => {
  if (y < 0 || y >= scale) return;
  const wrappedX = ((x % scale) + scale) % scale;
  tileIds.add(packTileId(wrappedX, y, zoom));
};

const contractViolation = (field: string, expectation: string): never => {
  throw new Error(`[line-string-tile-index] ${field} ${expectation}`);
};
