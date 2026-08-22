import type { NodeId } from '@hierarchidb/core-types';
import type { EphemeralDB, EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';
import { logDebug } from '~/debug/persistentDebugLog';
import {
  TASKDEBUG_BUILD_TAG,
  TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
  TRANSFORM_DB_WRITE_TIMEOUT_MS,
  withTimeout,
} from './helpers/core.js';

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
};

export const finalizeGeometryStageCache = async (params: {
  taskId: string;
  ephemeralDB: EphemeralDB;
  cacheRecord: GeometryCacheRecord;
  abortSignal?: AbortSignal;
}): Promise<void> => {
  const completedAt = Date.now();

  // Note: Cache write validation is handled at the application layer
  // This function focuses on the actual cache write operation

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
      durationMs: Date.now() - cacheStartedAt,
    });
  }, 5000);

  try {
    const slowWriteLogId = setTimeout(() => {
      logDebug('log', 'ShapeGeometry', 'geometry cache write is still in progress', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        durationMs: Date.now() - cacheStartedAt,
        thresholdMs: TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
      });
    }, TRANSFORM_CACHE_WRITE_SLOW_LOG_MS);

    try {
      if (params.abortSignal?.aborted) {
        throw new DOMException('Geometry cache write was aborted', 'AbortError');
      }
      await withTimeout({
        taskId: params.taskId,
        operation: 'cache-write:geometryCache.put',
        timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
        promise: params.ephemeralDB.transaction(
          'rw',
          [params.ephemeralDB.geometryCache, params.ephemeralDB.geometryCacheMeta],
          async () => {
            if (params.abortSignal?.aborted) {
              throw new DOMException('Geometry cache write was aborted', 'AbortError');
            }
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
      `geometry failed: cache write failed (taskId=${params.taskId}, durationMs=${Date.now() - cacheStartedAt}, reason=${message})`
    );
  }

  clearTimeout(cacheWaitTimer);
  if (cacheWaitLogged) {
    logDebug('log', 'ShapeGeometry', 'geometry cache write done', {
      tag: TASKDEBUG_BUILD_TAG,
      taskId: params.taskId,
      durationMs: Date.now() - cacheStartedAt,
    });
  }
};
