import type { NodeId } from '@hierarchidb/core-types';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import { logDebug } from '~/debug/persistentDebugLog';
import { TASKDEBUG_BUILD_TAG, TRANSFORM_CACHE_WRITE_SLOW_LOG_MS, TRANSFORM_DB_WRITE_TIMEOUT_MS, withTimeout } from './helpers.js';

type UpdateTaskStrict = (taskId: string, updates: Record<string, unknown>, operation: string) => Promise<void>;

type TransformCacheRecord = {
  id: string;
  nodeId: NodeId;
  bandIndex: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  extractionRatio: number;
  tolerance: number;
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
  cacheRecord: TransformCacheRecord;
  metrics: TransformCompletionMetrics;
  outputData: TransformCompletionOutputData;
}): Promise<void> => {
  const completedAt = Date.now();
  if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
    const cloneFn = globalThis.structuredClone;
    const cloneText = typeof cloneFn === 'function' ? String(cloneFn) : '';
    console.info('[ShapeTransform][TaskDebug] structuredClone probe', {
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
    logDebug('log', 'ShapeTransform', 'transform cache write waiting', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - cacheStartedAt,
    });
    void params.updateTaskStrict(params.taskId, {
      display: {
        kind: 'info',
        key: 'stage.taskWarning.cachePutSlow',
        params: {
          elapsedSeconds: Math.max(1, Math.floor((Date.now() - cacheStartedAt) / 1000)),
        },
      },
    }, 'cache-put:slow-warning').catch((error) => {
      console.error('[ShapeTransform] failed to publish cache write warning', {
        taskId: params.taskId,
        error,
      });
    });
  }, 5000);

  try {
    const slowWriteLogId = setTimeout(() => {
      logDebug('log', 'ShapeTransform', 'transform cache write is still in progress', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - cacheStartedAt,
        thresholdMs: TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
      });
    }, TRANSFORM_CACHE_WRITE_SLOW_LOG_MS);

    try {
      await withTimeout({
        taskId: params.taskId,
        operation: 'cache-write:transformCache.put',
        timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
        promise: params.ephemeralDB.transaction('rw', [
          params.ephemeralDB.transformCache,
          params.ephemeralDB.transformCacheMeta,
        ], async () => {
          await params.ephemeralDB.transformCache.put({
            ...params.cacheRecord,
            timestamp: completedAt,
          });
        }),
      });
    } finally {
      clearTimeout(slowWriteLogId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `transform failed: cache write failed (taskId=${params.taskId}, elapsedMs=${Date.now() - cacheStartedAt}, reason=${message})`
    );
  }

  clearTimeout(cacheWaitTimer);
  if (cacheWaitLogged) {
    logDebug('log', 'ShapeTransform', 'transform cache write done', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - cacheStartedAt,
    });
  }

  const taskStartedAt = Date.now();
  let taskWaitLogged = false;
  const taskWaitTimer = setTimeout(() => {
    taskWaitLogged = true;
    logDebug('log', 'ShapeTransform', 'transform task update waiting', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - taskStartedAt,
    });
  }, 5000);

  await params.updateTaskStrict(params.taskId, {
    status: 'completed',
    progress: 100,
    display: {
      kind: 'summary',
      key: 'stage.taskSummary.metrics',
      metrics: params.metrics,
    },
    outputData: params.outputData,
    completedAt,
  }, 'task:complete');

  clearTimeout(taskWaitTimer);
  if (taskWaitLogged) {
    logDebug('log', 'ShapeTransform', 'transform task update done', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      elapsedMs: Date.now() - taskStartedAt,
    });
  }
};
