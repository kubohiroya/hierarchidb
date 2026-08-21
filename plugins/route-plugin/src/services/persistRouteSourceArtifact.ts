import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';
import {
  ephemeralDB,
  type EphemeralDB,
  type EphemeralSourceCacheMetaRecord,
  type EphemeralSourceCacheRecord,
} from '@hierarchidb/gis-sdk';
import type { RouteGenerationMethod, RouteMode } from '@hierarchidb/route-api';
import type { RouteGenerationResult } from '@hierarchidb/route-engine';
import type { RouteSourceIdentity } from './routeSourceIdentity.js';

export type RouteSourceArtifactOutput = {
  sourceCacheId: string;
  sourceKey: string;
  inputHash: string;
  contentHash: string;
  format: 'geojson';
  featureCount: 1;
  vertexCount: number;
};

export type PersistRouteSourceArtifactParams = {
  nodeId: NodeId;
  routeMode: RouteMode;
  generationMethod: RouteGenerationMethod;
  identity: RouteSourceIdentity;
  generationResult: RouteGenerationResult;
  generationTimeMs: number;
  store?: EphemeralDB;
};

const sourceArtifactHasher = new NobleSha3HashPort();

export const persistRouteSourceArtifact = async (
  params: PersistRouteSourceArtifactParams
): Promise<RouteSourceArtifactOutput> => {
  const store = params.store ?? ephemeralDB;
  const lineGeometry = requireLineGeometry(params.generationResult.lineGeometry);
  const distanceMeters = requireFiniteNonNegative(
    'generationResult.distance',
    params.generationResult.distance
  );
  const durationSeconds = requireOptionalFiniteNonNegative(
    'generationResult.duration',
    params.generationResult.duration
  );
  const generationTimeMs = requireFiniteNonNegative(
    'generationTimeMs',
    params.generationTimeMs
  );
  const sourceCacheId = `${String(params.nodeId)}:source:${params.identity.sourceKey}`;
  const payload = buildFeatureCollection({
    sourceCacheId,
    routeMode: params.routeMode,
    generationMethod: params.generationMethod,
    identity: params.identity,
    lineGeometry,
    distanceMeters,
    durationSeconds,
  });
  const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
  const contentHash = sourceArtifactHasher.digest(data, 'sha3-256');
  const bbox = buildLineBbox(lineGeometry);
  const metadata = {
    stage: 'source',
    status: 'completed',
    sourceKey: params.identity.sourceKey,
    inputHash: params.identity.inputHash,
    contentHash,
    routeMode: params.routeMode,
    bidirectional: params.identity.bidirectional,
    generationMethod: params.generationMethod,
    startLocationId: String(params.identity.from.locationId),
    endLocationId: String(params.identity.to.locationId),
    startCoordinates: [...params.identity.from.coordinates],
    endCoordinates: [...params.identity.to.coordinates],
    distanceMeters,
    durationSeconds: durationSeconds ?? null,
    waypointCount: lineGeometry.length - 2,
    featureCount: 1,
    vertexCount: lineGeometry.length,
  } satisfies Record<string, unknown>;
  const record: EphemeralSourceCacheRecord = {
    id: sourceCacheId,
    nodeId: params.nodeId,
    domainType: 'route',
    sourceKey: params.identity.sourceKey,
    data,
    format: 'geojson',
    compression: 'none',
    featureCount: 1,
    inputFeatureCount: 1,
    bbox,
    downloadTime: generationTimeMs,
    size: data.byteLength,
    contentHash,
    vertexCount: lineGeometry.length,
    polygonCount: 0,
    inputVertexCount: 2,
    inputPolygonCount: 0,
    metadata,
    timestamp: 0,
  };

  await store.transaction('rw', [store.sourceCache, store.sourceCacheMeta], async () => {
    await store.sourceCache.put(record);
    const completedAt = Date.now();
    if (!Number.isFinite(completedAt) || completedAt <= 0) {
      return contractViolation('timestamp', 'must be a positive finite number');
    }
    const updated = await store.sourceCache.update(sourceCacheId, { timestamp: completedAt });
    if (updated !== 1) {
      return contractViolation('sourceCache', 'did not persist the generated artifact');
    }
    const { data: _data, ...completedMeta } = {
      ...record,
      timestamp: completedAt,
    };
    void _data;
    await store.sourceCacheMeta.put(completedMeta);
    const [persistedRecord, persistedMeta] = await Promise.all([
      store.sourceCache.get(sourceCacheId),
      store.sourceCacheMeta.get(sourceCacheId),
    ]);
    requirePersistedArtifact(persistedRecord, persistedMeta, {
      sourceCacheId,
      nodeId: params.nodeId,
      sourceKey: params.identity.sourceKey,
      inputHash: params.identity.inputHash,
      contentHash,
    });
  });

  return {
    sourceCacheId,
    sourceKey: params.identity.sourceKey,
    inputHash: params.identity.inputHash,
    contentHash,
    format: 'geojson',
    featureCount: 1,
    vertexCount: lineGeometry.length,
  };
};

const buildFeatureCollection = (params: {
  sourceCacheId: string;
  routeMode: RouteMode;
  generationMethod: RouteGenerationMethod;
  identity: RouteSourceIdentity;
  lineGeometry: [number, number][];
  distanceMeters: number;
  durationSeconds?: number;
}) => ({
  type: 'FeatureCollection' as const,
  features: [{
    type: 'Feature' as const,
    id: params.sourceCacheId,
    properties: {
      sourceKey: params.identity.sourceKey,
      inputHash: params.identity.inputHash,
      routeMode: params.routeMode,
      bidirectional: params.identity.bidirectional,
      generationMethod: params.generationMethod,
      startLocationId: String(params.identity.from.locationId),
      endLocationId: String(params.identity.to.locationId),
      distanceMeters: params.distanceMeters,
      durationSeconds: params.durationSeconds ?? null,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: params.lineGeometry,
    },
  }],
});

const requireLineGeometry = (value: unknown): [number, number][] => {
  if (!Array.isArray(value) || value.length < 2) {
    return contractViolation('generationResult.lineGeometry', 'must contain at least two coordinates');
  }
  return value.map((coordinate, index) => requireCoordinate(
    `generationResult.lineGeometry[${String(index)}]`,
    coordinate
  ));
};

const requireCoordinate = (label: string, value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    return contractViolation(label, 'must be a longitude/latitude pair');
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number'
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || typeof latitude !== 'number'
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
  ) {
    return contractViolation(label, 'contains invalid coordinates');
  }
  return [longitude, latitude];
};

const requireFiniteNonNegative = (label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return contractViolation(label, 'must be a finite non-negative number');
  }
  return value;
};

const requireOptionalFiniteNonNegative = (
  label: string,
  value: unknown
): number | undefined => {
  if (value === undefined) return undefined;
  return requireFiniteNonNegative(label, value);
};

const buildLineBbox = (
  coordinates: [number, number][]
): [number, number, number, number] => {
  let minLongitude = coordinates[0]?.[0];
  let minLatitude = coordinates[0]?.[1];
  let maxLongitude = minLongitude;
  let maxLatitude = minLatitude;
  if (
    minLongitude === undefined
    || minLatitude === undefined
    || maxLongitude === undefined
    || maxLatitude === undefined
  ) {
    return contractViolation('generationResult.lineGeometry', 'must not be empty');
  }
  for (const [longitude, latitude] of coordinates.slice(1)) {
    minLongitude = Math.min(minLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  }
  return [minLongitude, minLatitude, maxLongitude, maxLatitude];
};

const requirePersistedArtifact = (
  record: EphemeralSourceCacheRecord | undefined,
  meta: EphemeralSourceCacheMetaRecord | undefined,
  expected: {
    sourceCacheId: string;
    nodeId: NodeId;
    sourceKey: string;
    inputHash: string;
    contentHash: string;
  }
): void => {
  const persistedRecord = record
    ?? contractViolation('sourceCache record', 'must exist after artifact persistence');
  const persistedMeta = meta
    ?? contractViolation('sourceCache metadata', 'must exist with the source artifact');
  requirePersistedArtifactRecord(persistedRecord, expected);
  requirePersistedArtifactRecord(persistedMeta, expected);
};

const requirePersistedArtifactRecord = (
  candidate: EphemeralSourceCacheRecord | EphemeralSourceCacheMetaRecord,
  expected: {
    sourceCacheId: string;
    nodeId: NodeId;
    sourceKey: string;
    inputHash: string;
    contentHash: string;
  }
): void => {
  if (
    candidate.id !== expected.sourceCacheId
    || candidate.nodeId !== expected.nodeId
    || candidate.domainType !== 'route'
    || candidate.sourceKey !== expected.sourceKey
    || candidate.format !== 'geojson'
    || candidate.compression !== 'none'
    || candidate.featureCount !== 1
    || candidate.contentHash !== expected.contentHash
    || !Number.isFinite(candidate.timestamp)
    || candidate.timestamp <= 0
    || candidate.metadata?.inputHash !== expected.inputHash
  ) {
    contractViolation('sourceCache metadata', 'does not match the generated artifact');
  }
};

const contractViolation = (field: string, expectation: string): never => {
  throw new Error(`[route-source-artifact] ${field} ${expectation}`);
};
