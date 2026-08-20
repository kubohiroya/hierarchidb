import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { TaskStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName, SourceTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { listTasksByStage } from '@hierarchidb/vt-orchestrator';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { geojson as geojsonApi } from 'flatgeobuf';
import { feature as topojsonFeature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { geometrySimplify, type GeometryEngine } from '@hierarchidb/gis-sdk';
import { runShapeSourceStage } from './runShapeSourceStage.js';
import {
  createPipelineLinkedAbortController,
  finalizePendingStageTasks,
  markStageTasksRecycled,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';

export type ShapeSourceStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
  buildConfig: ShapeRuntimeBuildConfig;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  abortSignal?: AbortSignal;
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'source';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
  onStageTasksPrepared?: (payload: {
    nodeId: NodeId;
    stage: TaskStage;
    taskCount: number;
  }) => Promise<void> | void;
};

export class SourceStageAuthPendingError extends Error {
  constructor(message = 'source stage paused: authentication required') {
    super(message);
    this.name = 'SourceStageAuthPendingError';
  }
}

const SOURCE_BASE_TOLERANCE_VERTEX_LIMIT = 6553;
const SOURCE_BASE_TOLERANCE_MAX_ITERATIONS = 32;
const SOURCE_BASE_TOLERANCE_INITIAL_HIGH = 0.1;
const SOURCE_BASE_TOLERANCE_HIGH_CAP = 12;
const SOURCE_BASE_TOLERANCE_EPSILON = 1e-7;
const textDecoder = new TextDecoder('utf-8');

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry: Feature['geometry']): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonVertices = (coordinates: unknown): number => {
  if (!Array.isArray(coordinates)) return 0;
  return countVertices(coordinates);
};

const visitPolygons = (
  geometry: Geometry | null | undefined,
  visit: (polygon: { vertexCount: number; geometry: Polygon }) => void,
): void => {
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    const polygonGeometry = geometry as Polygon;
    visit({ vertexCount: countPolygonVertices(polygonGeometry.coordinates), geometry: polygonGeometry });
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    const multiPolygonGeometry = geometry as MultiPolygon;
    for (const polygonCoords of multiPolygonGeometry.coordinates) {
      visit({
        vertexCount: countPolygonVertices(polygonCoords),
        geometry: { type: 'Polygon', coordinates: polygonCoords },
      });
    }
    return;
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries ?? []) {
      visitPolygons(child, visit);
    }
  }
};

const findMaxVertexPolygon = (
  collection: FeatureCollection,
): { vertexCount: number; polygon: Feature<Polygon> } | null => {
  let maxVertexCount = 0;
  let selectedPolygon: Feature<Polygon> | null = null;
  collection.features.forEach((feature) => {
    visitPolygons(feature?.geometry, ({ vertexCount, geometry }) => {
      if (vertexCount <= maxVertexCount) return;
      maxVertexCount = vertexCount;
      selectedPolygon = {
        type: 'Feature',
        properties: { ...(feature?.properties ?? {}) },
        geometry,
      };
    });
  });
  if (!selectedPolygon) return null;
  return { vertexCount: maxVertexCount, polygon: selectedPolygon };
};

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip decompression');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
};

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decodeTopoJson = (buffer: ArrayBuffer): Topology => {
  const text = textDecoder.decode(new Uint8Array(buffer));
  return JSON.parse(text) as Topology;
};

const decodeTopoJsonCollection = (topology: Topology): FeatureCollection => {
  const objectKeys = Object.keys(topology.objects ?? {});
  if (objectKeys.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  const firstObjectKey = objectKeys[0];
  if (!firstObjectKey) {
    return { type: 'FeatureCollection', features: [] };
  }
  const topoObject = topology.objects[firstObjectKey];
  if (!topoObject) {
    return { type: 'FeatureCollection', features: [] };
  }
  const extracted = topojsonFeature(topology, topoObject as never) as Feature | FeatureCollection;
  if (extracted.type === 'FeatureCollection') {
    return extracted as FeatureCollection;
  }
  return { type: 'FeatureCollection', features: [extracted as Feature] };
};

const decodeSourceCacheCollection = async (record: {
  data: ArrayBuffer;
  format?: 'flatgeobuf' | 'topojson';
  compression?: 'gzip' | 'none';
}): Promise<FeatureCollection | null> => {
  const format = record.format ?? 'flatgeobuf';
  if (format === 'topojson') {
    const decodedBuffer = record.compression === 'gzip'
      ? await decompressGzip(record.data)
      : record.data;
    const topology = decodeTopoJson(decodedBuffer);
    return decodeTopoJsonCollection(topology);
  }
  const decodedBuffer = record.compression === 'gzip'
    ? await decompressGzip(record.data)
    : record.data;
  const decoded = geojsonApi.deserialize(new Uint8Array(decodedBuffer));
  return await normalizeFeatureCollection(decoded);
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
);

const readStringField = (record: Record<string, unknown> | null, key: string): string | null => {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

const findSourceBaseToleranceByBisection = (params: {
  feature: Feature<Polygon>;
  geometryEngine: GeometryEngine;
  vertexLimit: number;
  maxIterations: number;
  initialHigh: number;
  highCap: number;
  epsilon: number;
}): {
  tolerance: number;
  converged: boolean;
  iterations: number;
  finalVertexCount: number;
} => {
  const sourceVertexCount = countVerticesFromGeometry(params.feature.geometry);
  if (sourceVertexCount <= params.vertexLimit) {
    return { tolerance: 0, converged: true, iterations: 0, finalVertexCount: sourceVertexCount };
  }
  const evaluate = (tolerance: number): number => {
    const simplified = geometrySimplify(params.feature, params.geometryEngine, {
      tolerance,
      highQuality: true,
      mutate: false,
      preserveTopology: true,
    });
    return countVerticesFromGeometry(simplified.geometry);
  };
  let iterations = 0;
  let low = 0;
  let high = Math.max(0, params.initialHigh);
  let highVertexCount = evaluate(high);
  iterations += 1;
  while (highVertexCount > params.vertexLimit && high < params.highCap && iterations < params.maxIterations) {
    low = high;
    high = Math.min(params.highCap, high * 2);
    highVertexCount = evaluate(high);
    iterations += 1;
  }
  if (highVertexCount > params.vertexLimit) {
    return { tolerance: high, converged: false, iterations, finalVertexCount: highVertexCount };
  }
  let bestTolerance = high;
  let bestVertexCount = highVertexCount;
  while (iterations < params.maxIterations && (high - low) > params.epsilon) {
    const mid = (low + high) / 2;
    const midVertexCount = evaluate(mid);
    iterations += 1;
    if (midVertexCount <= params.vertexLimit) {
      bestTolerance = mid;
      bestVertexCount = midVertexCount;
      high = mid;
    } else {
      low = mid;
    }
  }
  return { tolerance: bestTolerance, converged: true, iterations, finalVertexCount: bestVertexCount };
};

export const runShapeSourceStageSection = async (params: ShapeSourceStageParams): Promise<boolean> => {
  const sourceAbortController = createPipelineLinkedAbortController(params.abortSignal);
  if (sourceAbortController.signal.aborted) return true;
  await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
  if (sourceAbortController.signal.aborted) return true;
  if (params.resumeExistingTasks) {
    await markStageTasksRecycled(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
  }
  const runSourcePass = async (resumeExistingTasks: boolean): Promise<void> => {
    await runShapeSourceStage({
      nodeId: params.nodeId,
      dataSource: params.dataSource,
      selectedArrayByCountries: params.selectedArrayByCountries,
      downloadTaskPayloads: params.downloadTaskPayloads,
      buildConfig: params.buildConfig,
      taskQueue: params.taskQueue,
      waitIfPaused: params.waitIfPaused,
      resumeExistingTasks,
      abortController: sourceAbortController,
      failureHandling: params.failureHandling,
      onTasksEnqueued: params.onTasksEnqueued,
      onStageTasksPrepared: params.onStageTasksPrepared,
    });
  };
  try {
    await runSourcePass(params.resumeExistingTasks);
  } catch (error) {
    // Handle abort errors specifically
    if (params.abortSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      console.log('[ShapeSource][AbortHandling] Source stage aborted via signal', {
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return true;
    }

    // Handle other errors
    const baseMessage = error instanceof Error ? error.message : String(error);
    const failedTaskId = error && typeof error === 'object'
      ? (error as { taskId?: string }).taskId
      : undefined;
    const reason = failedTaskId ? `${baseMessage} (failedTaskId=${failedTaskId})` : baseMessage;
    
    console.error('[ShapeSource][ErrorHandling] Source stage failed with error', {
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: baseMessage,
      failedTaskId,
    });
    
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'source',
      `aborted: ${reason}`,
      '[ShapeSource][PipelineDiagnostics] source stage aborted',
      params.pipelineRunId,
    );
    throw error;
  }
  if (sourceAbortController.signal.aborted) {
    return true;
  }
  let stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
  if (sourceAbortController.signal.aborted) return true;
  console.warn('[ShapeSource][PipelineDiagnostics] stage source completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: stageCounts,
  }));
  if (!params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    console.warn('[ShapeSource][PipelineDiagnostics] source stage left pending tasks on fresh run; retrying queued drain once', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      counts: stageCounts,
    }));
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
    await runSourcePass(true);
    if (sourceAbortController.signal.aborted) return true;
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
  }
  if (params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
    if (stageCounts.queued > 0 || stageCounts.running > 0) {
      console.warn('[ShapeSource][PipelineDiagnostics] source stage left pending tasks during resume; keep queued for next retry', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        counts: stageCounts,
      }));
    }
  }
  const shouldFinalizePending = !params.resumeExistingTasks || (stageCounts.queued === 0 && stageCounts.running === 0);
  if (sourceAbortController.signal.aborted) return true;
  const finalizedPending = await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'source',
    'aborted: source stage completed with pending tasks',
    '[ShapeSource][PipelineDiagnostics] source stage finalized pending tasks',
    params.pipelineRunId,
    {
      markFailed: shouldFinalizePending,
    },
  );
  if (sourceAbortController.signal.aborted) return true;
  if (finalizedPending.authPending > 0) {
    throw new SourceStageAuthPendingError();
  }
  if (finalizedPending.queued > 0 || finalizedPending.running > 0) {
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
    if (sourceAbortController.signal.aborted) return true;
  }
  const fetchTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'source');
  if (sourceAbortController.signal.aborted) return true;
  let featureMax = 0;
  let polygonMax = 0;
  let maxPolygonVertexCount = 0;
  let baseTolerance = 0;
  const baseToleranceVertexLimit = SOURCE_BASE_TOLERANCE_VERTEX_LIMIT;
  fetchTasks.forEach((task) => {
    const metadata = task.metadata;
    const fetchDetail = (typeof metadata === 'object' && metadata !== null
      ? (metadata as { fetchDetail?: unknown }).fetchDetail
      : null) as Record<string, unknown> | null;
    const features = fetchDetail && typeof fetchDetail.features === 'object' && fetchDetail.features !== null
      ? fetchDetail.features as Record<string, unknown>
      : null;
    const polygons = fetchDetail && typeof fetchDetail.polygons === 'object' && fetchDetail.polygons !== null
      ? fetchDetail.polygons as Record<string, unknown>
      : (fetchDetail && typeof fetchDetail.polygonsPerFeature === 'object' && fetchDetail.polygonsPerFeature !== null
        ? fetchDetail.polygonsPerFeature as Record<string, unknown>
        : null);
    const fallbackPolygons = fetchDetail && typeof fetchDetail.polygons === 'object' && fetchDetail.polygons !== null
      ? fetchDetail.polygons as Record<string, unknown>
      : null;
    const maxPolygonVertexCountDetail = fetchDetail && typeof fetchDetail.maxPolygonVertexCount === 'object' && fetchDetail.maxPolygonVertexCount !== null
      ? fetchDetail.maxPolygonVertexCount as Record<string, unknown>
      : null;
    const featureInput = typeof features?.input === 'number'
      ? features.input
      : (typeof features?.output === 'number' ? features.output : null);
    const polygonInput = typeof polygons?.input === 'number'
      ? polygons.input
      : (typeof polygons?.output === 'number' ? polygons.output : null);
    const polygonFromAverage = (
      polygonInput === null
      && typeof fallbackPolygons?.input === 'number'
      && featureInput !== null
      && featureInput > 0
    )
      ? (fallbackPolygons.input / featureInput)
      : null;
    const featureValue = featureInput;
    const polygonValue = polygonInput ?? polygonFromAverage;
    const maxPolygonVertexValue = typeof maxPolygonVertexCountDetail?.output === 'number'
      ? maxPolygonVertexCountDetail.output
      : (typeof maxPolygonVertexCountDetail?.input === 'number'
        ? maxPolygonVertexCountDetail.input
        : null);
    if (featureValue !== null && Number.isFinite(featureValue) && featureValue > featureMax) {
      featureMax = Math.max(0, Math.round(featureValue));
    }
    if (polygonValue !== null && Number.isFinite(polygonValue) && polygonValue > polygonMax) {
      polygonMax = Math.max(0, Math.round(polygonValue));
    }
    if (maxPolygonVertexValue !== null && Number.isFinite(maxPolygonVertexValue) && maxPolygonVertexValue > maxPolygonVertexCount) {
      maxPolygonVertexCount = Math.max(0, Math.round(maxPolygonVertexValue));
    }
  });

  const geometryEngine: GeometryEngine = params.buildConfig.geometryConfig.geometryEngine ?? 'turf';
  let selectedPolygon: Feature<Polygon> | null = null;
  const sourceCacheIds = new Set<string>();
  const sourceCacheFormats = new Map<string, { format: 'flatgeobuf' | 'topojson'; compression: 'gzip' | 'none' }>();
  for (const task of fetchTasks) {
    const output = typeof task.outputData === 'object' && task.outputData !== null
      ? task.outputData as Record<string, unknown>
      : null;
    const sourceCacheId = typeof output?.sourceCacheId === 'string' ? output.sourceCacheId : null;
    if (!sourceCacheId) continue;
    sourceCacheIds.add(sourceCacheId);
    const taskMetadata = asRecord(task.metadata);
    const preview = asRecord(taskMetadata?.preview);
    const sourceCacheFormat = readStringField(preview, 'sourceCacheFormat');
    const sourceCacheCompression = readStringField(preview, 'sourceCacheCompression');
    sourceCacheFormats.set(sourceCacheId, {
      format: sourceCacheFormat === 'topojson' ? 'topojson' : 'flatgeobuf',
      compression: sourceCacheCompression === 'gzip' ? 'gzip' : 'none',
    });
  }
  for (const sourceCacheId of sourceCacheIds) {
    if (sourceAbortController.signal.aborted) return true;
    const sourceCache = await shapeQueryAPIImpl.getSourceCache(params.nodeId, sourceCacheId);
    if (sourceAbortController.signal.aborted) return true;
    if (!sourceCache) continue;
    const cacheFormat = sourceCacheFormats.get(sourceCacheId);
    const format = cacheFormat?.format ?? 'flatgeobuf';
    const compression = cacheFormat?.compression ?? 'none';
    const collection = await decodeSourceCacheCollection({
      data: sourceCache.data,
      format,
      compression,
    });
    if (sourceAbortController.signal.aborted) return true;
    if (!collection || collection.features.length === 0) continue;
    const maxPolygon = findMaxVertexPolygon(collection);
    if (!maxPolygon) continue;
    if (maxPolygon.vertexCount <= maxPolygonVertexCount) continue;
    maxPolygonVertexCount = maxPolygon.vertexCount;
    selectedPolygon = maxPolygon.polygon;
  }
  if (selectedPolygon && maxPolygonVertexCount > 0) {
    const baseSearch = findSourceBaseToleranceByBisection({
      feature: selectedPolygon,
      geometryEngine,
      vertexLimit: SOURCE_BASE_TOLERANCE_VERTEX_LIMIT,
      maxIterations: SOURCE_BASE_TOLERANCE_MAX_ITERATIONS,
      initialHigh: SOURCE_BASE_TOLERANCE_INITIAL_HIGH,
      highCap: SOURCE_BASE_TOLERANCE_HIGH_CAP,
      epsilon: SOURCE_BASE_TOLERANCE_EPSILON,
    });
    baseTolerance = baseSearch.tolerance;
  }

  if (sourceAbortController.signal.aborted) return true;
  await shapeMutationAPIImpl.updateBuildSession(params.nodeId, {
    sourceStageMaxima: {
      featureMax,
      polygonMax,
      maxPolygonVertexCount,
      baseTolerance,
      vertexLimit: baseToleranceVertexLimit,
    },
  });
  if (sourceAbortController.signal.aborted) return true;
  if (stageCounts.failed > 0 && stageCounts.completed === 0) {
    return true;
  }
  return shouldStopAfterStage(
    params.buildContinuationPolicy,
    stageCounts.failed,
  );
};
