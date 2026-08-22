import type { NodeId } from '@hierarchidb/core-types';
import type { EphemeralDB, EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';
import { logDebug } from '~/debug/persistentDebugLog';
import {
  TASKDEBUG_BUILD_TAG,
  TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
  TRANSFORM_DB_WRITE_TIMEOUT_MS,
  withTimeout,
} from './helpers/core.js';

type UpdateTaskStrict = (
  taskId: string,
  updates: Record<string, unknown>,
  operation: string
) => Promise<void>;

type GeometryCacheRecord = {
  id: string;
  nodeId: NodeId;
  bandIndex: number;
  domainType: EphemeralGeometryCacheRecord['domainType'];
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  extractionRatio: number;
  tolerance: number;
  metadata?: Record<string, unknown>;
};

type TransformCompletionMetrics = {
  features: { input: number; output: number };
  polygons: { input: number; output: number };
  vertices: { input: number; output: number };
};

type TransformCompletionOutputData = {
  processedPolygons: number;
  totalPolygons: number;
};

export const finalizeTransformByBandCache = async (params: {
  taskId: string;
  ephemeralDB: EphemeralDB;
  updateTaskStrict: UpdateTaskStrict;
  cacheRecord: GeometryCacheRecord;
  metrics: TransformCompletionMetrics;
  outputData: TransformCompletionOutputData;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  const completedAt = Date.now();
  if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
    const cloneFn = globalThis.structuredClone;
    const cloneText = typeof cloneFn === 'function' ? String(cloneFn) : '';
    console.info('[ShapeGeometry][TaskDebug] structuredClone probe', {
      tag: TASKDEBUG_BUILD_TAG,
      name: typeof cloneFn === 'function' ? cloneFn.name : null,
      type: typeof cloneFn,
      isNative: typeof cloneFn === 'function' ? cloneText.includes('[native code]') : null,
      preview: typeof cloneFn === 'function' ? cloneText.slice(0, 120) : null,
    });
  }

  const cacheStartedAt = Date.now();
  let cacheWaitLogged = false;
  const cacheWaitTimer = setTimeout(() => {
    cacheWaitLogged = true;
    logDebug('log', 'ShapeGeometry', 'geometry cache write waiting', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - cacheStartedAt,
    });
    void params
      .updateTaskStrict(
        params.taskId,
        {
          display: {
            kind: 'info',
            key: 'stage.taskWarning.cachePutSlow',
            params: {
              elapsedSeconds: Math.max(1, Math.floor((Date.now() - cacheStartedAt) / 1000)),
            },
          },
        },
        'cache-put:slow-warning'
      )
      .catch((error) => {
        console.error('[ShapeGeometry] failed to publish cache write warning', {
          taskId: params.taskId,
          error,
        });
      });
  }, 5000);

  try {
    const slowWriteLogId = setTimeout(() => {
      logDebug('log', 'ShapeGeometry', 'geometry cache write is still in progress', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - cacheStartedAt,
        thresholdMs: TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
      });
    }, TRANSFORM_CACHE_WRITE_SLOW_LOG_MS);

    try {
      await withTimeout({
        taskId: params.taskId,
        operation: 'cache-write:geometryCache.put',
        timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
        promise: params.ephemeralDB.transaction(
          'rw',
          [params.ephemeralDB.geometryCache, params.ephemeralDB.geometryCacheMeta],
          async () => {
            await params.ephemeralDB.geometryCache.put({
              ...params.cacheRecord,
              timestamp: completedAt,
            });
          }
        ),
      });
    } finally {
      clearTimeout(slowWriteLogId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `geometry failed: cache write failed (taskId=${params.taskId}, elapsedMs=${Date.now() - cacheStartedAt}, reason=${message})`
    );
  }

  clearTimeout(cacheWaitTimer);
  if (cacheWaitLogged) {
    logDebug('log', 'ShapeGeometry', 'geometry cache write done', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - cacheStartedAt,
    });
  }

  const taskStartedAt = Date.now();
  let taskWaitLogged = false;
  const taskWaitTimer = setTimeout(() => {
    taskWaitLogged = true;
    logDebug('log', 'ShapeGeometry', 'geometry task update waiting', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - taskStartedAt,
    });
  }, 5000);

  await params.updateTaskStrict(
    params.taskId,
    {
      status: 'completed',
      progress: 100,
      display: {
        kind: 'summary',
        key: 'stage.taskSummary.metrics',
        metrics: params.metrics,
      },
      metadata: params.metadata ?? params.cacheRecord.metadata,
      outputData: params.outputData,
      completedAt,
    },
    'task:complete'
  );

  clearTimeout(taskWaitTimer);
  if (taskWaitLogged) {
    logDebug('log', 'ShapeGeometry', 'geometry task update done', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - taskStartedAt,
    });
  }
};
