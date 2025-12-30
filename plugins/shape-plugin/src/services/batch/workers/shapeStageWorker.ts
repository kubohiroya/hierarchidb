import type { DownloadTaskRequest, ShapeStageWorkerAPI, ShapeStageWorkerTaskResult, ExtractTaskRequest } from './ShapeStageWorkerTypes.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { defaultDataSourceFactory, type DataSourceStrategyId } from '../../datasources/DataSourceStrategyFactory.js';
import type { BoundingBox as TaskBoundingBox, Extract1Task, Extract2Task } from '../../../common/types/index.js';
import type { BoundingBox as DataSourceBoundingBox } from '../../datasources/DataSourceStrategy.js';
import type { Feature, FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import { applyFeatureFiltering, type FeatureFilterSettings, extractGeoJson } from '@hierarchidb/gis-sdk';
import { extractTopoJsonByTiles } from '../utils/topojsonExtract.js';
import { applyOriginKey, assignFeatureIds, HDB_ORIGIN_KEY } from '../utils/featureIds.js';
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

const applyFeatureContext = (
  collection: FeatureCollection,
  context: {
    continent?: string;
    countryName?: string;
    countryCode?: string;
    adminCode?: string;
    originKey?: string;
  },
): void => {
  for (const feature of collection.features) {
    if (!feature) continue;
    feature.properties ??= {};
    const properties = feature.properties as Record<string, unknown>;
    if (context.continent && typeof properties.continent !== 'string') {
      properties.continent = context.continent;
    }
    if (context.countryName && typeof properties.countryName !== 'string') {
      properties.countryName = context.countryName;
    }
    if (context.countryCode && typeof properties.countryCode !== 'string') {
      properties.countryCode = context.countryCode;
    }
    if (context.adminCode && typeof properties.adminCode !== 'string') {
      properties.adminCode = context.adminCode;
    }
    if (context.originKey && typeof properties[HDB_ORIGIN_KEY] !== 'string') {
      properties[HDB_ORIGIN_KEY] = context.originKey;
    }
  }
};

const processDownloadTask = async ({
  nodeId,
  task,
  taskIndex,
  input,
}: DownloadTaskRequest): Promise<ShapeStageWorkerTaskResult> => {
  const strategyId = resolveStrategyId(input.dataSource);
  if (!strategyId) {
    return { status: 'failed', errorMessage: 'No data source strategy available' };
  }
  const ds = defaultDataSourceFactory.create(strategyId);
  const retryAttempts = input.retryAttempts ?? 0;
  const retryDelay = input.retryDelay ?? 0;
  const timeoutMs = input.timeoutMs;
  const bbox = normalizeBoundingBox(input.bbox);
  const tags = input.tags;
  const country = input.countryCode ?? task.countryCode;
  const adminLevel = input.adminLevel;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const raw = await ds.fetchData({
        country,
        adminLevel,
        endpoint: input.endpoint,
        bbox,
        tags,
        timeout: timeoutMs,
      });
      const processed = await ds.processData(raw, { adminLevel });
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

const processExtract1Task = async ({
  nodeId,
  task,
  taskIndex,
  input,
}: ExtractTaskRequest<Extract1Task>): Promise<ShapeStageWorkerTaskResult> => {
  const db = getEphemeralShapeDB();
  const inputBufferId = input.inputBufferId ?? '';
  const raw = await db.rawBuffers.get(inputBufferId);
  if (!raw) {
    return { status: 'failed', errorMessage: `Raw buffer not found: ${inputBufferId}` };
  }
  if (!raw.featureCount) {
    await db.extractedBuffers.put({
      id: `${nodeId}-extract1-${taskIndex}`,
      nodeId: raw.nodeId,
      stage: 'extract1',
      data: raw.data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const enableFeatureFiltering = input.enableFeatureFiltering ?? true;
  const originKey = input.originKey;
  if (!enableFeatureFiltering) {
    const outputBufferId = `${nodeId}-extract1-${taskIndex}`;
    const featureCount = raw.featureCount ?? 0;
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: raw.nodeId,
      stage: 'extract1',
      data: raw.data,
      featureCount,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: Date.now(),
    });
    return { status: 'completed', featureCount };
  }
  const geojson = await decodeGeoJson(raw.data);
  const filterSettings: FeatureFilterSettings = {
    minArea: input.minimumArea ?? 0,
    featureFilterMethod: input.featureFilterMethod,
    minVertexCountForAreaFilter: input.minVertexCountForAreaFilter,
    hybridFilterConfig: input.hybridFilterConfig,
  };
  const filtered = applyFeatureFiltering(geojson, filterSettings);
  const baseTolerance = input.tolerance ?? 0;
  const tolerance = Number.isFinite(baseTolerance) ? baseTolerance : 0;
  const outputBufferId = `${nodeId}-extract1-${taskIndex}`;
  const hasFilteredFeatures = isFeatureCollection(filtered);
  const sanitizedFiltered = hasFilteredFeatures
    ? sanitizeFeatureCollection(filtered)
    : null;
  const extracted = sanitizedFiltered
    ? extractGeoJson(sanitizedFiltered, { tolerance, perFeature: true })
    : filtered;
  const hasExtractedFeatures = isFeatureCollection(extracted);
  const sanitizedExtracted = hasExtractedFeatures
    ? sanitizeFeatureCollection(extracted)
    : null;
  if (sanitizedExtracted) {
    applyOriginKey(sanitizedExtracted, originKey);
    assignFeatureIds(sanitizedExtracted, {
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
    });
  }
  const featureCount = sanitizedExtracted
    ? sanitizedExtracted.features.length
    : raw.featureCount;
  if (sanitizedFiltered && featureCount === 0) {
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: raw.nodeId,
      stage: 'extract1',
      data: raw.data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const data = sanitizedExtracted
    ? await encodeGeoJson(sanitizedExtracted)
    : raw.data;
  if (!featureCount) {
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: raw.nodeId,
      stage: 'extract1',
      data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  await db.extractedBuffers.put({
    id: outputBufferId,
    nodeId: raw.nodeId,
    stage: 'extract1',
    data,
    featureCount,
    extractionRatio: raw.featureCount > 0 ? featureCount / raw.featureCount : 1,
    tolerance: input.tolerance ?? 0,
    timestamp: Date.now(),
  });
  return { status: 'completed', featureCount };
};

const processExtract2Task = async ({
  nodeId,
  task,
  taskIndex,
  input: payload,
}: ExtractTaskRequest<Extract2Task>): Promise<ShapeStageWorkerTaskResult> => {
  const db = getEphemeralShapeDB();
  const inputBufferId = payload.inputBufferId ?? '';
  const buffer = await db.extractedBuffers.get(inputBufferId)
    ?? await db.rawBuffers.get(inputBufferId);
  if (!buffer) {
    return { status: 'failed', errorMessage: `Extract2 input buffer not found: ${inputBufferId}` };
  }
  const originKey = payload.originKey;
  if (!buffer.featureCount) {
    const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
    const baseTolerance = payload.tolerance ?? 0;
    const retry = payload.retry ?? 0;
    const retryScale = retry > 0 ? 1 + retry * 2 : 1;
    const effectiveTolerance = baseTolerance * retryScale;
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      data: buffer.data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: effectiveTolerance,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const geojson = await decodeGeoJson(buffer.data);
  if (isFeatureCollection(geojson)) {
    const continent = payload.continent;
    const countryName = payload.countryName;
    const countryCode = task.countryCode;
    const adminCode = payload.adminCode ?? payload.featureGroupId;
    const origin = payload.originKey;
    applyFeatureContext(geojson, {
      continent,
      countryName,
      countryCode,
      adminCode,
      originKey: origin,
    });
  }
  const extractionMode = payload.extractionMode
    ?? (payload.preserveSharedBoundaries ? 'topojson' : 'geojson');
  if (extractionMode === 'off') {
    const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
    if (isFeatureCollection(geojson)) {
      const sanitized = sanitizeFeatureCollection(geojson);
      applyOriginKey(sanitized, originKey);
      assignFeatureIds(sanitized, {
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
      });
      const data = await encodeGeoJson(sanitized);
      const featureCount = sanitized.features.length;
      await db.extractedBuffers.put({
        id: outputBufferId,
        nodeId: buffer.nodeId,
        stage: 'extract2',
        data,
        featureCount,
        extractionRatio: buffer.featureCount ? featureCount / buffer.featureCount : 1,
        tolerance: 0,
        timestamp: Date.now(),
      });
      return { status: 'completed', featureCount };
    }
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      data: buffer.data,
      featureCount: buffer.featureCount ?? 0,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: Date.now(),
    });
    return { status: 'completed', featureCount: buffer.featureCount ?? 0 };
  }
  const baseTolerance = payload.tolerance ?? 0;
  const retry = payload.retry ?? 0;
  const retryScale = retry > 0 ? 1 + retry * 2 : 1;
  const tolerance = baseTolerance * retryScale;
  const quantizeBase = payload.quantize;
  const quantize = typeof quantizeBase === 'number'
    ? Math.max(1, Math.round(quantizeBase / (1 + retry * 2)))
    : quantizeBase;
  const enablePerFeatureExtraction = payload.enablePerFeatureExtraction ?? true;
  const inputBytes = buffer.data.byteLength ?? 0;
  const targetRatio = 0.1;
  const maxTuningPasses = 3;
  let tunedTolerance = tolerance;
  let tunedQuantize = quantize;
  let finalData = buffer.data;
  let finalFeatureCount = buffer.featureCount ?? 0;
  let finalRatio = inputBytes > 0 ? finalData.byteLength / inputBytes : 1;
  let usedTopo = false;
  let pass = 0;
  const runExtraction = async () => {
    let extractedPayload: unknown = geojson;
    usedTopo = false;
    if (extractionMode === 'topojson' && payload.preserveSharedBoundaries && isFeatureCollection(geojson)) {
      try {
        extractedPayload = extractTopoJsonByTiles(geojson, {
          tolerance: tunedTolerance,
          quantize: tunedQuantize,
          zoomLevels: payload.zoomLevels,
        });
        usedTopo = true;
      } catch (error) {
        console.warn('[shapeStageWorker] TopoJSON extract failed; falling back to per-feature', error);
      }
    }
    const extracted = usedTopo
      ? extractedPayload
      : extractGeoJson(geojson, {
        tolerance: tunedTolerance,
        perFeature: enablePerFeatureExtraction,
        quantize: tunedQuantize,
      });
    const hasExtractedFeatures = isFeatureCollection(extracted);
    const sanitizedExtracted = hasExtractedFeatures
      ? sanitizeFeatureCollection(extracted)
      : null;
    if (sanitizedExtracted) {
      applyOriginKey(sanitizedExtracted, originKey);
    }
    const featureCount = sanitizedExtracted
      ? sanitizedExtracted.features.length
      : buffer.featureCount;
    if (sanitizedExtracted && featureCount === 0) {
      return {
        status: 'skipped' as const,
        data: buffer.data,
        featureCount: 0,
        ratio: 0,
      };
    }
    const data = sanitizedExtracted
      ? await encodeGeoJson(sanitizedExtracted)
      : buffer.data;
    const ratio = inputBytes > 0 ? data.byteLength / inputBytes : 1;
    return {
      status: 'completed' as const,
      data,
      featureCount: featureCount ?? 0,
      ratio,
    };
  };
  let extraction = await runExtraction();
  if (extraction.status === 'skipped') {
    const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
    await db.extractedBuffers.put({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      data: buffer.data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: tunedTolerance,
      timestamp: Date.now(),
    });
    console.debug('[shapeStageWorker] Extract2 skipped', {
      taskId: task.taskId,
      reason: 'no features remain after extraction',
    });
    return { status: 'skipped', featureCount: 0 };
  }
  finalData = extraction.data;
  finalFeatureCount = extraction.featureCount;
  finalRatio = extraction.ratio;
  while (finalRatio > targetRatio && pass < maxTuningPasses) {
    pass += 1;
    tunedTolerance = tunedTolerance > 0 ? tunedTolerance * 2 : 0.1;
    if (typeof tunedQuantize === 'number') {
      tunedQuantize = Math.max(1, Math.round(tunedQuantize / 2));
    }
    console.debug('[shapeStageWorker] Extract2 tuning pass', {
      taskId: task.taskId,
      pass,
      tolerance: tunedTolerance,
      quantize: tunedQuantize,
      ratio: finalRatio,
    });
    extraction = await runExtraction();
    if (extraction.status === 'skipped') {
      break;
    }
    finalData = extraction.data;
    finalFeatureCount = extraction.featureCount;
    finalRatio = extraction.ratio;
  }
  const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
  await db.extractedBuffers.put({
    id: outputBufferId,
    nodeId: buffer.nodeId,
    stage: 'extract2',
    data: finalData,
    featureCount: finalFeatureCount,
    extractionRatio: buffer.featureCount ? finalFeatureCount / buffer.featureCount : 1,
    tolerance: tunedTolerance,
    timestamp: Date.now(),
  });
  console.debug('[shapeStageWorker] Extract2 result', {
    taskId: task.taskId,
    usedTopo,
    tolerance: tunedTolerance,
    quantize: tunedQuantize,
    inputBytes,
    outputBytes: finalData.byteLength ?? 0,
    ratio: finalRatio,
  });
  return { status: 'completed', featureCount: finalFeatureCount };
};

export const shapeStageWorker: ShapeStageWorkerAPI = {
  processDownloadTask,
  processExtract1Task,
  processExtract2Task,
  setAuthToken: async (token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number) => {
    const auth = await AuthRecoveryService.getSingleton();
    auth.setToken(token, type, expiresAt);
  },
};
