import type { NodeId } from '@hierarchidb/core-types';

export type BorderGeometryArcClassification = 'coastline' | 'sharedBorder';
export type BorderGeometryRingRole = 'outer' | 'inner';
export type BorderGeometryArcDirection = 'forward' | 'reverse';
export type BorderGeometrySpatialIndexKind =
  | 'arcBounds'
  | 'ringBounds'
  | 'polygonBounds'
  | 'tileCover';

export type BorderGeometryBoundingBox = readonly [number, number, number, number];
export type BorderGeometryCoordinate = readonly [number, number];

export interface BorderGeometryDatasetRecord {
  datasetId: string;
  nodeId: NodeId;
  dataSource: string;
  countryCode: string;
  adminLevel: number;
  sourceKey: string;
  upstreamRevision: string;
  borderGeometryConfigHash: string;
  schemaVersion: number;
  createdFromRevision: string;
  createdAt: number;
  updatedAt: number;
}

export interface BorderGeometryArcRecord {
  datasetId: string;
  arcId: string;
  nodeId: NodeId;
  classification: BorderGeometryArcClassification;
  orientation: string;
  coordinates: readonly BorderGeometryCoordinate[];
  coordinateHash: string;
  endpointHash: string;
  ownerPolygonIds: readonly string[];
  createdFromRevision: string;
  createdAt: number;
  updatedAt: number;
}

export interface BorderGeometryArcReference {
  arcId: string;
  direction: BorderGeometryArcDirection;
}

export interface BorderGeometryRingRecord {
  datasetId: string;
  ringId: string;
  nodeId: NodeId;
  polygonId: string;
  role: BorderGeometryRingRole;
  arcRefs: readonly BorderGeometryArcReference[];
  closed: boolean;
  orientation: string;
  createdFromRevision: string;
  createdAt: number;
  updatedAt: number;
}

export interface BorderGeometryPolygonRelationRecord {
  datasetId: string;
  polygonId: string;
  nodeId: NodeId;
  outerRingId: string;
  innerRingIds: readonly string[];
  sourceFeatureId: string;
  outputArtifactId: string;
  createdFromRevision: string;
  createdAt: number;
  updatedAt: number;
}

export interface BorderGeometrySpatialIndexRecord {
  datasetId: string;
  indexId: string;
  nodeId: NodeId;
  sourceKey: string;
  schemaVersion: number;
  indexKind: BorderGeometrySpatialIndexKind;
  indexConfigHash: string;
  bounds: BorderGeometryBoundingBox;
  targetIds: readonly string[];
  createdFromRevision: string;
  createdAt: number;
  updatedAt: number;
}
