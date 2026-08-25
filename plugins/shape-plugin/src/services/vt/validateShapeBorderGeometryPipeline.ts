import type { NodeId } from '@hierarchidb/core-types';
import { buildStableJsonSignature } from '@hierarchidb/gis-sdk';
import {
  type BorderGeometryDatasetRecord,
  type BorderGeometryExtractionResult,
  type BorderGeometryPolygonReconstructionResult,
  type BorderGeometryStorageFlagOptions,
  extractBorderGeometryArcs,
  isShapeBorderGeometryStorageEnabled,
  reconstructBorderGeometryPolygons,
  type ShapeDB,
  simplifyBorderGeometryArcs,
} from '@hierarchidb/shape-store';
import type { FeatureCollection, Geometry } from 'geojson';

export type ShapeBorderGeometryPipelineValidationSkipped = {
  status: 'skipped';
  reason: 'feature-disabled';
};

export type ShapeBorderGeometryPipelineValidationCompleted = {
  status: 'completed';
  dataset: BorderGeometryDatasetRecord;
  extraction: BorderGeometryExtractionResult;
  reconstruction: BorderGeometryPolygonReconstructionResult;
  metrics: {
    durationMs: number;
    arcCount: number;
    ringCount: number;
    polygonRelationCount: number;
    reconstructedPolygonCount: number;
  };
};

export type ShapeBorderGeometryPipelineValidationResult =
  | ShapeBorderGeometryPipelineValidationSkipped
  | ShapeBorderGeometryPipelineValidationCompleted;

export type ValidateShapeBorderGeometryPipelineParams = {
  shapeDb: ShapeDB;
  nodeId: NodeId;
  dataSource: string;
  countryCode: string;
  adminLevel: number;
  sourceKey: string;
  upstreamRevision: string;
  borderGeometryConfigHash: string;
  featureCollection: FeatureCollection<Geometry, Record<string, unknown>>;
  outputArtifactIdPrefix: string;
  simplifyTolerance: number;
  now: number;
  schemaVersion?: number;
  storage?: {
    enabled: boolean;
  };
};

const requireFiniteTimestamp = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new Error('border-geometry-pipeline-timestamp-invalid');
  }
  return value;
};

const requireNonEmptyString = (field: string, value: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`border-geometry-pipeline-${field}-required`);
  }
  return value;
};

const requireAdminLevel = (value: number): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('border-geometry-pipeline-admin-level-invalid');
  }
  return value;
};

const buildDatasetId = (
  params: ValidateShapeBorderGeometryPipelineParams,
  sourceKey: string,
  upstreamRevision: string,
  borderGeometryConfigHash: string,
  schemaVersion: number
): string =>
  `dataset:${buildStableJsonSignature({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    sourceKey,
    upstreamRevision,
    borderGeometryConfigHash,
    schemaVersion,
  })}`;

const buildDatasetRecord = (
  params: ValidateShapeBorderGeometryPipelineParams
): BorderGeometryDatasetRecord => {
  const now = requireFiniteTimestamp(params.now);
  const sourceKey = requireNonEmptyString('source-key', params.sourceKey);
  const upstreamRevision = requireNonEmptyString('upstream-revision', params.upstreamRevision);
  const borderGeometryConfigHash = requireNonEmptyString(
    'config-hash',
    params.borderGeometryConfigHash
  );
  const schemaVersion = params.schemaVersion ?? 1;
  return {
    datasetId: buildDatasetId(
      params,
      sourceKey,
      upstreamRevision,
      borderGeometryConfigHash,
      schemaVersion
    ),
    nodeId: params.nodeId,
    dataSource: requireNonEmptyString('data-source', params.dataSource),
    countryCode: requireNonEmptyString('country-code', params.countryCode),
    adminLevel: requireAdminLevel(params.adminLevel),
    sourceKey,
    upstreamRevision,
    borderGeometryConfigHash,
    schemaVersion,
    createdFromRevision: upstreamRevision,
    createdAt: now,
    updatedAt: now,
  };
};

const storeValidationArtifacts = async (
  shapeDb: ShapeDB,
  dataset: BorderGeometryDatasetRecord,
  extraction: BorderGeometryExtractionResult,
  storage?: BorderGeometryStorageFlagOptions
): Promise<void> => {
  await shapeDb.transaction(
    'rw',
    [
      shapeDb.borderGeometryDatasets,
      shapeDb.borderGeometryArcs,
      shapeDb.borderGeometryRings,
      shapeDb.borderGeometryPolygonRelations,
      shapeDb.borderSpatialIndexes,
    ],
    async () => {
      await Promise.all([
        shapeDb.borderGeometryDatasets.delete(dataset.datasetId),
        shapeDb.borderGeometryArcs.where('datasetId').equals(dataset.datasetId).delete(),
        shapeDb.borderGeometryRings.where('datasetId').equals(dataset.datasetId).delete(),
        shapeDb.borderGeometryPolygonRelations
          .where('datasetId')
          .equals(dataset.datasetId)
          .delete(),
        shapeDb.borderSpatialIndexes.where('datasetId').equals(dataset.datasetId).delete(),
      ]);
      await shapeDb.putBorderGeometryDataset(dataset, storage);
      for (const arc of extraction.arcs) {
        await shapeDb.putBorderGeometryArc(arc, storage);
      }
      for (const ring of extraction.rings) {
        await shapeDb.putBorderGeometryRing(ring, storage);
      }
      for (const relation of extraction.polygonRelations) {
        await shapeDb.putBorderGeometryPolygonRelation(relation, storage);
      }
    }
  );
};

export const validateShapeBorderGeometryPipeline = async (
  params: ValidateShapeBorderGeometryPipelineParams
): Promise<ShapeBorderGeometryPipelineValidationResult> => {
  const storage = params.storage;
  if (!isShapeBorderGeometryStorageEnabled(storage)) {
    return {
      status: 'skipped',
      reason: 'feature-disabled',
    };
  }

  const startedAt = Date.now();
  const dataset = buildDatasetRecord(params);
  const extraction = extractBorderGeometryArcs({
    dataset,
    featureCollection: params.featureCollection,
    outputArtifactIdPrefix: requireNonEmptyString(
      'output-artifact-id-prefix',
      params.outputArtifactIdPrefix
    ),
    now: params.now,
  });
  const simplified = simplifyBorderGeometryArcs({
    extraction,
    tolerance: params.simplifyTolerance,
    now: params.now,
  });
  const reconstruction = reconstructBorderGeometryPolygons({
    dataset,
    extraction: simplified,
    now: params.now,
  });
  await storeValidationArtifacts(params.shapeDb, dataset, simplified, storage);

  return {
    status: 'completed',
    dataset,
    extraction: simplified,
    reconstruction,
    metrics: {
      durationMs: Date.now() - startedAt,
      arcCount: simplified.arcs.length,
      ringCount: simplified.rings.length,
      polygonRelationCount: simplified.polygonRelations.length,
      reconstructedPolygonCount: reconstruction.polygons.length,
    },
  };
};
