import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import type {
  BorderGeometryArcClassification,
  BorderGeometryArcDirection,
  BorderGeometryArcRecord,
  BorderGeometryCoordinate,
  BorderGeometryDatasetRecord,
  BorderGeometryPolygonRelationRecord,
  BorderGeometryRingRecord,
  BorderGeometryRingRole,
} from './BorderGeometryStorageTypes.js';

export type BorderGeometrySourceFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

export interface BorderGeometryExtractionOptions {
  dataset: BorderGeometryDatasetRecord;
  featureCollection: FeatureCollection<Geometry, Record<string, unknown>>;
  getFeatureId?: (feature: BorderGeometrySourceFeature, featureIndex: number) => string;
  outputArtifactIdPrefix: string;
  now: number;
}

export interface BorderGeometryExtractionResult {
  arcs: BorderGeometryArcRecord[];
  rings: BorderGeometryRingRecord[];
  polygonRelations: BorderGeometryPolygonRelationRecord[];
}

type RingSource = {
  feature: BorderGeometrySourceFeature;
  featureId: string;
  polygonId: string;
  ringId: string;
  role: BorderGeometryRingRole;
  coordinates: BorderGeometryCoordinate[];
};

type EdgeOccurrence = {
  polygonId: string;
};

type RingArcReferenceDraft = {
  arcId: string;
  direction: BorderGeometryArcDirection;
};

type ArcDraft = {
  classification: BorderGeometryArcClassification;
  coordinates: readonly BorderGeometryCoordinate[];
  ownerPolygonIds: readonly string[];
};

const coordinatesEqual = (
  left: BorderGeometryCoordinate,
  right: BorderGeometryCoordinate
): boolean => left[0] === right[0] && left[1] === right[1];

const compareCoordinates = (
  left: BorderGeometryCoordinate,
  right: BorderGeometryCoordinate
): number => {
  const longitudeDiff = left[0] - right[0];
  if (longitudeDiff !== 0) return longitudeDiff;
  return left[1] - right[1];
};

const compareCoordinateSequences = (
  left: readonly BorderGeometryCoordinate[],
  right: readonly BorderGeometryCoordinate[]
): number => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftCoordinate = left[index];
    const rightCoordinate = right[index];
    if (leftCoordinate === undefined || rightCoordinate === undefined) {
      throw new Error('border-geometry-internal-coordinate-sequence-invalid');
    }
    const comparison = compareCoordinates(leftCoordinate, rightCoordinate);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
};

const normalizeCoordinate = (position: Position): BorderGeometryCoordinate => {
  const longitude = position[0];
  const latitude = position[1];
  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  return [longitude, latitude];
};

const requireClosedRing = (ring: readonly Position[]): BorderGeometryCoordinate[] => {
  if (ring.length < 4) {
    throw new Error('border-geometry-ring-coordinate-count-invalid');
  }
  const coordinates = ring.map(normalizeCoordinate);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first === undefined || last === undefined || !coordinatesEqual(first, last)) {
    throw new Error('border-geometry-ring-open');
  }
  return coordinates;
};

const readDefaultFeatureId = (
  feature: BorderGeometrySourceFeature,
  _featureIndex: number
): string => {
  const propertyId = feature.properties?.__hdbFeatureId;
  if (typeof propertyId === 'string' && propertyId.length > 0) return propertyId;
  if (typeof feature.id === 'string' && feature.id.length > 0) return feature.id;
  if (typeof feature.id === 'number' && Number.isFinite(feature.id)) return String(feature.id);
  throw new Error('border-geometry-source-feature-id-required');
};

const buildPolygonId = (featureId: string, polygonIndex: number, polygonCount: number): string =>
  polygonCount === 1 ? featureId : `${featureId}#polygon-${polygonIndex}`;

const buildRingId = (polygonId: string, role: BorderGeometryRingRole, ringIndex: number): string =>
  `${polygonId}#${role}-${ringIndex}`;

const collectRingSources = (options: BorderGeometryExtractionOptions): RingSource[] => {
  const getFeatureId = options.getFeatureId ?? readDefaultFeatureId;
  const sources: RingSource[] = [];
  options.featureCollection.features.forEach((feature, featureIndex) => {
    if (feature.geometry?.type !== 'Polygon' && feature.geometry?.type !== 'MultiPolygon') {
      throw new Error('border-geometry-feature-geometry-unsupported');
    }
    const sourceFeature = feature as BorderGeometrySourceFeature;
    const featureId = getFeatureId(sourceFeature, featureIndex);
    if (featureId.length === 0) {
      throw new Error('border-geometry-source-feature-id-required');
    }
    const polygons =
      sourceFeature.geometry.type === 'Polygon'
        ? [sourceFeature.geometry.coordinates]
        : sourceFeature.geometry.coordinates;
    polygons.forEach((polygon, polygonIndex) => {
      if (polygon.length === 0) {
        throw new Error('border-geometry-polygon-rings-required');
      }
      const polygonId = buildPolygonId(featureId, polygonIndex, polygons.length);
      polygon.forEach((ring, ringIndex) => {
        const role: BorderGeometryRingRole = ringIndex === 0 ? 'outer' : 'inner';
        sources.push({
          feature: sourceFeature,
          featureId,
          polygonId,
          ringId: buildRingId(polygonId, role, ringIndex),
          role,
          coordinates: requireClosedRing(ring),
        });
      });
    });
  });
  return sources;
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

const buildEndpointHash = (coordinates: readonly BorderGeometryCoordinate[]): string => {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  const endpoints = compareCoordinates(first, last) <= 0 ? [first, last] : [last, first];
  return hashCoordinates(endpoints);
};

const canonicalEdgeKey = (
  start: BorderGeometryCoordinate,
  end: BorderGeometryCoordinate
): string => {
  if (coordinatesEqual(start, end)) {
    throw new Error('border-geometry-zero-length-edge');
  }
  const ordered = compareCoordinates(start, end) <= 0 ? [start, end] : [end, start];
  return ordered.map(serializeCoordinate).join('|');
};

const buildEdgeOccurrences = (sources: readonly RingSource[]): Map<string, EdgeOccurrence[]> => {
  const occurrencesByEdge = new Map<string, EdgeOccurrence[]>();
  for (const source of sources) {
    const seenByPolygon = new Set<string>();
    for (let index = 0; index < source.coordinates.length - 1; index += 1) {
      const start = source.coordinates[index];
      const end = source.coordinates[index + 1];
      if (start === undefined || end === undefined) {
        throw new Error('border-geometry-ring-coordinate-count-invalid');
      }
      const edgeKey = canonicalEdgeKey(start, end);
      const polygonEdgeKey = `${source.polygonId}:${edgeKey}`;
      if (seenByPolygon.has(polygonEdgeKey)) {
        throw new Error('border-geometry-duplicate-polygon-edge');
      }
      seenByPolygon.add(polygonEdgeKey);
      const occurrences = occurrencesByEdge.get(edgeKey) ?? [];
      occurrences.push({ polygonId: source.polygonId });
      occurrencesByEdge.set(edgeKey, occurrences);
    }
  }
  return occurrencesByEdge;
};

const resolveOwnersForEdge = (
  occurrencesByEdge: Map<string, EdgeOccurrence[]>,
  edgeKey: string
): readonly string[] => {
  const occurrences = occurrencesByEdge.get(edgeKey);
  if (!occurrences || occurrences.length === 0) {
    throw new Error('border-geometry-edge-owner-missing');
  }
  const ownerPolygonIds = Array.from(
    new Set(occurrences.map((occurrence) => occurrence.polygonId))
  ).sort();
  if (ownerPolygonIds.length > 2) {
    throw new Error('border-geometry-shared-border-owner-cardinality-invalid');
  }
  return ownerPolygonIds;
};

const classifyOwners = (ownerPolygonIds: readonly string[]): BorderGeometryArcClassification => {
  if (ownerPolygonIds.length === 1) return 'coastline';
  if (ownerPolygonIds.length === 2) return 'sharedBorder';
  throw new Error('border-geometry-owner-polygons-required');
};

const sameOwners = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const canonicalizeArcCoordinates = (
  coordinates: readonly BorderGeometryCoordinate[]
): {
  coordinates: readonly BorderGeometryCoordinate[];
  sourceDirection: BorderGeometryArcDirection;
} => {
  const reversed = [...coordinates].reverse();
  if (compareCoordinateSequences(coordinates, reversed) <= 0) {
    return { coordinates, sourceDirection: 'forward' };
  }
  return { coordinates: reversed, sourceDirection: 'reverse' };
};

const buildArcId = (draft: ArcDraft): string => {
  const ownerKey = draft.ownerPolygonIds.join(',');
  const coordinateHash = hashCoordinates(draft.coordinates);
  return `arc:${draft.classification}:${ownerKey}:${coordinateHash}`;
};

const buildArcRecord = (
  options: BorderGeometryExtractionOptions,
  draft: ArcDraft
): BorderGeometryArcRecord => {
  const coordinateHash = hashCoordinates(draft.coordinates);
  return {
    datasetId: options.dataset.datasetId,
    arcId: buildArcId(draft),
    nodeId: options.dataset.nodeId,
    classification: draft.classification,
    orientation: 'lexicographic',
    coordinates: draft.coordinates,
    coordinateHash,
    endpointHash: buildEndpointHash(draft.coordinates),
    ownerPolygonIds: draft.ownerPolygonIds,
    createdFromRevision: options.dataset.createdFromRevision,
    createdAt: options.now,
    updatedAt: options.now,
  };
};

const createOrGetArc = (
  options: BorderGeometryExtractionOptions,
  arcsById: Map<string, BorderGeometryArcRecord>,
  coordinates: readonly BorderGeometryCoordinate[],
  ownerPolygonIds: readonly string[]
): RingArcReferenceDraft => {
  if (coordinates.length < 2) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  const canonical = canonicalizeArcCoordinates(coordinates);
  const classification = classifyOwners(ownerPolygonIds);
  const draft: ArcDraft = {
    classification,
    coordinates: canonical.coordinates,
    ownerPolygonIds,
  };
  const arcId = buildArcId(draft);
  const existing = arcsById.get(arcId);
  if (!existing) {
    arcsById.set(arcId, buildArcRecord(options, draft));
  }
  return {
    arcId,
    direction: canonical.sourceDirection,
  };
};

const buildRingArcReferences = (
  options: BorderGeometryExtractionOptions,
  source: RingSource,
  occurrencesByEdge: Map<string, EdgeOccurrence[]>,
  arcsById: Map<string, BorderGeometryArcRecord>
): readonly RingArcReferenceDraft[] => {
  const references: RingArcReferenceDraft[] = [];
  let groupCoordinates: BorderGeometryCoordinate[] = [];
  let groupOwners: readonly string[] | null = null;
  let groupClassification: BorderGeometryArcClassification | null = null;

  const flushGroup = (): void => {
    if (groupOwners === null || groupClassification === null || groupCoordinates.length < 2) {
      return;
    }
    references.push(createOrGetArc(options, arcsById, groupCoordinates, groupOwners));
    groupCoordinates = [];
    groupOwners = null;
    groupClassification = null;
  };

  for (let index = 0; index < source.coordinates.length - 1; index += 1) {
    const start = source.coordinates[index];
    const end = source.coordinates[index + 1];
    if (start === undefined || end === undefined) {
      throw new Error('border-geometry-ring-coordinate-count-invalid');
    }
    const ownerPolygonIds = resolveOwnersForEdge(occurrencesByEdge, canonicalEdgeKey(start, end));
    const classification = classifyOwners(ownerPolygonIds);
    const canContinue =
      groupOwners !== null &&
      groupClassification === classification &&
      sameOwners(groupOwners, ownerPolygonIds);
    if (!canContinue) {
      flushGroup();
      groupCoordinates = [start, end];
      groupOwners = ownerPolygonIds;
      groupClassification = classification;
      continue;
    }
    groupCoordinates.push(end);
  }
  flushGroup();
  if (references.length === 0) {
    throw new Error('border-geometry-ring-arc-refs-required');
  }
  return references;
};

const ringOrientation = (coordinates: readonly BorderGeometryCoordinate[]): string => {
  let twiceArea = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    if (start === undefined || end === undefined) {
      throw new Error('border-geometry-ring-coordinate-count-invalid');
    }
    twiceArea += (end[0] - start[0]) * (end[1] + start[1]);
  }
  if (twiceArea === 0) {
    throw new Error('border-geometry-ring-orientation-invalid');
  }
  return twiceArea > 0 ? 'clockwise' : 'counterclockwise';
};

export const extractBorderGeometryArcs = (
  options: BorderGeometryExtractionOptions
): BorderGeometryExtractionResult => {
  if (options.outputArtifactIdPrefix.length === 0) {
    throw new Error('border-geometry-output-artifact-id-required');
  }
  if (!Number.isFinite(options.now)) {
    throw new Error('border-geometry-created-at-invalid');
  }
  const sources = collectRingSources(options);
  const occurrencesByEdge = buildEdgeOccurrences(sources);
  const arcsById = new Map<string, BorderGeometryArcRecord>();
  const rings: BorderGeometryRingRecord[] = [];
  const innerRingIdsByPolygon = new Map<string, string[]>();
  const outerRingIdsByPolygon = new Map<string, string>();
  const featureIdByPolygon = new Map<string, string>();

  for (const source of sources) {
    const arcRefs = buildRingArcReferences(options, source, occurrencesByEdge, arcsById);
    rings.push({
      datasetId: options.dataset.datasetId,
      ringId: source.ringId,
      nodeId: options.dataset.nodeId,
      polygonId: source.polygonId,
      role: source.role,
      arcRefs,
      closed: true,
      orientation: ringOrientation(source.coordinates),
      createdFromRevision: options.dataset.createdFromRevision,
      createdAt: options.now,
      updatedAt: options.now,
    });
    featureIdByPolygon.set(source.polygonId, source.featureId);
    if (source.role === 'outer') {
      if (outerRingIdsByPolygon.has(source.polygonId)) {
        throw new Error('border-geometry-polygon-outer-ring-ambiguous');
      }
      outerRingIdsByPolygon.set(source.polygonId, source.ringId);
    } else {
      const innerRingIds = innerRingIdsByPolygon.get(source.polygonId) ?? [];
      innerRingIds.push(source.ringId);
      innerRingIdsByPolygon.set(source.polygonId, innerRingIds);
    }
  }

  const polygonRelations: BorderGeometryPolygonRelationRecord[] = [];
  for (const [polygonId, outerRingId] of outerRingIdsByPolygon.entries()) {
    const sourceFeatureId = featureIdByPolygon.get(polygonId);
    if (sourceFeatureId === undefined) {
      throw new Error('border-geometry-source-feature-id-required');
    }
    polygonRelations.push({
      datasetId: options.dataset.datasetId,
      polygonId,
      nodeId: options.dataset.nodeId,
      outerRingId,
      innerRingIds: innerRingIdsByPolygon.get(polygonId) ?? [],
      sourceFeatureId,
      outputArtifactId: `${options.outputArtifactIdPrefix}:${polygonId}`,
      createdFromRevision: options.dataset.createdFromRevision,
      createdAt: options.now,
      updatedAt: options.now,
    });
  }

  return {
    arcs: Array.from(arcsById.values()).sort((left, right) =>
      left.arcId.localeCompare(right.arcId)
    ),
    rings: rings.sort((left, right) => left.ringId.localeCompare(right.ringId)),
    polygonRelations: polygonRelations.sort((left, right) =>
      left.polygonId.localeCompare(right.polygonId)
    ),
  };
};
