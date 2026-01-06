import type { DownloadTaskRequest, ShapeStageWorkerAPI, ShapeStageWorkerTaskResult, ExtractTaskRequest } from './ShapeStageWorkerTypes.js';
import { getShapeDbApiClient } from '../ShapeBatchApiClient.js';
import { defaultDataSourceFactory } from '../../datasources/DataSourceStrategyFactory.js';
import type { BoundingBox as TaskBoundingBox, Extract1Task, Extract2Task } from '../../../common/types/index.js';
import type { BoundingBox as DataSourceBoundingBox } from '../../datasources/DataSourceStrategy.js';
import type { Feature, FeatureCollection } from 'geojson';
import type { NodeId } from '@hierarchidb/common-types';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import { applyFeatureFiltering, type FeatureFilterSettings, extractGeoJson } from '@hierarchidb/gis-sdk';
import { extractTopoJsonByTiles } from '../utils/topojsonExtract.js';
import { applyOriginKey, assignFeatureIds, HDB_ORIGIN_KEY } from '../utils/featureIds.js';
import { AuthService } from '@hierarchidb/auth-recovery';
import { resolveStrategyIdFromDataSource } from '../../datasources/strategyIds.js';
import { buildTileCoordinates } from '../session/tiles/tileCoordinates.js';
import { buildTileId } from '../../../worker/shapeVectorTileStore.dexie.js';
import { buildDownloadCacheKey, readDownloadBuffer, storeDownloadBufferForNode } from '../../utils/chunkStore.js';

type GeojsonVtModule = typeof import('geojson-vt');

type GeojsonVtIndexOptions = {
  extent: number;
  buffer: number;
  indexMaxZoom: number;
  promoteId: string;
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

const loadGeojsonVt = async (): Promise<GeojsonVtModule> => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: GeojsonVtModule } & GeojsonVtModule;
  return candidate.default ?? candidate;
};

const buildGeojsonVtIndex = async (
  collection: FeatureCollection,
  options: GeojsonVtIndexOptions,
): Promise<Record<string, unknown>> => {
  const geojsonvt = await loadGeojsonVt();
  const index = geojsonvt(collection, {
    maxZoom: options.indexMaxZoom,
    indexMaxZoom: options.indexMaxZoom,
    extent: options.extent,
    buffer: options.buffer,
    promoteId: options.promoteId,
  });
  return index as unknown as Record<string, unknown>;
};

const resolveVectorTileIndexOptions = (
  payload: { vectorTileBuffer?: number; vectorTileExtent?: number; vectorTileMaxZoom?: number; zoomLevels?: number[] },
): GeojsonVtIndexOptions | null => {
  const buffer = payload.vectorTileBuffer;
  const extent = payload.vectorTileExtent;
  const maxZoomFromLevels = payload.zoomLevels?.length ? Math.max(...payload.zoomLevels) : undefined;
  const indexMaxZoom = payload.vectorTileMaxZoom ?? maxZoomFromLevels;
  if (!Number.isFinite(buffer) || !Number.isFinite(extent) || !Number.isFinite(indexMaxZoom)) {
    return null;
  }
  return {
    buffer: Number(buffer),
    extent: Number(extent),
    indexMaxZoom: Number(indexMaxZoom),
    promoteId: 'id',
  };
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
    if (context.originKey && typeof properties.originKey !== 'string') {
      properties.originKey = context.originKey;
    }
  }
};

const buildTileIdRelations = (params: {
  nodeId: NodeId;
  bufferId: string;
  zoomLevels?: number[];
  features: Feature[];
}): Array<{ id: string; nodeId: NodeId; tileId: string; bufferId: string; createdAt: number }> => {
  const { nodeId, bufferId, zoomLevels, features } = params;
  if (!zoomLevels || zoomLevels.length === 0 || features.length === 0) return [];
  const tileIds = new Set<string>();
  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    let bbox: [number, number, number, number];
    try {
      const res = turfBbox(feature);
      if (res.length !== 4) continue;
      bbox = [res[0], res[1], res[2], res[3]];
    } catch {
      continue;
    }
    const tiles = buildTileCoordinates(bbox, zoomLevels);
    for (const tile of tiles) {
      tileIds.add(buildTileId(nodeId, tile.z, tile.x, tile.y));
    }
  }
  const createdAt = Date.now();
  return Array.from(tileIds).map((tileId) => ({
    id: `${tileId}-${bufferId}`,
    nodeId,
    tileId,
    bufferId,
    createdAt,
  }));
};

const createTimeoutSignal = (timeoutMs?: number): { signal?: AbortSignal; cleanup: () => void } => {
  if (!timeoutMs || timeoutMs <= 0 || typeof AbortController === 'undefined') {
    return { signal: undefined, cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
};

const processDownloadTask = async ({
  nodeId,
  input,
  task,
}: DownloadTaskRequest): Promise<ShapeStageWorkerTaskResult> => {
  const strategyId = resolveStrategyIdFromDataSource(input.dataSource);
  if (!strategyId) {
    return { status: 'failed', errorMessage: 'No data source strategy available' };
  }
  const ds = defaultDataSourceFactory.create(strategyId);
  const retryAttempts = input.retryAttempts ?? 0;
  const retryDelay = input.retryDelay ?? 0;
  const timeoutMs = input.timeoutMs;
  const bbox = normalizeBoundingBox(input.bbox);
  const tags = input.tags;
  const country = input.countryCode;
  const adminLevel = input.adminLevel;
  const sourceUrl = input.url;
  const taskId = task.taskId;
  const cacheCountry = input.dataSource === 'naturalearth' ? undefined : country;
  const cacheKey = buildDownloadCacheKey({
    dataSource: input.dataSource,
    countryCode: cacheCountry,
    adminLevel,
    url: sourceUrl,
  });
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    const timeout = createTimeoutSignal(timeoutMs);
    try {
      const startedAt = Date.now();
      console.debug('[shapeStageWorker] Download task start', {
        taskId,
        attempt,
        url: sourceUrl,
      });
      const raw = await ds.fetchData({
        nodeId,
        country,
        adminLevel,
        endpoint: input.endpoint,
        bbox,
        tags,
        timeout: timeoutMs,
        signal: timeout.signal,
      });
      const fetchMs = Date.now() - startedAt;
      console.debug('[shapeStageWorker] Download fetch complete', { taskId, attempt, ms: fetchMs });
      const processed = await ds.processData(raw, { adminLevel });
      const processMs = Date.now() - startedAt;
      console.debug('[shapeStageWorker] Download process complete', {
        taskId,
        attempt,
        ms: processMs,
        features: processed.length,
      });
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
      const serializeMs = Date.now() - startedAt;
      console.debug('[shapeStageWorker] Download serialize complete', {
        taskId,
        attempt,
        ms: serializeMs,
        bytes: fgb.byteLength,
      });
      await storeDownloadBufferForNode({
        nodeId,
        cacheKey,
        buffer: fgb,
      });
      const storeMs = Date.now() - startedAt;
      console.debug('[shapeStageWorker] Download store complete', {
        taskId,
        attempt,
        ms: storeMs,
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
    } finally {
      timeout.cleanup();
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
  const ephemeral = getShapeDbApiClient().ephemeral;
  const inputBufferId = input.inputBufferId ?? '';
  const rawBuffer = await readDownloadBuffer(nodeId, inputBufferId);
  if (!rawBuffer) {
    return { status: 'failed', errorMessage: `Raw buffer not found: ${inputBufferId}` };
  }
  const rawNodeId = nodeId;
  const enableFeatureFiltering = input.enableFeatureFiltering ?? true;
  const originKey = input.originKey;
  const geojson = await decodeGeoJson(rawBuffer);
  const rawCount = isFeatureCollection(geojson) ? geojson.features.length : 0;
  if (rawCount === 0) {
    await ephemeral.putExtractedBuffer({
      id: `${nodeId}-extract1-${taskIndex}`,
      nodeId: rawNodeId,
      stage: 'extract1',
      data: rawBuffer,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  if (!enableFeatureFiltering) {
    const outputBufferId = `${nodeId}-extract1-${taskIndex}`;
    const featureCount = rawCount;
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: rawNodeId,
      stage: 'extract1',
      data: rawBuffer,
      featureCount,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: Date.now(),
    });
    return { status: 'completed', featureCount };
  }
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
  const filteredCount = sanitizedFiltered ? sanitizedFiltered.features.length : rawCount;
  const extractedCount = sanitizedExtracted ? sanitizedExtracted.features.length : filteredCount;
  if (rawCount > 0 && (filteredCount < rawCount || extractedCount < filteredCount)) {
    console.debug('[shapeStageWorker] Extract1 feature reduction', {
      taskId: task.taskId,
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
      method: input.featureFilterMethod,
      minArea: input.minimumArea,
      rawCount,
      filteredCount,
      extractedCount,
      tolerance,
    });
  }
  if (sanitizedExtracted) {
    applyOriginKey(sanitizedExtracted, originKey);
    assignFeatureIds(sanitizedExtracted, {
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
    });
  }
  const featureCount = sanitizedExtracted
    ? sanitizedExtracted.features.length
    : rawCount;
  if (sanitizedFiltered && featureCount === 0) {
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: rawNodeId,
      stage: 'extract1',
      data: rawBuffer,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const data = sanitizedExtracted
    ? await encodeGeoJson(sanitizedExtracted)
    : rawBuffer;
  if (!featureCount) {
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: rawNodeId,
      stage: 'extract1',
      data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: input.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  await ephemeral.putExtractedBuffer({
    id: outputBufferId,
    nodeId: rawNodeId,
    stage: 'extract1',
    data,
    featureCount,
    extractionRatio: rawCount > 0 ? featureCount / rawCount : 1,
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
  const ephemeral = getShapeDbApiClient().ephemeral;
  const inputBufferId = payload.inputBufferId ?? '';
  const extracted = await ephemeral.getExtractedBuffer(inputBufferId);
  const rawBuffer = extracted ? null : await readDownloadBuffer(nodeId, inputBufferId);
  if (!extracted && !rawBuffer) {
    return { status: 'failed', errorMessage: `Extract2 input buffer not found: ${inputBufferId}` };
  }
  const rawGeojson = extracted ? null : await decodeGeoJson(rawBuffer as ArrayBuffer);
  const rawCount = extracted
    ? extracted.featureCount
    : (isFeatureCollection(rawGeojson) ? rawGeojson.features.length : 0);
  const buffer = extracted ?? {
    id: inputBufferId,
    nodeId,
    stage: 'extract1' as const,
    data: rawBuffer as ArrayBuffer,
    featureCount: rawCount,
    extractionRatio: 1,
    tolerance: 0,
    timestamp: Date.now(),
  };
  const originKey = payload.originKey;
  if (!buffer.featureCount) {
    const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
    const baseTolerance = payload.tolerance ?? 0;
    const retry = payload.retry ?? 0;
    const retryScale = retry > 0 ? 1 + retry * 2 : 1;
    const effectiveTolerance = baseTolerance * retryScale;
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
      data: buffer.data,
      featureCount: 0,
      extractionRatio: 0,
      tolerance: effectiveTolerance,
      timestamp: Date.now(),
    });
    return { status: 'skipped', featureCount: 0 };
  }
  const geojson = extracted ? await decodeGeoJson(buffer.data) : rawGeojson;
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
  const vectorTileOptions = resolveVectorTileIndexOptions(payload);
  if (!vectorTileOptions) {
    return {
      status: 'failed',
      errorMessage: `Vector tile index config is required for extract2: ${task.taskId}`,
    };
  }
  const storeGeojsonVtIndexRecord = async (bufferId: string, features: Feature[]) => {
    if (!features.length) return;
    const collection = assignFeatureIds(
      { type: 'FeatureCollection', features },
      {
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
      },
    );
    const index = await buildGeojsonVtIndex(collection, vectorTileOptions);
    await ephemeral.putGeojsonVtIndex({
      id: `${String(nodeId)}:${bufferId}`,
      nodeId,
      bufferId,
      index,
      options: vectorTileOptions,
      createdAt: Date.now(),
    });
  };
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
      const tileRelations = buildTileIdRelations({
        nodeId,
        bufferId: outputBufferId,
        zoomLevels: payload.zoomLevels,
        features: sanitized.features,
      });
      if (tileRelations.length > 0) {
        await ephemeral.putTileIdRelations(tileRelations);
      }
      await storeGeojsonVtIndexRecord(outputBufferId, sanitized.features);
      await ephemeral.putExtractedBuffer({
        id: outputBufferId,
        nodeId: buffer.nodeId,
        stage: 'extract2',
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
        data,
        featureCount,
        extractionRatio: buffer.featureCount ? featureCount / buffer.featureCount : 1,
        tolerance: 0,
        timestamp: Date.now(),
      });
      return { status: 'completed', featureCount };
    }
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
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
  console.debug('[shapeStageWorker] Extract2 config', {
    taskId: task.taskId,
    extractionMode,
    preserveSharedBoundaries: payload.preserveSharedBoundaries,
    inputFeatures: buffer.featureCount ?? 0,
    inputBytes,
  });
  const runExtraction = async () => {
    let extractedPayload: unknown = geojson;
    usedTopo = false;
    if (extractionMode === 'topojson' && payload.preserveSharedBoundaries && isFeatureCollection(geojson)) {
      try {
        extractedPayload = extractTopoJsonByTiles(geojson, {
          tolerance: tunedTolerance,
          quantize: tunedQuantize,
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
        features: [],
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
      features: sanitizedExtracted?.features ?? [],
    };
  };
  let extraction = await runExtraction();
  if (extraction.status === 'skipped') {
    const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
    await ephemeral.putExtractedBuffer({
      id: outputBufferId,
      nodeId: buffer.nodeId,
      stage: 'extract2',
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
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
  let finalFeatures = extraction.features ?? [];
  const shouldTune = extractionMode !== 'geojson';
  while (shouldTune && finalRatio > targetRatio && pass < maxTuningPasses) {
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
    finalFeatures = extraction.features ?? [];
  }
  const outputBufferId = `${nodeId}-extract2-${taskIndex}`;
  if (finalFeatures.length > 0) {
    const collection = assignFeatureIds(
      { type: 'FeatureCollection', features: finalFeatures },
      {
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
      },
    );
    finalFeatures = collection.features;
  }
  const tileRelations = buildTileIdRelations({
    nodeId,
    bufferId: outputBufferId,
    zoomLevels: payload.zoomLevels,
    features: finalFeatures,
  });
  if (tileRelations.length > 0) {
    await ephemeral.putTileIdRelations(tileRelations);
  }
  await storeGeojsonVtIndexRecord(outputBufferId, finalFeatures);
  await ephemeral.putExtractedBuffer({
    id: outputBufferId,
    nodeId: buffer.nodeId,
    stage: 'extract2',
    countryCode: task.countryCode,
    adminLevel: task.adminLevel,
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
    inputFeatures: buffer.featureCount ?? 0,
    outputFeatures: finalFeatureCount,
  });
  return { status: 'completed', featureCount: finalFeatureCount };
};

export const shapeStageWorker: ShapeStageWorkerAPI = {
  processDownloadTask,
  processExtract1Task,
  processExtract2Task,
  setAuthToken: async (token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number) => {
    const auth = await AuthService.getSingleton();
    auth.setToken(token, type, expiresAt);
  },
};
