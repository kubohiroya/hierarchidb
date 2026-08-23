import type { NodeId } from '@hierarchidb/core-types';
import {
  buildStableJsonSignature,
  encodeFlatGeobufFromFeatureCollection,
  type EphemeralDB,
  type EphemeralGeometryCacheRecord,
  type EphemeralTileIdToBufferRelation,
  lonLatToTileXY,
} from '@hierarchidb/gis-sdk';
import { packTileId, type BandConfig } from '@hierarchidb/vt-orchestrator';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type {
  LocationBuildConfig,
  LocationMvtBuildConfig,
  LocationMvtZoomBandConfig,
} from '~/common/entities/LocationEntity.js';
import type { LocationPointProperties, LocationType } from '~/common/entities/LocationPoint.js';
import { LOCATION_MVT_SOURCE_LAYER } from './createDefaultLocationMvtBuildConfig.js';

export type LocationGeometryArtifactOutput = {
  artifacts: Array<{
    geometryCacheId: string;
    bandIndex: number;
    zMin: number;
    zMax: number;
    zBase: number;
    featureCount: number;
    tileCount: number;
    inputHash: string;
    contentHash: string;
  }>;
  relationCount: number;
};

type PreparedLocationGeometryArtifact = LocationGeometryArtifactOutput['artifacts'][number] & {
  sourceKey: string;
  data: ArrayBuffer;
  timestamp: number;
  tileIds: number[];
  metadata: Record<string, unknown>;
};

const LOCATION_MVT_TYPES = new Set<LocationType>([
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
]);

export const requireLocationMvtBands = (config: LocationMvtBuildConfig): BandConfig[] => {
  requireLocationMvtConfig(config);
  return config.zoomBands.map((band, index) => ({
    bandIndex: index,
    zMin: band.minZoom,
    zMax: band.maxZoom,
    zBase: band.minZoom,
  }));
};

export const persistLocationGeometryArtifacts = async (params: {
  nodeId: NodeId;
  points: readonly LocationPointProperties[];
  buildConfig: LocationBuildConfig;
  sourceContentHash: string;
  sourceInputHash: string;
  store: EphemeralDB;
  signal?: AbortSignal;
}): Promise<LocationGeometryArtifactOutput> => {
  requireNotAborted(params.signal);
  const bands = requireLocationMvtBands(params.buildConfig.mvt);
  params.points.forEach((point, index) => validateLocationPointForMvt(point, index));
  const prepared = await Promise.all(
    params.buildConfig.mvt.zoomBands.map((band, index) =>
      prepareLocationGeometryArtifact({
        ...params,
        band,
        bandConfig: bands[index] ?? contractViolation('location mvt band', 'is missing'),
        bandIndex: index,
      })
    )
  );
  requireNotAborted(params.signal);
  await persistPreparedLocationGeometryArtifacts(params.store, params.nodeId, prepared);
  return {
    artifacts: prepared.map(
      ({
        data: _data,
        metadata: _metadata,
        sourceKey: _sourceKey,
        timestamp: _timestamp,
        tileIds,
        ...artifact
      }) => {
        void _data;
        void _metadata;
        void _sourceKey;
        void _timestamp;
        return {
          ...artifact,
          tileCount: tileIds.length,
        };
      }
    ),
    relationCount: prepared.reduce((total, artifact) => total + artifact.tileIds.length, 0),
  };
};

const prepareLocationGeometryArtifact = async (params: {
  nodeId: NodeId;
  points: readonly LocationPointProperties[];
  buildConfig: LocationBuildConfig;
  sourceContentHash: string;
  sourceInputHash: string;
  store: EphemeralDB;
  signal?: AbortSignal;
  band: LocationMvtZoomBandConfig;
  bandConfig: BandConfig;
  bandIndex: number;
}): Promise<PreparedLocationGeometryArtifact> => {
  requireNotAborted(params.signal);
  const selected = params.points
    .filter((point) => pointBelongsToBand(point, params.band))
    .sort((left, right) => String(left.pointId).localeCompare(String(right.pointId)));
  const geometryCacheId = buildLocationGeometryCacheId(params.nodeId, params.bandIndex);
  const sourceKey = params.band.id;
  const inputHash = buildStableJsonSignature({
    stage: 'geometry',
    sourceContentHash: params.sourceContentHash,
    sourceInputHash: params.sourceInputHash,
    sourceLayer: params.buildConfig.mvt.sourceLayer,
    encoderVersion: params.buildConfig.mvt.encoderVersion,
    band: params.band,
  });
  const collection: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: selected.map((point) => toLocationPointFeature(point, inputHash)),
  };
  const data = await encodeFlatGeobufFromFeatureCollection(collection);
  if (data.byteLength <= 0) {
    return contractViolation('location geometry data', 'must be a non-empty FlatGeobuf buffer');
  }
  const timestamp = Date.now();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return contractViolation('location geometry timestamp', 'must be a positive finite number');
  }
  const tileIds = collectLocationPointTileIds(selected, params.bandConfig.zBase);
  const contentHash = buildStableJsonSignature({
    inputHash,
    featureIds: selected.map((point) => point.pointId),
    tileIds,
  });
  return {
    geometryCacheId,
    bandIndex: params.bandIndex,
    zMin: params.bandConfig.zMin,
    zMax: params.bandConfig.zMax,
    zBase: params.bandConfig.zBase,
    featureCount: selected.length,
    tileCount: tileIds.length,
    inputHash,
    contentHash,
    sourceKey,
    data,
    timestamp,
    tileIds,
    metadata: {
      stage: 'geometry',
      status: 'completed',
      sourceLayer: params.buildConfig.mvt.sourceLayer,
      encoderVersion: params.buildConfig.mvt.encoderVersion,
      sourceContentHash: params.sourceContentHash,
      sourceInputHash: params.sourceInputHash,
      inputHash,
      contentHash,
      format: 'flatgeobuf',
      compression: 'none',
      bandId: params.band.id,
      bandIndex: params.bandIndex,
      zMin: params.bandConfig.zMin,
      zMax: params.bandConfig.zMax,
      zBase: params.bandConfig.zBase,
      featureCount: selected.length,
      tileCount: tileIds.length,
    },
  };
};

const persistPreparedLocationGeometryArtifacts = async (
  store: EphemeralDB,
  nodeId: NodeId,
  prepared: PreparedLocationGeometryArtifact[]
): Promise<void> => {
  await store.transaction(
    'rw',
    [store.geometryCache, store.geometryCacheMeta, store.tileEmitBufferRelations],
    async () => {
      const existing = await store.geometryCache
        .where('nodeId')
        .equals(nodeId)
        .filter((record) => record.domainType === 'location')
        .toArray();
      const existingIds = existing.map((record) => record.id);
      if (existingIds.length > 0) {
        await store.tileEmitBufferRelations.where('bufferId').anyOf(existingIds).delete();
        await store.geometryCache.bulkDelete(existingIds);
        await store.geometryCacheMeta.bulkDelete(existingIds);
      }
      const records: EphemeralGeometryCacheRecord[] = prepared.map((artifact) => ({
        id: artifact.geometryCacheId,
        nodeId,
        domainType: 'location',
        bandIndex: artifact.bandIndex,
        sourceKey: artifact.sourceKey,
        data: artifact.data,
        featureCount: artifact.featureCount,
        vertexCount: artifact.featureCount,
        polygonCount: 0,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: artifact.timestamp,
        metadata: artifact.metadata,
      }));
      const relations: EphemeralTileIdToBufferRelation[] = prepared.flatMap((artifact) =>
        artifact.tileIds.map((tileId) => ({
          id: `${String(nodeId)}:location:tile:${String(artifact.bandIndex)}:${String(tileId)}:${artifact.geometryCacheId}`,
          nodeId,
          domainType: 'location',
          bandIndex: artifact.bandIndex,
          tileId: String(tileId),
          bufferId: artifact.geometryCacheId,
          featureCount: artifact.featureCount,
          cacheTimestamp: artifact.timestamp,
          createdAt: artifact.timestamp,
        }))
      );
      if (records.length > 0) await store.geometryCache.bulkPut(records);
      if (relations.length > 0) await store.tileEmitBufferRelations.bulkPut(relations);
    }
  );
};

export const buildLocationGeometryCacheId = (nodeId: NodeId, bandIndex: number): string => {
  if (!Number.isInteger(bandIndex) || bandIndex < 0) {
    return contractViolation('location mvt bandIndex', 'must be a non-negative integer');
  }
  return `${String(nodeId)}:location:geometry:${String(bandIndex)}`;
};

const pointBelongsToBand = (
  point: LocationPointProperties,
  band: LocationMvtZoomBandConfig
): boolean =>
  band.types.includes(point.type as LocationMvtZoomBandConfig['types'][number]) &&
  point.minZoom <= band.maxZoom &&
  (band.maxRenderRank === undefined || point.renderRank <= band.maxRenderRank) &&
  (band.minImportance === undefined || point.importance >= band.minImportance);

const toLocationPointFeature = (
  point: LocationPointProperties,
  geometryInputHash: string
): Feature<Point> => ({
  type: 'Feature',
  id: String(point.pointId),
  properties: {
    layer: LOCATION_MVT_SOURCE_LAYER,
    pointId: String(point.pointId),
    type: point.type,
    name: point.name,
    countryCode: point.admin0Code ?? '',
    renderRank: point.renderRank,
    importance: point.importance,
    iconKey: point.iconKey,
    labelClass: point.labelClass,
    minZoom: point.minZoom,
    geometryInputHash,
  },
  geometry: {
    type: 'Point',
    coordinates: [point.longitude, point.latitude],
  },
});

const collectLocationPointTileIds = (
  points: readonly LocationPointProperties[],
  zoom: number
): number[] => {
  const tileIds = new Set<number>();
  for (const point of points) {
    const { x, y } = lonLatToTileXY(point.longitude, point.latitude, zoom);
    const scale = 2 ** zoom;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= scale ||
      y < 0 ||
      y >= scale
    ) {
      contractViolation(
        'location point tile coordinate',
        `is invalid for pointId=${String(point.pointId)} zoom=${String(zoom)}`
      );
    }
    tileIds.add(packTileId(x, y, zoom));
  }
  return [...tileIds].sort((left, right) => left - right);
};

const requireLocationMvtConfig = (config: LocationMvtBuildConfig): void => {
  if (config.schemaVersion !== 1) {
    contractViolation('location mvt schemaVersion', 'must be 1');
  }
  if (config.sourceLayer !== LOCATION_MVT_SOURCE_LAYER) {
    contractViolation('location mvt sourceLayer', `must be ${LOCATION_MVT_SOURCE_LAYER}`);
  }
  if (typeof config.encoderVersion !== 'string' || config.encoderVersion.length === 0) {
    contractViolation('location mvt encoderVersion', 'must be a non-empty string');
  }
  if (!Array.isArray(config.zoomBands) || config.zoomBands.length === 0) {
    contractViolation('location mvt zoomBands', 'must be a non-empty array');
  }
  let previousMaxZoom = -1;
  config.zoomBands.forEach((band, index) => {
    if (typeof band.id !== 'string' || band.id.length === 0) {
      contractViolation(`location mvt zoomBands[${String(index)}].id`, 'must be non-empty');
    }
    if (
      !Number.isInteger(band.minZoom) ||
      !Number.isInteger(band.maxZoom) ||
      band.minZoom < 0 ||
      band.maxZoom < band.minZoom
    ) {
      contractViolation(`location mvt zoomBands[${String(index)}]`, 'has invalid zoom range');
    }
    if (band.minZoom <= previousMaxZoom) {
      contractViolation('location mvt zoomBands', 'must be ordered and non-overlapping');
    }
    if (!Array.isArray(band.types) || band.types.length === 0) {
      contractViolation(`location mvt zoomBands[${String(index)}].types`, 'must be non-empty');
    }
    if (band.maxRenderRank === undefined && band.minImportance === undefined) {
      contractViolation(
        `location mvt zoomBands[${String(index)}]`,
        'must define maxRenderRank or minImportance'
      );
    }
    previousMaxZoom = band.maxZoom;
  });
};

const validateLocationPointForMvt = (point: LocationPointProperties, index: number): void => {
  const label = `location point[${String(index)}]`;
  if (point.schemaVersion !== 2) contractViolation(`${label}.schemaVersion`, 'must be 2');
  if (typeof point.pointId !== 'string' || point.pointId.length === 0) {
    contractViolation(`${label}.pointId`, 'must be a non-empty string');
  }
  if (typeof point.name !== 'string') contractViolation(`${label}.name`, 'must be a string');
  if (!LOCATION_MVT_TYPES.has(point.type as LocationType)) {
    contractViolation(`${label}.type`, `must be one of ${[...LOCATION_MVT_TYPES].join(',')}`);
  }
  requireFiniteInRange(`${label}.longitude`, point.longitude, -180, 180);
  requireFiniteInRange(`${label}.latitude`, point.latitude, -85.05112878, 85.05112878);
  requirePositiveInteger(`${label}.renderRank`, point.renderRank);
  requireFiniteInRange(`${label}.importance`, point.importance, 0, 1);
  if (typeof point.iconKey !== 'string' || point.iconKey.length === 0) {
    contractViolation(`${label}.iconKey`, 'must be a non-empty string');
  }
  if (typeof point.labelClass !== 'string' || point.labelClass.length === 0) {
    contractViolation(`${label}.labelClass`, 'must be a non-empty string');
  }
  if (!Number.isInteger(point.minZoom) || point.minZoom < 0 || point.minZoom > 24) {
    contractViolation(`${label}.minZoom`, 'must be an integer in 0..24');
  }
};

const requirePositiveInteger = (label: string, value: unknown): void => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    contractViolation(label, 'must be a positive integer');
  }
};

const requireFiniteInRange = (label: string, value: unknown, min: number, max: number): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    contractViolation(label, `must be finite in ${String(min)}..${String(max)}`);
  }
};

function requireNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    if (typeof DOMException === 'function') {
      throw new DOMException('Location MVT geometry stage was aborted', 'AbortError');
    }
    const error = new Error('Location MVT geometry stage was aborted');
    (error as Error & { name: string }).name = 'AbortError';
    throw error;
  }
}

function contractViolation(label: string, message: string): never {
  throw new Error(`[location mvt] ${label} ${message}`);
}
