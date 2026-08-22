import type {
  BorderGeometryArcDirection,
  BorderGeometryArcRecord,
  BorderGeometryDatasetRecord,
  BorderGeometryPolygonRelationRecord,
  BorderGeometryRingRecord,
  BorderGeometrySpatialIndexRecord,
} from './BorderGeometryStorageTypes.js';

const ISO2_COUNTRY_CODE = /^[A-Z]{2}$/u;
const SOURCE_KEY = /^[A-Z]{2}:\d+$/u;

const requireNonEmptyString = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(code);
  }
  return value;
};

const requireFiniteNumber = (value: unknown, code: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(code);
  }
  return value;
};

const requireInteger = (value: unknown, code: string): number => {
  const number = requireFiniteNumber(value, code);
  if (!Number.isInteger(number)) {
    throw new Error(code);
  }
  return number;
};

const requireNonEmptyStringArray = (value: readonly string[], code: string): void => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(code);
  }
  for (const item of value) {
    requireNonEmptyString(item, code);
  }
};

const validateWgs84Coordinate = (value: unknown, code: string): void => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(code);
  }
  const longitude = requireFiniteNumber(value[0], code);
  const latitude = requireFiniteNumber(value[1], code);
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(code);
  }
};

export const validateBorderGeometryDatasetRecord = (record: BorderGeometryDatasetRecord): void => {
  requireNonEmptyString(record.datasetId, 'border-geometry-dataset-id-required');
  requireNonEmptyString(record.nodeId, 'border-geometry-node-id-required');
  requireNonEmptyString(record.dataSource, 'border-geometry-data-source-required');
  const countryCode = requireNonEmptyString(
    record.countryCode,
    'border-geometry-country-code-required'
  );
  if (!ISO2_COUNTRY_CODE.test(countryCode)) {
    throw new Error('border-geometry-country-code-invalid');
  }
  const adminLevel = requireInteger(record.adminLevel, 'border-geometry-admin-level-invalid');
  if (adminLevel < 0) {
    throw new Error('border-geometry-admin-level-invalid');
  }
  const sourceKey = requireNonEmptyString(record.sourceKey, 'border-geometry-source-key-required');
  if (!SOURCE_KEY.test(sourceKey) || sourceKey !== `${countryCode}:${adminLevel}`) {
    throw new Error('border-geometry-source-key-invalid');
  }
  requireNonEmptyString(record.upstreamRevision, 'border-geometry-upstream-revision-required');
  requireNonEmptyString(record.borderGeometryConfigHash, 'border-geometry-config-hash-required');
  const schemaVersion = requireInteger(
    record.schemaVersion,
    'border-geometry-schema-version-invalid'
  );
  if (schemaVersion <= 0) {
    throw new Error('border-geometry-schema-version-invalid');
  }
  requireNonEmptyString(record.createdFromRevision, 'border-geometry-created-revision-required');
  requireFiniteNumber(record.createdAt, 'border-geometry-created-at-invalid');
  requireFiniteNumber(record.updatedAt, 'border-geometry-updated-at-invalid');
};

export const validateBorderGeometryArcRecord = (record: BorderGeometryArcRecord): void => {
  requireNonEmptyString(record.datasetId, 'border-geometry-dataset-id-required');
  requireNonEmptyString(record.arcId, 'border-geometry-arc-id-required');
  requireNonEmptyString(record.nodeId, 'border-geometry-node-id-required');
  if (record.classification !== 'coastline' && record.classification !== 'sharedBorder') {
    throw new Error('border-geometry-arc-classification-invalid');
  }
  requireNonEmptyString(record.orientation, 'border-geometry-arc-orientation-required');
  if (!Array.isArray(record.coordinates) || record.coordinates.length < 2) {
    throw new Error('border-geometry-arc-coordinates-invalid');
  }
  for (const coordinate of record.coordinates) {
    validateWgs84Coordinate(coordinate, 'border-geometry-arc-coordinates-invalid');
  }
  requireNonEmptyString(record.coordinateHash, 'border-geometry-coordinate-hash-required');
  requireNonEmptyString(record.endpointHash, 'border-geometry-endpoint-hash-required');
  requireNonEmptyStringArray(record.ownerPolygonIds, 'border-geometry-owner-polygons-required');
  if (record.classification === 'sharedBorder' && record.ownerPolygonIds.length !== 2) {
    throw new Error('border-geometry-shared-border-owner-cardinality-invalid');
  }
  requireNonEmptyString(record.createdFromRevision, 'border-geometry-created-revision-required');
  requireFiniteNumber(record.createdAt, 'border-geometry-created-at-invalid');
  requireFiniteNumber(record.updatedAt, 'border-geometry-updated-at-invalid');
};

const validateArcDirection = (direction: BorderGeometryArcDirection): void => {
  if (direction !== 'forward' && direction !== 'reverse') {
    throw new Error('border-geometry-arc-direction-invalid');
  }
};

export const validateBorderGeometryRingRecord = (record: BorderGeometryRingRecord): void => {
  requireNonEmptyString(record.datasetId, 'border-geometry-dataset-id-required');
  requireNonEmptyString(record.ringId, 'border-geometry-ring-id-required');
  requireNonEmptyString(record.nodeId, 'border-geometry-node-id-required');
  requireNonEmptyString(record.polygonId, 'border-geometry-polygon-id-required');
  if (record.role !== 'outer' && record.role !== 'inner') {
    throw new Error('border-geometry-ring-role-invalid');
  }
  if (!Array.isArray(record.arcRefs) || record.arcRefs.length === 0) {
    throw new Error('border-geometry-ring-arc-refs-required');
  }
  for (const arcRef of record.arcRefs) {
    requireNonEmptyString(arcRef.arcId, 'border-geometry-ring-arc-ref-id-required');
    validateArcDirection(arcRef.direction);
  }
  if (record.closed !== true) {
    throw new Error('border-geometry-ring-open');
  }
  requireNonEmptyString(record.orientation, 'border-geometry-ring-orientation-required');
  requireNonEmptyString(record.createdFromRevision, 'border-geometry-created-revision-required');
  requireFiniteNumber(record.createdAt, 'border-geometry-created-at-invalid');
  requireFiniteNumber(record.updatedAt, 'border-geometry-updated-at-invalid');
};

export const validateBorderGeometryPolygonRelationRecord = (
  record: BorderGeometryPolygonRelationRecord
): void => {
  requireNonEmptyString(record.datasetId, 'border-geometry-dataset-id-required');
  requireNonEmptyString(record.polygonId, 'border-geometry-polygon-id-required');
  requireNonEmptyString(record.nodeId, 'border-geometry-node-id-required');
  requireNonEmptyString(record.outerRingId, 'border-geometry-polygon-outer-ring-id-required');
  if (!Array.isArray(record.innerRingIds)) {
    throw new Error('border-geometry-polygon-inner-ring-ids-invalid');
  }
  for (const ringId of record.innerRingIds) {
    requireNonEmptyString(ringId, 'border-geometry-polygon-inner-ring-ids-invalid');
  }
  requireNonEmptyString(record.sourceFeatureId, 'border-geometry-source-feature-id-required');
  requireNonEmptyString(record.outputArtifactId, 'border-geometry-output-artifact-id-required');
  requireNonEmptyString(record.createdFromRevision, 'border-geometry-created-revision-required');
  requireFiniteNumber(record.createdAt, 'border-geometry-created-at-invalid');
  requireFiniteNumber(record.updatedAt, 'border-geometry-updated-at-invalid');
};

export const validateBorderGeometrySpatialIndexRecord = (
  record: BorderGeometrySpatialIndexRecord
): void => {
  requireNonEmptyString(record.datasetId, 'border-geometry-dataset-id-required');
  requireNonEmptyString(record.indexId, 'border-geometry-index-id-required');
  requireNonEmptyString(record.nodeId, 'border-geometry-node-id-required');
  requireNonEmptyString(record.sourceKey, 'border-geometry-source-key-required');
  const schemaVersion = requireInteger(
    record.schemaVersion,
    'border-geometry-schema-version-invalid'
  );
  if (schemaVersion <= 0) {
    throw new Error('border-geometry-schema-version-invalid');
  }
  if (
    record.indexKind !== 'arcBounds' &&
    record.indexKind !== 'ringBounds' &&
    record.indexKind !== 'polygonBounds' &&
    record.indexKind !== 'tileCover'
  ) {
    throw new Error('border-geometry-index-kind-invalid');
  }
  requireNonEmptyString(record.indexConfigHash, 'border-geometry-index-config-hash-required');
  if (!Array.isArray(record.bounds) || record.bounds.length !== 4) {
    throw new Error('border-geometry-index-bounds-invalid');
  }
  const [minX, minY, maxX, maxY] = record.bounds;
  for (const coordinate of record.bounds) {
    requireFiniteNumber(coordinate, 'border-geometry-index-bounds-invalid');
  }
  if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90 || minX > maxX || minY > maxY) {
    throw new Error('border-geometry-index-bounds-invalid');
  }
  if (!Array.isArray(record.targetIds)) {
    throw new Error('border-geometry-index-target-ids-invalid');
  }
  for (const targetId of record.targetIds) {
    requireNonEmptyString(targetId, 'border-geometry-index-target-ids-invalid');
  }
  requireNonEmptyString(record.createdFromRevision, 'border-geometry-created-revision-required');
  requireFiniteNumber(record.createdAt, 'border-geometry-created-at-invalid');
  requireFiniteNumber(record.updatedAt, 'border-geometry-updated-at-invalid');
};
