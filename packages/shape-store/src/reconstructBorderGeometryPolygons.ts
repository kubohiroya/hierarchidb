import type {
  BorderGeometryArcRecord,
  BorderGeometryArcReference,
  BorderGeometryCoordinate,
  BorderGeometryDatasetRecord,
  BorderGeometryPolygonRelationRecord,
  BorderGeometryRingRecord,
} from './BorderGeometryStorageTypes.js';
import type { BorderGeometryExtractionResult } from './extractBorderGeometryArcs.js';

export interface BorderGeometryPolygonReconstructionOptions {
  dataset: BorderGeometryDatasetRecord;
  extraction: BorderGeometryExtractionResult;
  now: number;
}

export interface BorderGeometryReconstructedPolygonArtifact {
  datasetId: string;
  polygonId: string;
  nodeId: string;
  sourceFeatureId: string;
  outputArtifactId: string;
  createdFromRevision: string;
  reconstructedAt: number;
  geometry: {
    type: 'Polygon';
    coordinates: readonly (readonly BorderGeometryCoordinate[])[];
  };
}

export interface BorderGeometryPolygonReconstructionResult {
  polygons: readonly BorderGeometryReconstructedPolygonArtifact[];
}

const coordinatesEqual = (
  left: BorderGeometryCoordinate,
  right: BorderGeometryCoordinate
): boolean => left[0] === right[0] && left[1] === right[1];

const requireCoordinate = (
  coordinate: BorderGeometryCoordinate | undefined,
  code: string
): BorderGeometryCoordinate => {
  if (coordinate === undefined) {
    throw new Error(code);
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
    throw new Error('border-geometry-reconstruction-coordinate-invalid');
  }
};

const assertDatasetLineage = (
  dataset: BorderGeometryDatasetRecord,
  record: {
    datasetId: string;
    nodeId: string;
    createdFromRevision: string;
  }
): void => {
  if (
    record.datasetId !== dataset.datasetId ||
    record.nodeId !== dataset.nodeId ||
    record.createdFromRevision !== dataset.createdFromRevision
  ) {
    throw new Error('border-geometry-reconstruction-dataset-lineage-mismatch');
  }
};

const indexById = <T>(
  records: readonly T[],
  getId: (record: T) => string,
  duplicateCode: string
): Map<string, T> => {
  const recordsById = new Map<string, T>();
  for (const record of records) {
    const id = getId(record);
    if (recordsById.has(id)) {
      throw new Error(duplicateCode);
    }
    recordsById.set(id, record);
  }
  return recordsById;
};

const getArcCoordinatesForDirection = (
  arc: BorderGeometryArcRecord,
  arcRef: BorderGeometryArcReference
): readonly BorderGeometryCoordinate[] => {
  if (arcRef.direction === 'forward') return arc.coordinates;
  if (arcRef.direction === 'reverse') return [...arc.coordinates].reverse();
  throw new Error('border-geometry-arc-direction-invalid');
};

const assertArcOwnerIncludesPolygon = (arc: BorderGeometryArcRecord, polygonId: string): void => {
  if (!arc.ownerPolygonIds.includes(polygonId)) {
    throw new Error('border-geometry-reconstruction-arc-owner-mismatch');
  }
  if (arc.classification === 'sharedBorder' && arc.ownerPolygonIds.length !== 2) {
    throw new Error('border-geometry-shared-border-owner-cardinality-invalid');
  }
  if (arc.classification === 'coastline' && arc.ownerPolygonIds.length < 1) {
    throw new Error('border-geometry-owner-polygons-required');
  }
};

const ringOrientation = (coordinates: readonly BorderGeometryCoordinate[]): string => {
  let twiceArea = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = requireCoordinate(
      coordinates[index],
      'border-geometry-reconstruction-ring-coordinate-count-invalid'
    );
    const end = requireCoordinate(
      coordinates[index + 1],
      'border-geometry-reconstruction-ring-coordinate-count-invalid'
    );
    twiceArea += (end[0] - start[0]) * (end[1] + start[1]);
  }
  if (twiceArea === 0) {
    throw new Error('border-geometry-ring-orientation-invalid');
  }
  return twiceArea > 0 ? 'clockwise' : 'counterclockwise';
};

const reconstructRingCoordinates = (
  dataset: BorderGeometryDatasetRecord,
  ring: BorderGeometryRingRecord,
  arcsById: ReadonlyMap<string, BorderGeometryArcRecord>
): readonly BorderGeometryCoordinate[] => {
  assertDatasetLineage(dataset, ring);
  if (ring.closed !== true) {
    throw new Error('border-geometry-ring-open');
  }
  if (ring.arcRefs.length === 0) {
    throw new Error('border-geometry-ring-arc-refs-required');
  }

  const coordinates: BorderGeometryCoordinate[] = [];
  for (const arcRef of ring.arcRefs) {
    const arc = arcsById.get(arcRef.arcId);
    if (arc === undefined) {
      throw new Error('border-geometry-ring-arc-ref-missing');
    }
    assertDatasetLineage(dataset, arc);
    assertArcOwnerIncludesPolygon(arc, ring.polygonId);
    const arcCoordinates = getArcCoordinatesForDirection(arc, arcRef);
    if (arcCoordinates.length < 2) {
      throw new Error('border-geometry-arc-coordinates-invalid');
    }
    for (const coordinate of arcCoordinates) {
      validateCoordinate(coordinate);
    }
    if (coordinates.length === 0) {
      coordinates.push(...arcCoordinates);
      continue;
    }
    const previous = requireCoordinate(
      coordinates[coordinates.length - 1],
      'border-geometry-reconstruction-ring-coordinate-count-invalid'
    );
    const next = requireCoordinate(
      arcCoordinates[0],
      'border-geometry-reconstruction-ring-coordinate-count-invalid'
    );
    if (!coordinatesEqual(previous, next)) {
      throw new Error('border-geometry-reconstruction-ring-open');
    }
    coordinates.push(...arcCoordinates.slice(1));
  }

  const first = requireCoordinate(
    coordinates[0],
    'border-geometry-reconstruction-ring-coordinate-count-invalid'
  );
  const last = requireCoordinate(
    coordinates[coordinates.length - 1],
    'border-geometry-reconstruction-ring-coordinate-count-invalid'
  );
  if (coordinates.length < 4 || !coordinatesEqual(first, last)) {
    throw new Error('border-geometry-reconstruction-ring-open');
  }
  if (ringOrientation(coordinates) !== ring.orientation) {
    throw new Error('border-geometry-reconstruction-ring-orientation-mismatch');
  }
  return coordinates;
};

const requireRingForRelation = (
  ringsById: ReadonlyMap<string, BorderGeometryRingRecord>,
  relation: BorderGeometryPolygonRelationRecord,
  ringId: string,
  role: BorderGeometryRingRecord['role']
): BorderGeometryRingRecord => {
  const ring = ringsById.get(ringId);
  if (ring === undefined) {
    throw new Error('border-geometry-polygon-ring-missing');
  }
  if (ring.polygonId !== relation.polygonId || ring.role !== role) {
    throw new Error('border-geometry-polygon-ring-relation-mismatch');
  }
  return ring;
};

const reconstructPolygon = (
  dataset: BorderGeometryDatasetRecord,
  relation: BorderGeometryPolygonRelationRecord,
  ringsById: ReadonlyMap<string, BorderGeometryRingRecord>,
  arcsById: ReadonlyMap<string, BorderGeometryArcRecord>,
  now: number
): BorderGeometryReconstructedPolygonArtifact => {
  assertDatasetLineage(dataset, relation);
  const outerRing = requireRingForRelation(ringsById, relation, relation.outerRingId, 'outer');
  const rings = [reconstructRingCoordinates(dataset, outerRing, arcsById)];
  for (const innerRingId of relation.innerRingIds) {
    const innerRing = requireRingForRelation(ringsById, relation, innerRingId, 'inner');
    rings.push(reconstructRingCoordinates(dataset, innerRing, arcsById));
  }
  return {
    datasetId: relation.datasetId,
    polygonId: relation.polygonId,
    nodeId: relation.nodeId,
    sourceFeatureId: relation.sourceFeatureId,
    outputArtifactId: relation.outputArtifactId,
    createdFromRevision: relation.createdFromRevision,
    reconstructedAt: now,
    geometry: {
      type: 'Polygon',
      coordinates: rings,
    },
  };
};

export const reconstructBorderGeometryPolygons = (
  options: BorderGeometryPolygonReconstructionOptions
): BorderGeometryPolygonReconstructionResult => {
  if (!Number.isFinite(options.now)) {
    throw new Error('border-geometry-reconstructed-at-invalid');
  }
  const arcsById = indexById(
    options.extraction.arcs,
    (arc) => arc.arcId,
    'border-geometry-arc-id-duplicate'
  );
  const ringsById = indexById(
    options.extraction.rings,
    (ring) => ring.ringId,
    'border-geometry-ring-id-duplicate'
  );
  const polygons = options.extraction.polygonRelations
    .map((relation) =>
      reconstructPolygon(options.dataset, relation, ringsById, arcsById, options.now)
    )
    .sort((left, right) => left.polygonId.localeCompare(right.polygonId));
  return { polygons };
};
