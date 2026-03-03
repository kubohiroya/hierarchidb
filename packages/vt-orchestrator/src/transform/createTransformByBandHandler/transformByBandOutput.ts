import type { NodeId } from '@hierarchidb/core-types';
import {
  encodeFlatGeobufFromFeatureCollection,
  type EphemeralDB,
  type EphemeralGeometryCacheRecord,
} from '@hierarchidb/gis-sdk';
import type { Feature, FeatureCollection } from 'geojson';
import type { TaskDisplayPayload } from '../../../../build-api';
import type { StageHandlerResult, TransformByBandTaskInput } from '~/types/types';
import { buildBoundaryFeature } from '../geometry.js';
import { finalizeTransformByBandCache } from './transformByBandTaskFinalize.js';
import { collectTileIdsForCollection, buildBoundaryDiagnostics, validateOutputForVt } from './helpers/collection.js';
import type { GeometryOps } from './helpers/core.js';
import {
  TASKDEBUG_BUILD_TAG,
  TRANSFORM_DB_WRITE_TIMEOUT_MS,
  isTaskDebugLoggingEnabled,
  validateEncodedFlatGeobuf,
  withTimeout,
} from './helpers/core.js';
import {
  countPolygonsFromGeometry,
  countVerticesFromGeometry,
} from './helpers/validation.js';
import { runStageWithLabel } from './helpers/runtime.js';
import { buildShapeSourceLayerName } from '@hierarchidb/gis-sdk';


type UpdateTaskStrict = (taskId: string, updates: Record<string, unknown>, operation: string) => Promise<void>;

type UpdateTaskPhase = (
  taskId: string,
  phase: string,
  progress?: number,
  options?: {
    key?: string;
    params?: TaskDisplayPayload['params'];
  },
) => Promise<void>;

type TransformByBandOutputParams = {
  taskId: string;
  nodeId: NodeId;
  input: TransformByBandTaskInput;
  band: {
    bandIndex: number;
    zMax: number;
    zBase: number;
  };
  boundaryDisableAtZoomOrAbove?: number;
  simplified: FeatureCollection;
  inputFeatureCount: number;
  inputPolygonCount: number;
  inputVertexCount: number;
  tolerance: number;
  geometryOps: GeometryOps;
  taskProgressRange: {
    outputBuildStart: number;
    outputBuildEnd: number;
    encodeStart: number;
    encodeEnd: number;
    cachePutStart: number;
  };
  abortSignal?: AbortSignal;
  updateTaskPhase: UpdateTaskPhase;
  reportPolygonProgress: (
    taskId: string,
    processedPolygons: number,
    totalPolygons: number,
    message?: string,
  ) => Promise<void>;
  setStageLabel: (value: string) => void;
  logDebugPhase: (phase: string, details?: Record<string, unknown>) => void;
  setOutputCollection: (collection: FeatureCollection | null) => void;
  assertNotAborted: (signal?: AbortSignal) => void;
  updateTaskStrict: UpdateTaskStrict;
  ephemeralDB: EphemeralDB;
  resultMetadata: Record<string, unknown>;
  persistGeometryCacheMetadata?: (metadata: Record<string, unknown>) => Promise<void>;
};

const collectArrayBufferSnapshot = (data: unknown): Record<string, unknown> => {
  const dataIsObject = data !== null && typeof data === 'object';
  const dataConstructorName = dataIsObject
    ? (data as { constructor?: { name?: string } }).constructor?.name ?? null
    : null;
  const dataByteLength = dataIsObject && 'byteLength' in (data as { byteLength?: number })
    ? (data as { byteLength?: number }).byteLength ?? null
    : null;
  const dataSize = dataIsObject && 'size' in (data as { size?: number })
    ? (data as { size?: number }).size ?? null
    : null;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer;
  const isArrayBufferView = dataIsObject
    && typeof ArrayBuffer !== 'undefined'
    && typeof ArrayBuffer.isView === 'function'
      ? ArrayBuffer.isView(data as ArrayBufferView)
      : null;
  const isUint8Array = typeof Uint8Array !== 'undefined' && data instanceof Uint8Array;
  return {
    dataType: data === null ? 'null' : typeof data,
    dataConstructorName,
    dataByteLength,
    dataSize,
    isArrayBuffer,
    isArrayBufferView,
    isUint8Array,
  };
};

export const runTransformByBandOutputPhase = async (
  params: TransformByBandOutputParams,
): Promise<StageHandlerResult> => {
  const {
    taskId,
    nodeId,
    input,
    band,
    boundaryDisableAtZoomOrAbove,
    simplified,
    inputFeatureCount,
    inputPolygonCount,
    inputVertexCount,
    tolerance,
    geometryOps,
    taskProgressRange,
    abortSignal,
    updateTaskPhase,
    reportPolygonProgress,
    setStageLabel,
    logDebugPhase,
    setOutputCollection,
    assertNotAborted,
    updateTaskStrict,
    ephemeralDB,
    resultMetadata,
    persistGeometryCacheMetadata,
  } = params;

  const simplifiedFeatureCount = simplified.features.length;
  const simplifiedVertexCount = simplified.features.reduce(
    (sum, feature) => sum + countVerticesFromGeometry(feature.geometry),
    0,
  );
  const simplifiedPolygonCount = simplified.features.reduce(
    (sum, feature) => sum + countPolygonsFromGeometry(feature.geometry),
    0,
  );
  const adminLevel = input.adminLevel;
  const resolvedAdminLevel = typeof adminLevel === 'number' ? adminLevel : 0;
  const layerName = buildShapeSourceLayerName(resolvedAdminLevel, 'fill');
  const boundaryLayerName = buildShapeSourceLayerName(resolvedAdminLevel, 'boundary');
  const shouldBuildBoundary = typeof boundaryDisableAtZoomOrAbove === 'number'
    ? band.zMax < boundaryDisableAtZoomOrAbove
    : true;

  await updateTaskPhase(taskId, 'output:build:start', taskProgressRange.outputBuildStart);
  logDebugPhase('output-build:start', {
    featureCount: simplifiedFeatureCount,
    polygonCount: simplifiedPolygonCount,
  });

  const features = [] as Array<Feature>;
  let outputVertexCount = 0;
  let outputPolygonCount = 0;
  for (let index = 0; index < simplified.features.length; index += 1) {
    assertNotAborted(abortSignal);
    const feature = simplified.features[index];
    if (!feature) continue;
    const properties = {
      ...(feature.properties ?? {}),
      layer: layerName,
      level: adminLevel,
    } as Record<string, unknown> & { id?: string };
    const id = properties.id ?? `${input.sourceKey}:${index}`;
    properties.id = id;
    const featureWithId = { ...feature, id, properties };
    features.push(featureWithId);
    outputVertexCount += countVerticesFromGeometry(featureWithId.geometry);
    outputPolygonCount += countPolygonsFromGeometry(featureWithId.geometry);
    if (shouldBuildBoundary) {
      setStageLabel('boundary');
      const boundaryFeature = await runStageWithLabel(
        'boundary',
        () => buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel),
      );
      features.push(boundaryFeature);
      outputVertexCount += countVerticesFromGeometry(boundaryFeature.geometry);
      outputPolygonCount += countPolygonsFromGeometry(boundaryFeature.geometry);
    }
  }

  const outputCollectionValue: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };
  setOutputCollection(outputCollectionValue);
  logDebugPhase('output-build:done', { featureCount: outputCollectionValue.features.length });
  if (outputCollectionValue.features.length === 0) {
    await reportPolygonProgress(taskId, inputPolygonCount, inputPolygonCount);
    if (persistGeometryCacheMetadata) {
      const skippedMetadata = {
        ...resultMetadata,
        status: 'Skipped',
      };
      await persistGeometryCacheMetadata(skippedMetadata).catch((error) => {
        console.error('[ShapeGeometry] failed to persist skipped geometry cache metadata', {
          taskId,
          nodeId,
          error,
        });
      });
    }
    return {
      status: 'completed',
      progress: 100,
      display: {
        kind: 'skip',
        key: 'stage.taskSkip.emptyOutputAfterSimplify',
        params: {
          inputFeatures: inputFeatureCount,
        },
      },
      outputData: {
        processedPolygons: inputPolygonCount,
        totalPolygons: inputPolygonCount,
      },
      metadata: resultMetadata,
    };
  }

  const boundaryDiagnostics = buildBoundaryDiagnostics(outputCollectionValue);
  if (boundaryDiagnostics && isTaskDebugLoggingEnabled()) {
    console.debug('[ShapeGeometry][BoundaryDiagnostics]', JSON.stringify({
      nodeId,
      taskId,
      sourceKey: input.sourceKey,
      adminLevel: input.adminLevel,
      bandIndex: input.bandIndex,
      zTarget: band.zMax,
      boundary: boundaryDiagnostics,
    }));
  }

  setStageLabel('validate:geojson');
  const issues = validateOutputForVt(outputCollectionValue);
  if (issues.length > 0) {
    const sample = issues.slice(0, 5);
    console.error('[ShapeGeometry][GeojsonValidation]', JSON.stringify({
      nodeId,
      taskId,
      sourceKey: input.sourceKey,
      adminLevel: input.adminLevel,
      bandIndex: input.bandIndex,
      zTarget: band.zMax,
      issueCount: issues.length,
      sample,
    }));
    throw new Error(`geometry failed: invalid geojson for vt (issues=${issues.length})`);
  }

  const cacheId = `${nodeId}-b${input.bandIndex}-${input.domainType}-${input.sourceKey}`;
  const vertexCount = outputVertexCount;
  const polygonCount = outputPolygonCount;
  const relationFeatureCount = outputCollectionValue.features.length;
  assertNotAborted(abortSignal);
  setStageLabel('encode');
  await updateTaskPhase(taskId, 'output:build:done', taskProgressRange.outputBuildEnd);
  await updateTaskPhase(taskId, 'encode:start', taskProgressRange.encodeStart, {
    key: 'stage.taskPhase.geometryCacheEncodeStart',
  });
  logDebugPhase('encode:start', { featureCount: outputCollectionValue.features.length });
  const encoded = await runStageWithLabel('encode', () => encodeFlatGeobufFromFeatureCollection(outputCollectionValue));
  if (encoded.byteLength === 0) {
    throw new Error('geometry failed: empty geometry cache buffer');
  }

  if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
    const probe = collectArrayBufferSnapshot(encoded);
    console.info('[ShapeGeometry][TaskDebug] geometry cache encode probe', {
      tag: TASKDEBUG_BUILD_TAG,
      nodeId: String(nodeId),
      cacheId,
      ...probe,
    });
  }

  setStageLabel('encode:validate');
  await runStageWithLabel('encode:validate', () => validateEncodedFlatGeobuf(encoded));
  logDebugPhase('encode:done', { byteLength: encoded.byteLength });
  await updateTaskPhase(taskId, 'encode:done', taskProgressRange.encodeEnd, {
    key: 'stage.taskPhase.geometryCacheEncodeDone',
  });

  const extractionRatio = inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : 0;
  setStageLabel('cache:put');
  assertNotAborted(abortSignal);
  await updateTaskPhase(taskId, 'cache:put:start', taskProgressRange.cachePutStart);
  logDebugPhase('cache-put:start', { cacheId });
  const cacheRecordDomainType = input.domainType as EphemeralGeometryCacheRecord['domainType'];

  const cacheRecord: Omit<EphemeralGeometryCacheRecord, 'timestamp'> = {
    id: cacheId,
    nodeId,
    bandIndex: input.bandIndex,
    domainType: cacheRecordDomainType,
    sourceKey: input.sourceKey,
    countryCode: input.countryCode,
    adminLevel: input.adminLevel,
    data: encoded,
    featureCount: relationFeatureCount,
    vertexCount,
    polygonCount,
    extractionRatio,
    tolerance,
    metadata: resultMetadata,
  };

  await finalizeTransformByBandCache({
    taskId,
    ephemeralDB,
    updateTaskStrict,
    cacheRecord,
    metadata: resultMetadata,
    metrics: {
      features: { input: inputFeatureCount, output: simplifiedFeatureCount },
      polygons: { input: inputPolygonCount, output: simplifiedPolygonCount },
      vertices: { input: inputVertexCount, output: simplifiedVertexCount },
    },
    outputData: {
      processedPolygons: inputPolygonCount,
      totalPolygons: inputPolygonCount,
    },
  });

  if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
    const saved = await ephemeralDB.geometryCache.get(cacheId);
    const data = saved?.data ?? null;
    const probe = collectArrayBufferSnapshot(data);
    console.info('[ShapeGeometry][TaskDebug] geometry cache readback probe', {
      tag: TASKDEBUG_BUILD_TAG,
      nodeId: String(nodeId),
      cacheId: String(cacheId),
      hasRecord: Boolean(saved),
      recordKeys: saved ? Object.keys(saved) : [],
      timestamp: (saved as { timestamp?: number }).timestamp ?? null,
      ...probe,
    });
  }
  logDebugPhase('cache-put:done', { cacheId });

  const tileIds = collectTileIdsForCollection(outputCollectionValue, band.zBase, geometryOps);
  console.info('[ShapeGeometry][TileIndex]', JSON.stringify({
    nodeId: String(nodeId),
    bandIndex: input.bandIndex,
    zBase: band.zBase,
    sourceKey: input.sourceKey,
    adminLevel: input.adminLevel,
    tileIdCount: tileIds.length,
    tileIdSample: tileIds.slice(0, 5),
  }));
  if (tileIds.length > 0) {
    const createdAt = Date.now();
    const cacheTimestamp = createdAt;
    const relations = tileIds.map((tileId) => ({
      id: `${nodeId}:${input.bandIndex}:${tileId}:${cacheId}`,
      nodeId,
      bandIndex: input.bandIndex,
      tileId: String(tileId),
      bufferId: cacheId,
      featureCount: relationFeatureCount,
      cacheTimestamp,
      createdAt,
    }));
    try {
      await withTimeout({
        taskId,
        operation: 'tile-index:rebuild-relations',
        timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
        promise: ephemeralDB.transaction('rw', [
          ephemeralDB.tileEmitBufferRelations,
        ], async () => {
          await ephemeralDB.tileEmitBufferRelations.where('bufferId').equals(cacheId).delete();
          await ephemeralDB.tileEmitBufferRelations.bulkPut(relations);
        }),
      });
    } catch (storageError) {
      const reason = storageError instanceof Error ? storageError.message : String(storageError);
      throw new Error(`geometry failed: tile index relation write failed (taskId=${taskId}, reason=${reason})`);
    }
  }

  if (persistGeometryCacheMetadata) {
    await persistGeometryCacheMetadata(resultMetadata).catch((error) => {
      console.error('[ShapeGeometry] failed to persist completed geometry cache metadata', {
        taskId,
        nodeId,
        error,
      });
    });
  }

  return {
    status: 'completed',
    progress: 100,
    display: {
      kind: 'summary',
      key: 'stage.taskSummary.metrics',
      metrics: {
        features: { input: inputFeatureCount, output: simplifiedFeatureCount },
        polygons: { input: inputPolygonCount, output: simplifiedPolygonCount },
        vertices: { input: inputVertexCount, output: simplifiedVertexCount },
      },
    },
    outputData: {
      processedPolygons: inputPolygonCount,
      totalPolygons: inputPolygonCount,
    },
    metadata: resultMetadata,
    taskUpdated: true,
  };
};
