import type { DownloadTaskRequest, ShapeStageWorkerAPI, ShapeStageWorkerTaskResult, SimplifyTaskRequest } from './ShapeStageWorkerTypes.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { defaultDataSourceFactory, type DataSourceStrategyId } from '../../datasources/DataSourceStrategyFactory.js';
import type { BoundingBox as TaskBoundingBox, Simplify1Task, Simplify2Task } from '../../../common/types/index.js';
import type { BoundingBox as DataSourceBoundingBox } from '../../datasources/DataSourceStrategy.js';
import type { Feature, FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import { applyFeatureFiltering, type FeatureFilterSettings, simplifyGeoJson } from '@hierarchidb/gis-sdk';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

const resolveStrategyId = (source?: string): DataSourceStrategyId | null => {
  const key = (source ?? '').toLowerCase();
  if (key.includes('gadm')) return 'gadm-administrative-areas';
  if (key.includes('natural')) return 'natural-earth-shapes';
  if (key.includes('geo')) return 'geoboundaries-admin-areas';
  if (key.includes('osm') || key.includes('openstreet')) return 'openstreetmap-overpass';
  return null;
};

const normalizeBoundingBox = (bbox?: TaskBoundingBox): DataSourceBoundingBox | undefined => {
  if (!bbox || bbox.length !== 4) return undefined;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
};

const decodeGeoJson = async (buffer: ArrayBuffer): Promise<unknown> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      if (feature) {
        features.push(feature);
      }
    }
    return {
      type: 'FeatureCollection',
      features,
    };
  }
  return decoded;
};

const isFeatureCollection = (value: unknown): value is FeatureCollection => (
  Boolean(
    value
    && typeof value === 'object'
    && (value as FeatureCollection).type === 'FeatureCollection'
    && Array.isArray((value as FeatureCollection).features),
  )
);

const encodeGeoJson = async (geojsonData: FeatureCollection): Promise<ArrayBuffer> => {
  const bytes = await geojsonApi.serialize(geojsonData);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const sanitizeFeatureCollection = (collection: FeatureCollection): FeatureCollection => ({
  ...collection,
  features: collection.features.filter(Boolean),
});

const processDownloadTask = async ({
  nodeId,
  task,
  taskIndex,
}: DownloadTaskRequest): Promise<ShapeStageWorkerTaskResult> => {
  const strategyId = resolveStrategyId(task.config?.dataSource);
  if (!strategyId) {
    return { status: 'failed', errorMessage: 'No data source strategy available' };
  }
  const ds = defaultDataSourceFactory.create(strategyId);
  const retryAttempts = task.config?.retryAttempts ?? 0;
  const retryDelay = task.config?.retryDelay ?? 0;
  const timeoutMs = task.config?.timeoutMs;
  const bbox = normalizeBoundingBox(task.config?.bbox);
  const tags = task.config?.tags;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const raw = await ds.fetchData({
        country: task.config?.country,
        adminLevel: task.config?.adminLevel,
        endpoint: task.config?.endpoint,
        bbox,
        tags,
        timeout: timeoutMs,
      });
      const processed = await ds.processData(raw, { adminLevel: task.config?.adminLevel });
      const featureCollection = {
        type: 'FeatureCollection',
        features: processed.map((entity) => ({
          type: 'Feature',
          geometry: entity.geometry ?? null,
          properties: entity.properties ?? {},
        })),
      } as FeatureCollection;
      const fgbBytes = await geojsonApi.serialize(featureCollection);
      const fgb = fgbBytes.buffer.slice(fgbBytes.byteOffset, fgbBytes.byteOffset + fgbBytes.byteLength);
      const bounds = turfBbox(featureCollection);
      const db = getEphemeralShapeDB();
      const bufferId = `${nodeId}-download-${taskIndex}`;
      await db.rawBuffers.put({
        id: bufferId,
        nodeId: task.nodeId ?? nodeId,
        data: fgb,
        featureCount: featureCollection.features.length,
        bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
        downloadTime: Date.now(),
        size: fgb.byteLength,
        timestamp: Date.now(),
      });
      return {
        status: 'completed',
        bytesWritten: fgb.byteLength,
        featureCount: featureCollection.features.length,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retryAttempts && retryDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
  return {
    status: 'failed',
    errorMessage: lastError instanceof Error ? lastError.message : 'Download failed',
  };
};

const processSimplify1Task = async ({
  nodeId,
  task,
  taskIndex,
}: SimplifyTaskRequest<Simplify1Task>): Promise<ShapeStageWorkerTaskResult> => {
  const db = getEphemeralShapeDB();
  const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
  const raw = await db.rawBuffers.get(inputBufferId);
  if (!raw) {
    return { status: 'failed', errorMessage: `Raw buffer not found: ${inputBufferId}` };
  }
  if (!raw.featureCount) {
    await db.simplifiedBuffers.put({
      id: `${nodeId}-simplify1-${taskIndex}`,
      nodeId: raw.nodeId,
      stage: 'simplify1',
      data: raw.data,
      featureCount: 0,
      simplificationRatio: 0,
      tolerance: task.tolerance ?? task.config?.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const geojson = await decodeGeoJson(raw.data);
  const filterSettings: FeatureFilterSettings = {
    minArea: task.minArea ?? task.config?.minimumArea ?? 0,
    featureFilterMethod: task.config?.featureFilterMethod,
    minVertexCountForAreaFilter: task.config?.minVertexCountForAreaFilter,
    hybridFilterConfig: task.config?.hybridFilterConfig,
  };
  const filtered = applyFeatureFiltering(geojson, filterSettings);
  const outputBufferId = `${nodeId}-simplify1-${taskIndex}`;
  const hasFilteredFeatures = isFeatureCollection(filtered);
  const sanitizedFiltered = hasFilteredFeatures
    ? sanitizeFeatureCollection(filtered)
    : null;
  const featureCount = sanitizedFiltered
    ? sanitizedFiltered.features.length
    : raw.featureCount;
  if (sanitizedFiltered && featureCount === 0) {
    await db.simplifiedBuffers.put({
      id: outputBufferId,
      nodeId: raw.nodeId,
      stage: 'simplify1',
      data: raw.data,
      featureCount: 0,
      simplificationRatio: 0,
      tolerance: task.tolerance ?? task.config?.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const data = sanitizedFiltered
    ? await encodeGeoJson(sanitizedFiltered)
    : raw.data;
  if (!featureCount) {
    await db.simplifiedBuffers.put({
      id: outputBufferId,
      nodeId: raw.nodeId,
      stage: 'simplify1',
      data,
      featureCount: 0,
      simplificationRatio: 0,
      tolerance: task.tolerance ?? task.config?.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  await db.simplifiedBuffers.put({
    id: outputBufferId,
    nodeId: raw.nodeId,
    stage: 'simplify1',
    data,
    featureCount,
    simplificationRatio: raw.featureCount > 0 ? featureCount / raw.featureCount : 1,
    tolerance: task.tolerance ?? task.config?.tolerance ?? 0,
    timestamp: Date.now(),
  });
  return { status: 'completed', featureCount };
};

const processSimplify2Task = async ({
  nodeId,
  task,
  taskIndex,
}: SimplifyTaskRequest<Simplify2Task>): Promise<ShapeStageWorkerTaskResult> => {
  const db = getEphemeralShapeDB();
  const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
  const input = await db.simplifiedBuffers.get(inputBufferId)
    ?? await db.rawBuffers.get(inputBufferId);
  if (!input) {
    return { status: 'failed', errorMessage: `Simplify2 input buffer not found: ${inputBufferId}` };
  }
  if (!input.featureCount) {
    const outputBufferId = `${nodeId}-simplify2-${taskIndex}`;
    const baseTolerance = task.config?.tolerance ?? task.tolerance ?? 0;
    const retry = task.config?.retry ?? 0;
    const retryScale = retry > 0 ? 1 + retry * 2 : 1;
    const effectiveTolerance = baseTolerance * retryScale;
    await db.simplifiedBuffers.put({
      id: outputBufferId,
      nodeId: input.nodeId,
      stage: 'simplify2',
      data: input.data,
      featureCount: 0,
      simplificationRatio: 0,
      tolerance: effectiveTolerance,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const geojson = await decodeGeoJson(input.data);
  const baseTolerance = task.config?.tolerance ?? task.tolerance ?? 0;
  const retry = task.config?.retry ?? 0;
  const retryScale = retry > 0 ? 1 + retry * 2 : 1;
  const tolerance = baseTolerance * retryScale;
  const quantizeBase = task.config?.quantize;
  const quantize = typeof quantizeBase === 'number'
    ? Math.max(1, Math.round(quantizeBase / (1 + retry * 2)))
    : quantizeBase;
  const enablePerFeatureSimplification = task.config?.enablePerFeatureSimplification ?? true;
  const simplified = simplifyGeoJson(geojson, {
    tolerance,
    perFeature: enablePerFeatureSimplification,
    quantize,
  });
  const hasSimplifiedFeatures = isFeatureCollection(simplified);
  const outputBufferId = `${nodeId}-simplify2-${taskIndex}`;
  const sanitizedSimplified = hasSimplifiedFeatures
    ? sanitizeFeatureCollection(simplified)
    : null;
  const featureCount = sanitizedSimplified
    ? sanitizedSimplified.features.length
    : input.featureCount;
  if (sanitizedSimplified && featureCount === 0) {
    await db.simplifiedBuffers.put({
      id: outputBufferId,
      nodeId: input.nodeId,
      stage: 'simplify2',
      data: input.data,
      featureCount: 0,
      simplificationRatio: 0,
      tolerance,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const data = sanitizedSimplified
    ? await encodeGeoJson(sanitizedSimplified)
    : input.data;
  await db.simplifiedBuffers.put({
    id: outputBufferId,
    nodeId: input.nodeId,
    stage: 'simplify2',
    data,
    featureCount,
    simplificationRatio: input.featureCount ? featureCount / input.featureCount : 1,
    tolerance,
    timestamp: Date.now(),
  });
  return { status: 'completed', featureCount };
};

export const shapeStageWorker: ShapeStageWorkerAPI = {
  processDownloadTask,
  processSimplify1Task,
  processSimplify2Task,
  setAuthToken: async (token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number) => {
    const auth = await AuthRecoveryService.getSingleton();
    auth.setToken(token, type, expiresAt);
  },
};
