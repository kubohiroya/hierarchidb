import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';
import {
  buildStableJsonSignature,
  type EphemeralDB,
  type EphemeralGeometryCacheMetaRecord,
  type EphemeralGeometryCacheRecord,
  type EphemeralSourceCacheMetaRecord,
  type EphemeralSourceCacheRecord,
  type EphemeralTileIdToBufferRelation,
  ephemeralDB,
  geometrySimplify,
} from '@hierarchidb/gis-sdk';
import type { RouteBuildConfig, RouteMode } from '@hierarchidb/route-api';
import { collectLineStringTileIds } from '@hierarchidb/vt-orchestrator';

export type RouteGeometryArtifactOutput = {
  sourceCacheId: string;
  sourceKey: string;
  sourceInputHash: string;
  artifacts: Array<{
    geometryCacheId: string;
    bandIndex: number;
    zMin: number;
    zMax: number;
    zBase: number;
    inputHash: string;
    contentHash: string;
    featureCount: 0 | 1;
    vertexCount: number;
    tileCount: number;
    filtered: boolean;
  }>;
  relationCount: number;
};

export type PersistRouteGeometryArtifactsParams = {
  nodeId: NodeId;
  sourceCacheId: string;
  expected: {
    sourceKey: string;
    sourceInputHash: string;
    routeMode: RouteMode;
    startLocationId: NodeId;
    endLocationId: NodeId;
    startCoordinates: [number, number];
    endCoordinates: [number, number];
  };
  geometryConfig: RouteBuildConfig['geometryConfig'];
  routeGeometryConfig: RouteBuildConfig['routeGeometryConfig'];
  signal?: AbortSignal;
  store?: EphemeralDB;
};

type SourceArtifact = {
  record: EphemeralSourceCacheRecord;
  coordinates: [number, number][];
  properties: Record<string, unknown>;
  distanceMeters: number;
  contentHash: string;
};

type GeometryBand = {
  bandIndex: number;
  zMin: number;
  zMax: number;
  zBase: number;
  minDistanceMeters: number;
  simplifyTolerance: number;
};

type PreparedGeometryArtifact = RouteGeometryArtifactOutput['artifacts'][number] & {
  data: ArrayBuffer;
  extractionRatio: number;
  sourceKey: string;
  metadata: Record<string, unknown>;
  tileIds: number[];
  tolerance: number;
};

const geometryArtifactHasher = new NobleSha3HashPort();

export const persistRouteGeometryArtifacts = async (
  params: PersistRouteGeometryArtifactsParams
): Promise<RouteGeometryArtifactOutput> => {
  requireNotAborted(params.signal);
  const store = params.store ?? ephemeralDB;
  const source = await readSourceArtifact(store, params);
  requireNotAborted(params.signal);
  const bands = requireGeometryBands(params.geometryConfig, params.routeGeometryConfig);
  const prepared = bands.map((band) => prepareGeometryArtifact(params, source, band));
  requireNotAborted(params.signal);
  await persistPreparedArtifacts(store, params, prepared);
  requireNotAborted(params.signal);
  return {
    sourceCacheId: params.sourceCacheId,
    sourceKey: params.expected.sourceKey,
    sourceInputHash: params.expected.sourceInputHash,
    artifacts: prepared.map(
      ({
        data: _data,
        extractionRatio: _extractionRatio,
        metadata: _metadata,
        sourceKey: _sourceKey,
        tileIds: _tileIds,
        tolerance: _tolerance,
        ...artifact
      }) => {
        void _data;
        void _extractionRatio;
        void _metadata;
        void _sourceKey;
        void _tileIds;
        void _tolerance;
        return artifact;
      }
    ),
    relationCount: prepared.reduce((total, artifact) => total + artifact.tileIds.length, 0),
  };
};

const readSourceArtifact = async (
  store: EphemeralDB,
  params: PersistRouteGeometryArtifactsParams
): Promise<SourceArtifact> => {
  const [record, meta] = await store.transaction(
    'r',
    [store.sourceCache, store.sourceCacheMeta],
    async () =>
      Promise.all([
        store.sourceCache.get(params.sourceCacheId),
        store.sourceCacheMeta.get(params.sourceCacheId),
      ])
  );
  const sourceRecord =
    record ?? contractViolation('sourceCache record', `is missing for ${params.sourceCacheId}`);
  const sourceMeta =
    meta ?? contractViolation('sourceCache metadata', `is missing for ${params.sourceCacheId}`);
  requireSourceRecord(sourceRecord, sourceMeta, params);
  if (!(sourceRecord.data instanceof ArrayBuffer)) {
    const candidate = sourceRecord.data as unknown as {
      byteLength?: unknown;
      constructor?: { name?: unknown };
    };
    return contractViolation(
      'sourceCache.data',
      `must be an ArrayBuffer (tag=${Object.prototype.toString.call(sourceRecord.data)}, constructor=${String(candidate.constructor?.name)}, byteLength=${String(candidate.byteLength)})`
    );
  }
  if (sourceRecord.data.byteLength !== sourceRecord.size || sourceRecord.size <= 0) {
    return contractViolation(
      'sourceCache.data',
      `must match the positive stored size (byteLength=${String(sourceRecord.data.byteLength)}, size=${String(sourceRecord.size)})`
    );
  }
  const actualContentHash = geometryArtifactHasher.digest(sourceRecord.data, 'sha3-256');
  if (actualContentHash !== sourceRecord.contentHash) {
    return contractViolation(
      'sourceCache.contentHash',
      `does not match the stored data (expected=${String(sourceRecord.contentHash)}, actual=${actualContentHash})`
    );
  }
  const decoded = decodeSourceFeatureCollection(sourceRecord.data);
  if (decoded.featureId !== params.sourceCacheId) {
    return contractViolation(
      'source artifact feature.id',
      `must equal the source cache id ${params.sourceCacheId}`
    );
  }
  if (decoded.coordinates.length !== sourceRecord.vertexCount) {
    return contractViolation(
      'source artifact vertexCount',
      `does not match the decoded geometry (stored=${String(sourceRecord.vertexCount)}, decoded=${String(decoded.coordinates.length)})`
    );
  }
  requireSourceProperties(decoded.properties, params, sourceRecord.contentHash);
  requireCoordinateEquals(
    'source artifact first coordinate',
    decoded.coordinates[0],
    params.expected.startCoordinates
  );
  requireCoordinateEquals(
    'source artifact last coordinate',
    decoded.coordinates[decoded.coordinates.length - 1],
    params.expected.endCoordinates
  );
  return {
    record: sourceRecord,
    coordinates: decoded.coordinates,
    properties: decoded.properties,
    distanceMeters: requireFiniteNonNegative(
      'source artifact properties.distanceMeters',
      decoded.properties.distanceMeters
    ),
    contentHash: sourceRecord.contentHash,
  };
};

const requireSourceRecord = (
  record: EphemeralSourceCacheRecord,
  meta: EphemeralSourceCacheMetaRecord,
  params: PersistRouteGeometryArtifactsParams
): void => {
  for (const candidate of [record, meta]) {
    if (
      candidate.id !== params.sourceCacheId ||
      candidate.nodeId !== params.nodeId ||
      candidate.domainType !== 'route' ||
      candidate.sourceKey !== params.expected.sourceKey ||
      candidate.format !== 'geojson' ||
      candidate.compression !== 'none' ||
      candidate.featureCount !== 1 ||
      !Number.isInteger(candidate.vertexCount) ||
      (candidate.vertexCount as number) < 2 ||
      typeof candidate.contentHash !== 'string' ||
      candidate.contentHash.length === 0 ||
      !Number.isFinite(candidate.timestamp) ||
      candidate.timestamp <= 0 ||
      candidate.metadata?.inputHash !== params.expected.sourceInputHash ||
      candidate.metadata?.routeMode !== params.expected.routeMode
    ) {
      contractViolation('sourceCache record', 'does not satisfy the geometry input contract');
    }
  }
  if (record.contentHash !== meta.contentHash || record.timestamp !== meta.timestamp) {
    contractViolation('sourceCache metadata', 'does not mirror the source artifact');
  }
};

const decodeSourceFeatureCollection = (
  data: ArrayBuffer
): {
  featureId: unknown;
  coordinates: [number, number][];
  properties: Record<string, unknown>;
} => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return contractViolation('source artifact data', `must be valid JSON: ${reason}`);
  }
  const collection = requireRecord('source artifact', parsed);
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return contractViolation('source artifact', 'must be a GeoJSON FeatureCollection');
  }
  if (collection.features.length !== 1) {
    return contractViolation('source artifact features', 'must contain exactly one feature');
  }
  const feature = requireRecord('source artifact feature', collection.features[0]);
  const geometry = requireRecord('source artifact geometry', feature.geometry);
  if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return contractViolation('source artifact geometry', 'must be a LineString');
  }
  if (geometry.coordinates.length < 2) {
    return contractViolation(
      'source artifact geometry.coordinates',
      'must contain at least two positions'
    );
  }
  const coordinates = geometry.coordinates.map((coordinate, index) =>
    requireCoordinate(`source artifact geometry.coordinates[${String(index)}]`, coordinate)
  );
  const properties = requireRecord('source artifact properties', feature.properties);
  return { featureId: feature.id, coordinates, properties };
};

const requireSourceProperties = (
  properties: Record<string, unknown>,
  params: PersistRouteGeometryArtifactsParams,
  contentHash: string
): void => {
  if (
    properties.sourceKey !== params.expected.sourceKey ||
    properties.inputHash !== params.expected.sourceInputHash ||
    properties.routeMode !== params.expected.routeMode ||
    properties.startLocationId !== String(params.expected.startLocationId) ||
    properties.endLocationId !== String(params.expected.endLocationId) ||
    typeof properties.bidirectional !== 'boolean' ||
    typeof properties.generationMethod !== 'string' ||
    properties.generationMethod.length === 0 ||
    typeof contentHash !== 'string' ||
    contentHash.length === 0
  ) {
    contractViolation('source artifact properties', 'do not match the planned route task');
  }
};

const requireGeometryBands = (
  geometryConfig: RouteBuildConfig['geometryConfig'],
  routeGeometryConfig: RouteBuildConfig['routeGeometryConfig']
): GeometryBand[] => {
  if (geometryConfig.enableFeatureFiltering !== true) {
    return contractViolation('geometryConfig.enableFeatureFiltering', 'must be true');
  }
  if (geometryConfig.geometryEngine !== 'turf') {
    return contractViolation('geometryConfig.geometryEngine', 'must be turf');
  }
  if (geometryConfig.simplifyAlgorithm !== 'geojson') {
    return contractViolation('geometryConfig.simplifyAlgorithm', 'must be geojson');
  }
  const boundaries = requireStrictZoomBoundaries(geometryConfig.zoomBandBoundaries);
  const bandCount = boundaries.length - 1;
  const distances = requireBandValues(
    'routeGeometryConfig.minDistanceMetersByBand',
    routeGeometryConfig.minDistanceMetersByBand,
    bandCount
  );
  const tolerances = requireBandValues(
    'routeGeometryConfig.simplifyToleranceByBand',
    routeGeometryConfig.simplifyToleranceByBand,
    bandCount
  );
  return distances.map((minDistanceMeters, bandIndex) => {
    const zMin = boundaries[bandIndex];
    const nextBoundary = boundaries[bandIndex + 1];
    const simplifyTolerance = tolerances[bandIndex];
    if (zMin === undefined || nextBoundary === undefined || simplifyTolerance === undefined) {
      return contractViolation('geometryConfig.zoomBandBoundaries', 'does not define every band');
    }
    return {
      bandIndex,
      zMin,
      zMax: bandIndex === bandCount - 1 ? nextBoundary : nextBoundary - 1,
      zBase: zMin,
      minDistanceMeters,
      simplifyTolerance,
    };
  });
};

const prepareGeometryArtifact = (
  params: PersistRouteGeometryArtifactsParams,
  source: SourceArtifact,
  band: GeometryBand
): PreparedGeometryArtifact => {
  const filtered = source.distanceMeters < band.minDistanceMeters;
  const simplifiedCoordinates = filtered
    ? []
    : simplifyLineString(source.coordinates, band.simplifyTolerance);
  if (!filtered) {
    requireCoordinateEquals(
      `geometry band ${String(band.bandIndex)} first coordinate`,
      simplifiedCoordinates[0],
      source.coordinates[0]
    );
    requireCoordinateEquals(
      `geometry band ${String(band.bandIndex)} last coordinate`,
      simplifiedCoordinates[simplifiedCoordinates.length - 1],
      source.coordinates[source.coordinates.length - 1]
    );
  }
  const geometryCacheId = `${String(params.nodeId)}:geometry:${String(band.bandIndex)}:${params.expected.sourceKey}`;
  const inputHash = buildStableJsonSignature({
    stage: 'geometry',
    sourceCacheId: params.sourceCacheId,
    sourceKey: params.expected.sourceKey,
    sourceInputHash: params.expected.sourceInputHash,
    sourceContentHash: source.contentHash,
    routeMode: params.expected.routeMode,
    band,
    geometryEngine: params.geometryConfig.geometryEngine,
    simplifyAlgorithm: params.geometryConfig.simplifyAlgorithm,
  });
  const payload = buildGeometryFeatureCollection({
    geometryCacheId,
    inputHash,
    source,
    band,
    filtered,
    simplifiedCoordinates,
  });
  const data = new TextEncoder().encode(JSON.stringify(payload)).buffer;
  const contentHash = geometryArtifactHasher.digest(data, 'sha3-256');
  const tileIds = filtered ? [] : collectLineStringTileIds(simplifiedCoordinates, band.zBase);
  const featureCount = filtered ? 0 : 1;
  const vertexCount = simplifiedCoordinates.length;
  const extractionRatio = filtered ? 0 : vertexCount / source.coordinates.length;
  if (!Number.isFinite(extractionRatio) || extractionRatio < 0 || extractionRatio > 1) {
    return contractViolation('geometry extractionRatio', 'must be finite in 0..1');
  }
  const metadata = {
    stage: 'geometry',
    status: 'completed',
    sourceCacheId: params.sourceCacheId,
    sourceKey: params.expected.sourceKey,
    sourceInputHash: params.expected.sourceInputHash,
    sourceContentHash: source.contentHash,
    inputHash,
    contentHash,
    format: 'geojson',
    compression: 'none',
    routeMode: params.expected.routeMode,
    bandIndex: band.bandIndex,
    zMin: band.zMin,
    zMax: band.zMax,
    zBase: band.zBase,
    minDistanceMeters: band.minDistanceMeters,
    simplifyTolerance: band.simplifyTolerance,
    filtered,
    endpointPreserved: !filtered,
    featureCount,
    vertexCount,
    inputVertexCount: source.coordinates.length,
    tileCount: tileIds.length,
  } satisfies Record<string, unknown>;
  return {
    geometryCacheId,
    bandIndex: band.bandIndex,
    zMin: band.zMin,
    zMax: band.zMax,
    zBase: band.zBase,
    inputHash,
    contentHash,
    featureCount,
    vertexCount,
    tileCount: tileIds.length,
    filtered,
    data,
    extractionRatio,
    sourceKey: params.expected.sourceKey,
    metadata,
    tileIds,
    tolerance: band.simplifyTolerance,
  };
};

const buildGeometryFeatureCollection = (params: {
  geometryCacheId: string;
  inputHash: string;
  source: SourceArtifact;
  band: GeometryBand;
  filtered: boolean;
  simplifiedCoordinates: [number, number][];
}) => ({
  type: 'FeatureCollection' as const,
  features: params.filtered
    ? []
    : [
        {
          type: 'Feature' as const,
          id: params.geometryCacheId,
          properties: {
            ...params.source.properties,
            geometryInputHash: params.inputHash,
            sourceContentHash: params.source.contentHash,
            bandIndex: params.band.bandIndex,
            zMin: params.band.zMin,
            zMax: params.band.zMax,
            zBase: params.band.zBase,
            minDistanceMeters: params.band.minDistanceMeters,
            simplifyTolerance: params.band.simplifyTolerance,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: params.simplifiedCoordinates,
          },
        },
      ],
});

const persistPreparedArtifacts = async (
  store: EphemeralDB,
  params: PersistRouteGeometryArtifactsParams,
  prepared: PreparedGeometryArtifact[]
): Promise<void> => {
  await store.transaction(
    'rw',
    [store.geometryCache, store.geometryCacheMeta, store.tileEmitBufferRelations],
    async () => {
      requireNotAborted(params.signal);
      const existing = await store.geometryCache
        .where('nodeId')
        .equals(params.nodeId)
        .filter(
          (record) =>
            record.domainType === 'route' && record.sourceKey === params.expected.sourceKey
        )
        .toArray();
      const existingIds = existing.map((record) => record.id);
      if (existingIds.length > 0) {
        await store.tileEmitBufferRelations.where('bufferId').anyOf(existingIds).delete();
        await store.geometryCache.bulkDelete(existingIds);
        await store.geometryCacheMeta.bulkDelete(existingIds);
      }
      const completedAt = Date.now();
      if (!Number.isFinite(completedAt) || completedAt <= 0) {
        return contractViolation('geometry timestamp', 'must be a positive finite number');
      }
      const records: EphemeralGeometryCacheRecord[] = prepared.map((artifact) => ({
        id: artifact.geometryCacheId,
        nodeId: params.nodeId,
        domainType: 'route',
        bandIndex: artifact.bandIndex,
        sourceKey: artifact.sourceKey,
        data: artifact.data,
        featureCount: artifact.featureCount,
        vertexCount: artifact.vertexCount,
        polygonCount: 0,
        extractionRatio: artifact.extractionRatio,
        tolerance: artifact.tolerance,
        timestamp: completedAt,
        metadata: {
          ...artifact.metadata,
          completedAt,
        },
      }));
      const metaRecords = records.map((record) => {
        const { data: _data, ...meta } = record;
        void _data;
        return meta satisfies EphemeralGeometryCacheMetaRecord;
      });
      const relations: EphemeralTileIdToBufferRelation[] = prepared.flatMap((artifact) =>
        artifact.tileIds.map((tileId) => ({
          id: `${String(params.nodeId)}:${String(artifact.bandIndex)}:${String(tileId)}:${artifact.geometryCacheId}`,
          nodeId: params.nodeId,
          domainType: 'route',
          bandIndex: artifact.bandIndex,
          tileId: String(tileId),
          bufferId: artifact.geometryCacheId,
          featureCount: artifact.featureCount,
          cacheTimestamp: completedAt,
          createdAt: completedAt,
        }))
      );
      requireNotAborted(params.signal);
      await store.geometryCache.bulkPut(records);
      await store.geometryCacheMeta.bulkPut(metaRecords);
      if (relations.length > 0) await store.tileEmitBufferRelations.bulkPut(relations);
      await requirePersistedArtifacts(store, records, metaRecords, relations);
      requireNotAborted(params.signal);
    }
  );
};

const requirePersistedArtifacts = async (
  store: EphemeralDB,
  records: EphemeralGeometryCacheRecord[],
  metas: EphemeralGeometryCacheMetaRecord[],
  relations: EphemeralTileIdToBufferRelation[]
): Promise<void> => {
  const ids = records.map((record) => record.id);
  const [persistedRecords, persistedMetas, persistedRelations] = await Promise.all([
    store.geometryCache.bulkGet(ids),
    store.geometryCacheMeta.bulkGet(ids),
    ids.length === 0
      ? Promise.resolve([])
      : store.tileEmitBufferRelations.where('bufferId').anyOf(ids).toArray(),
  ]);
  for (let index = 0; index < records.length; index += 1) {
    const expectedRecord = records[index];
    const expectedMeta = metas[index];
    const record = persistedRecords[index];
    const meta = persistedMetas[index];
    if (!expectedRecord || !expectedMeta || !record || !meta) {
      return contractViolation('geometry cache', 'is incomplete after persistence');
    }
    if (!(record.data instanceof ArrayBuffer)) {
      return contractViolation(
        'geometry cache data',
        'must remain an ArrayBuffer after persistence'
      );
    }
    const expectedContentHash = expectedRecord.metadata?.contentHash;
    const actualContentHash = geometryArtifactHasher.digest(record.data, 'sha3-256');
    if (
      record.id !== expectedRecord.id ||
      record.timestamp !== expectedRecord.timestamp ||
      record.data.byteLength !== expectedRecord.data.byteLength ||
      typeof expectedContentHash !== 'string' ||
      actualContentHash !== expectedContentHash ||
      record.metadata?.inputHash !== expectedRecord.metadata?.inputHash ||
      record.metadata?.contentHash !== expectedContentHash ||
      record.featureCount !== expectedRecord.featureCount ||
      record.vertexCount !== expectedRecord.vertexCount ||
      record.tolerance !== expectedRecord.tolerance ||
      meta.id !== expectedMeta.id ||
      meta.timestamp !== expectedMeta.timestamp ||
      meta.featureCount !== expectedMeta.featureCount ||
      meta.vertexCount !== expectedMeta.vertexCount ||
      meta.tolerance !== expectedMeta.tolerance ||
      meta.metadata?.inputHash !== expectedMeta.metadata?.inputHash ||
      meta.metadata?.contentHash !== expectedMeta.metadata?.contentHash
    ) {
      return contractViolation('geometry cache metadata', 'does not mirror the persisted artifact');
    }
  }
  const expectedRelationIds = relations.map((relation) => relation.id).sort();
  const persistedRelationIds = persistedRelations.map((relation) => relation.id).sort();
  if (
    expectedRelationIds.length !== persistedRelationIds.length ||
    expectedRelationIds.some((id, index) => id !== persistedRelationIds[index])
  ) {
    return contractViolation('tile transpose index', 'does not match the geometry artifacts');
  }
};

const requireStrictZoomBoundaries = (value: unknown): number[] => {
  if (!Array.isArray(value) || value.length < 2) {
    return contractViolation(
      'geometryConfig.zoomBandBoundaries',
      'must contain at least two values'
    );
  }
  const boundaries = value.map((candidate, index) => {
    if (!Number.isInteger(candidate) || (candidate as number) < 0 || (candidate as number) > 22) {
      return contractViolation(
        `geometryConfig.zoomBandBoundaries[${String(index)}]`,
        'must be an integer in 0..22'
      );
    }
    return candidate as number;
  });
  for (let index = 1; index < boundaries.length; index += 1) {
    const previous = boundaries[index - 1];
    const current = boundaries[index];
    if (previous === undefined || current === undefined || current <= previous) {
      return contractViolation('geometryConfig.zoomBandBoundaries', 'must be strictly increasing');
    }
  }
  return boundaries;
};

const requireBandValues = (label: string, value: unknown, bandCount: number): number[] => {
  if (!Array.isArray(value) || value.length !== bandCount) {
    return contractViolation(label, `must contain exactly ${String(bandCount)} values`);
  }
  return value.map((candidate, index) =>
    requireFiniteNonNegative(`${label}[${String(index)}]`, candidate)
  );
};

const simplifyLineString = (
  coordinates: [number, number][],
  tolerance: number
): [number, number][] => {
  requireFiniteNonNegative('simplifyTolerance', tolerance);
  if (coordinates.length < 2) {
    return contractViolation('source coordinates', 'must contain at least two positions');
  }
  const simplifiedFeature = geometrySimplify(
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates.map(copyCoordinate),
      },
    },
    'turf',
    { tolerance, highQuality: true, mutate: false }
  );
  if (simplifiedFeature.geometry.type !== 'LineString') {
    return contractViolation('simplified geometry', 'must remain a LineString');
  }
  const simplified = simplifiedFeature.geometry.coordinates.map((coordinate, index) =>
    requireCoordinate(`simplified geometry.coordinates[${String(index)}]`, coordinate)
  );
  if (simplified.length < 2) {
    return contractViolation('simplified coordinates', 'must retain both route endpoints');
  }
  return simplified;
};

const requireRecord = (label: string, value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return contractViolation(label, 'must be an object');
  }
  return value as Record<string, unknown>;
};

const requireCoordinate = (label: string, value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    return contractViolation(label, 'must be a longitude/latitude pair');
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return contractViolation(label, 'contains invalid coordinates');
  }
  return [longitude, latitude];
};

const requireCoordinateEquals = (
  label: string,
  actual: [number, number] | undefined,
  expected: [number, number] | undefined
): void => {
  if (!actual || !expected || actual[0] !== expected[0] || actual[1] !== expected[1]) {
    contractViolation(label, 'does not match the required endpoint');
  }
};

const requireFiniteNonNegative = (label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return contractViolation(label, 'must be a non-negative finite number');
  }
  return value;
};

const copyCoordinate = (coordinate: [number, number]): [number, number] => [
  coordinate[0],
  coordinate[1],
];

const requireNotAborted = (signal: AbortSignal | undefined): void => {
  if (!signal?.aborted) return;
  if (typeof DOMException === 'function') {
    throw new DOMException('Route geometry persistence was aborted', 'AbortError');
  }
  const error = new Error('Route geometry persistence was aborted');
  (error as Error & { name: string }).name = 'AbortError';
  throw error;
};

const contractViolation = (field: string, expectation: string): never => {
  throw new Error(`[route-geometry-artifact] ${field} ${expectation}`);
};
