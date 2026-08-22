import type {
  BorderGeometryArcRecord,
  BorderGeometryCoordinate,
  BorderGeometryRingRecord,
} from './BorderGeometryStorageTypes.js';
import type { BorderGeometryExtractionResult } from './extractBorderGeometryArcs.js';

export interface BorderGeometryArcSimplificationOptions {
  extraction: BorderGeometryExtractionResult;
  tolerance: number;
  now: number;
  simplifyCoordinates?: (
    arc: BorderGeometryArcRecord,
    tolerance: number
  ) => readonly BorderGeometryCoordinate[];
}

const coordinatesEqual = (
  left: BorderGeometryCoordinate,
  right: BorderGeometryCoordinate
): boolean => left[0] === right[0] && left[1] === right[1];

const requireCoordinate = (
  coordinate: BorderGeometryCoordinate | undefined
): BorderGeometryCoordinate => {
  if (coordinate === undefined) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  return coordinate;
};

const validateCoordinate = (coordinate: BorderGeometryCoordinate): void => {
  const [longitude, latitude] = coordinate;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
};

const serializeCoordinate = (coordinate: BorderGeometryCoordinate): string =>
  `${coordinate[0]},${coordinate[1]}`;

const hashString = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const hashCoordinates = (coordinates: readonly BorderGeometryCoordinate[]): string =>
  hashString(coordinates.map(serializeCoordinate).join('|'));

const compareCoordinates = (
  left: BorderGeometryCoordinate,
  right: BorderGeometryCoordinate
): number => {
  const longitudeDiff = left[0] - right[0];
  if (longitudeDiff !== 0) return longitudeDiff;
  return left[1] - right[1];
};

const buildEndpointHash = (coordinates: readonly BorderGeometryCoordinate[]): string => {
  const first = requireCoordinate(coordinates[0]);
  const last = requireCoordinate(coordinates[coordinates.length - 1]);
  const endpoints = compareCoordinates(first, last) <= 0 ? [first, last] : [last, first];
  return hashCoordinates(endpoints);
};

const buildSimplifiedArcId = (
  arc: BorderGeometryArcRecord,
  coordinates: readonly BorderGeometryCoordinate[]
): string => {
  const ownerKey = arc.ownerPolygonIds.join(',');
  return `arc:${arc.classification}:${ownerKey}:${hashCoordinates(coordinates)}`;
};

const perpendicularDistance = (
  point: BorderGeometryCoordinate,
  start: BorderGeometryCoordinate,
  end: BorderGeometryCoordinate
): number => {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }
  const numerator = Math.abs(
    deltaY * point[0] - deltaX * point[1] + end[0] * start[1] - end[1] * start[0]
  );
  return numerator / Math.hypot(deltaX, deltaY);
};

const ramerDouglasPeucker = (
  coordinates: readonly BorderGeometryCoordinate[],
  tolerance: number
): readonly BorderGeometryCoordinate[] => {
  if (coordinates.length <= 2 || tolerance === 0) {
    return coordinates;
  }
  const first = requireCoordinate(coordinates[0]);
  const last = requireCoordinate(coordinates[coordinates.length - 1]);
  let maxDistance = -1;
  let splitIndex = -1;
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const coordinate = requireCoordinate(coordinates[index]);
    const distance = perpendicularDistance(coordinate, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }
  if (maxDistance <= tolerance) {
    return [first, last];
  }
  const left = ramerDouglasPeucker(coordinates.slice(0, splitIndex + 1), tolerance);
  const right = ramerDouglasPeucker(coordinates.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
};

const validateSimplifiedCoordinates = (
  original: BorderGeometryArcRecord,
  simplified: readonly BorderGeometryCoordinate[]
): void => {
  if (!Array.isArray(simplified) || simplified.length < 2) {
    throw new Error('border-geometry-simplified-arc-coordinate-count-invalid');
  }
  const originalFirst = requireCoordinate(original.coordinates[0]);
  const originalLast = requireCoordinate(original.coordinates[original.coordinates.length - 1]);
  const simplifiedFirst = requireCoordinate(simplified[0]);
  const simplifiedLast = requireCoordinate(simplified[simplified.length - 1]);
  for (const coordinate of simplified) {
    validateCoordinate(coordinate);
  }
  if (
    !coordinatesEqual(originalFirst, simplifiedFirst) ||
    !coordinatesEqual(originalLast, simplifiedLast)
  ) {
    throw new Error('border-geometry-simplified-arc-endpoint-mismatch');
  }
};

const simplifyArc = (
  arc: BorderGeometryArcRecord,
  tolerance: number,
  simplifyCoordinates: BorderGeometryArcSimplificationOptions['simplifyCoordinates'],
  now: number
): BorderGeometryArcRecord => {
  if (arc.coordinates.length < 2) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  const simplifiedCoordinates = simplifyCoordinates
    ? simplifyCoordinates(arc, tolerance)
    : ramerDouglasPeucker(arc.coordinates, tolerance);
  validateSimplifiedCoordinates(arc, simplifiedCoordinates);
  const coordinateHash = hashCoordinates(simplifiedCoordinates);
  return {
    ...arc,
    arcId: buildSimplifiedArcId(arc, simplifiedCoordinates),
    coordinates: simplifiedCoordinates,
    coordinateHash,
    endpointHash: buildEndpointHash(simplifiedCoordinates),
    updatedAt: now,
  };
};

const rewriteRingReferences = (
  ring: BorderGeometryRingRecord,
  arcIdByOriginalId: ReadonlyMap<string, string>,
  now: number
): BorderGeometryRingRecord => ({
  ...ring,
  arcRefs: ring.arcRefs.map((arcRef) => {
    const arcId = arcIdByOriginalId.get(arcRef.arcId);
    if (arcId === undefined) {
      throw new Error('border-geometry-ring-arc-ref-missing');
    }
    return { ...arcRef, arcId };
  }),
  updatedAt: now,
});

export const simplifyBorderGeometryArcs = (
  options: BorderGeometryArcSimplificationOptions
): BorderGeometryExtractionResult => {
  if (!Number.isFinite(options.tolerance) || options.tolerance < 0) {
    throw new Error('border-geometry-simplification-tolerance-invalid');
  }
  if (!Number.isFinite(options.now)) {
    throw new Error('border-geometry-updated-at-invalid');
  }
  const arcIdByOriginalId = new Map<string, string>();
  const simplifiedArcs = options.extraction.arcs.map((arc) => {
    const simplifiedArc = simplifyArc(
      arc,
      options.tolerance,
      options.simplifyCoordinates,
      options.now
    );
    arcIdByOriginalId.set(arc.arcId, simplifiedArc.arcId);
    return simplifiedArc;
  });
  const simplifiedArcIds = new Set(simplifiedArcs.map((arc) => arc.arcId));
  if (simplifiedArcIds.size !== simplifiedArcs.length) {
    throw new Error('border-geometry-simplified-arc-id-collision');
  }
  return {
    arcs: simplifiedArcs.sort((left, right) => left.arcId.localeCompare(right.arcId)),
    rings: options.extraction.rings
      .map((ring) => rewriteRingReferences(ring, arcIdByOriginalId, options.now))
      .sort((left, right) => left.ringId.localeCompare(right.ringId)),
    polygonRelations: options.extraction.polygonRelations.map((relation) => ({
      ...relation,
      updatedAt: options.now,
    })),
  };
};
