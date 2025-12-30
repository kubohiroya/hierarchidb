import type { ProgressInfo } from '../../../common/types/index.js';
import type { Simplify1Task, Simplify2Task } from '../../../common/types/index.js';
import type { Simplify1StageAdapter } from './Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './Simplify2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { applyFeatureFiltering, type FeatureFilterSettings, simplifyGeoJson } from '@hierarchidb/gis-sdk';
import { simplifyTopoJsonByTiles } from '../utils/topojsonSimplify.js';
import { assignFeatureIds } from '../utils/featureIds.js';
import { BatchService } from '@hierarchidb/batch';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature } from 'geojson';
import type { FeatureCollection } from 'geojson';

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

const formatErrorWithSource = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  const stack = error.stack ?? '';
  const line = stack.split('\n').find((entry) => entry.includes(':') && entry.includes('/') && entry.includes('at '));
  if (!line) return message;
  const match = line.match(/\((.+?):(\d+):(\d+)\)/) ?? line.match(/at (.+?):(\d+):(\d+)/);
  if (!match) return message;
  const [, file, lineNumber, column] = match;
  return `${message} (at ${file}:${lineNumber}:${column})`;
};

const isFeatureCollection = (value: unknown): value is FeatureCollection => (
  !!value
  && typeof value === 'object'
  && (value as FeatureCollection).type === 'FeatureCollection'
  && Array.isArray((value as FeatureCollection).features)
);

const encodeGeoJson = async (geojsonData: FeatureCollection): Promise<ArrayBuffer> => {
  const bytes = await geojsonApi.serialize(geojsonData);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const sanitizeFeatureCollection = (collection: FeatureCollection): FeatureCollection => ({
  ...collection,
  features: collection.features.filter(Boolean),
});

const SIMPLIFY1_SKIP_MESSAGE = 'Skipped: no features remain after filtering.';
const SIMPLIFY2_SKIP_MESSAGE = 'Skipped: no features remain after simplification.';

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const buildSimplify2CompletionMessage = (featureCount?: number, sizeBytes?: number): string | undefined => {
  const parts: string[] = [];
  if (typeof featureCount === 'number') {
    parts.push(`Features: ${featureCount}`);
  }
  if (typeof sizeBytes === 'number') {
    parts.push(`Size: ${formatBytes(sizeBytes)}`);
  }
  return parts.length > 0 ? `Completed (${parts.join(', ')})` : undefined;
};

const buildSimplify1CompletionMessage = (
  rawBytes?: number,
  simplifiedBytes?: number,
): string | undefined => {
  if (typeof rawBytes !== 'number' || typeof simplifiedBytes !== 'number' || rawBytes <= 0) {
    return undefined;
  }
  const ratio = (simplifiedBytes / rawBytes) * 100;
  return `Completed (Raw: ${formatBytes(rawBytes)}, Simplified: ${formatBytes(simplifiedBytes)}, Ratio: ${ratio.toFixed(1)}%)`;
};

export class LocalSimplify1Adapter implements Simplify1StageAdapter {
  async process(tasks: Simplify1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const processTask = async (task: Simplify1Task) => {
      let finished = false;
      while (!finished) {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
            continue;
          }
          return;
        }
        try {
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'running',
              startedAt: Date.now(),
              progress: 0,
            });
          }
          const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
          const raw = await db.rawBuffers.get(inputBufferId);
          if (!raw) {
            throw new Error(`Raw buffer not found: ${inputBufferId}`);
          }
          const taskIndex = task.index ?? 0;
          if (!raw.featureCount) {
            await db.simplifiedBuffers.put({
              id: `${task.nodeId ?? ''}-simplify1-${taskIndex}`,
              nodeId: raw.nodeId,
              stage: 'simplify1',
              data: raw.data,
              featureCount: 0,
              simplificationRatio: 0,
              tolerance: task.tolerance ?? task.config?.tolerance ?? 0,
              timestamp: Date.now(),
            });
            skipped += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: SIMPLIFY1_SKIP_MESSAGE,
              });
            }
            finished = true;
            break;
          }
          const geojson = await decodeGeoJson(raw.data);
          const filterSettings: FeatureFilterSettings = {
            minArea: task.minArea ?? task.config?.minimumArea ?? 0,
            featureFilterMethod: task.config?.featureFilterMethod,
            minVertexCountForAreaFilter: task.config?.minVertexCountForAreaFilter,
            hybridFilterConfig: task.config?.hybridFilterConfig,
          };
          const filtered = applyFeatureFiltering(geojson, filterSettings);
          const baseTolerance = task.config?.tolerance ?? task.tolerance ?? 0;
          const tolerance = Number.isFinite(baseTolerance) ? baseTolerance : 0;
          const outputBufferId = `${task.nodeId ?? ''}-simplify1-${taskIndex}`;
          const hasFilteredFeatures = isFeatureCollection(filtered);
          const sanitizedFiltered = hasFilteredFeatures
            ? sanitizeFeatureCollection(filtered)
            : null;
          const simplified = sanitizedFiltered
            ? simplifyGeoJson(sanitizedFiltered, { tolerance, perFeature: true })
            : filtered;
          const hasSimplifiedFeatures = isFeatureCollection(simplified);
          const sanitizedSimplified = hasSimplifiedFeatures
            ? sanitizeFeatureCollection(simplified)
            : null;
          if (sanitizedSimplified) {
            assignFeatureIds(sanitizedSimplified, {
              countryCode: task.countryCode,
              adminLevel: task.adminLevel,
            });
          }
          const featureCount = sanitizedSimplified
            ? sanitizedSimplified.features.length
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
            skipped += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: SIMPLIFY1_SKIP_MESSAGE,
              });
            }
            finished = true;
            break;
          }
          const data = sanitizedSimplified
            ? await encodeGeoJson(sanitizedSimplified)
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
            skipped += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: SIMPLIFY1_SKIP_MESSAGE,
              });
            }
            finished = true;
            break;
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
          completed++;
          if (task.taskId) {
            const completionMessage = buildSimplify1CompletionMessage(raw.data.byteLength, data.byteLength);
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'completed',
              completedAt: Date.now(),
              progress: 100,
              message: completionMessage,
            });
          }
          finished = true;
        } catch (error) {
          if (shouldAbort()) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
              continue;
            }
            return;
          }
          failed++;
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: formatErrorWithSource(error, 'Simplify stage 1 failed'),
            });
          }
          finished = true;
        }
      }
      if (shouldAbort()) {
        return;
      }
      const total = tasks.length;
      const done = completed + failed + skipped;
      onProgress({
        total,
        completed,
        failed,
        skipped,
        percentage: total > 0 ? (done / total) * 100 : 0,
        currentStage: 'simplify1',
        currentTask: task.taskId,
      });
    };
    await batch.mapChunks(tasks, processTask, { concurrency: maxConcurrent });
    return { processed: completed, failed };
  }
}

export class LocalSimplify2Adapter implements Simplify2StageAdapter {
  async process(tasks: Simplify2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const processTask = async (task: Simplify2Task) => {
      let finished = false;
      while (!finished) {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
            continue;
          }
          return;
        }
        try {
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'running',
              startedAt: Date.now(),
              progress: 0,
            });
          }
          const taskIndex = task.index ?? 0;
          const sourceTaskId = task.config?.sourceTaskId
            ?? `${task.nodeId ?? ''}-simplify1-${taskIndex}`;
          const simplify1Task = await shapeDB.batchTasks.get(sourceTaskId);
          if (simplify1Task?.status === 'failed') {
            failed++;
            if (task.taskId) {
              const simplify1TaskLabel = simplify1Task.taskId ?? sourceTaskId;
              const simplify1Reason = simplify1Task.errorMessage ?? 'unknown error';
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: `Simplify1 failed (${simplify1TaskLabel}): ${simplify1Reason}`,
              });
            }
            finished = true;
            continue;
          }
          const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
          const input = await db.simplifiedBuffers.get(inputBufferId)
            ?? await db.rawBuffers.get(inputBufferId);
          if (!input) {
            throw new Error(`Simplify2 input buffer not found: ${inputBufferId}`);
          }
          if (!input.featureCount) {
            const outputBufferId = `${task.nodeId ?? ''}-simplify2-${taskIndex}`;
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
            skipped += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: SIMPLIFY2_SKIP_MESSAGE,
                });
              }
            finished = true;
            break;
          }
          const geojson = await decodeGeoJson(input.data);
          const simplificationMode = task.config?.simplificationMode
            ?? (task.config?.preserveSharedBoundaries ? 'topojson' : 'geojson');
          if (simplificationMode === 'off') {
            const outputBufferId = `${task.nodeId ?? ''}-simplify2-${taskIndex}`;
            if (isFeatureCollection(geojson)) {
              const sanitized = sanitizeFeatureCollection(geojson);
              assignFeatureIds(sanitized, {
                countryCode: task.countryCode,
                adminLevel: task.adminLevel,
              });
              const data = await encodeGeoJson(sanitized);
              const featureCount = sanitized.features.length;
              await db.simplifiedBuffers.put({
                id: outputBufferId,
                nodeId: input.nodeId,
                stage: 'simplify2',
                data,
                featureCount,
                simplificationRatio: input.featureCount ? featureCount / input.featureCount : 1,
                tolerance: 0,
                timestamp: Date.now(),
              });
              completed++;
              if (task.taskId) {
                const completionMessage = buildSimplify2CompletionMessage(featureCount, data.byteLength);
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
                });
              }
            } else {
              await db.simplifiedBuffers.put({
                id: outputBufferId,
                nodeId: input.nodeId,
                stage: 'simplify2',
                data: input.data,
                featureCount: input.featureCount ?? 0,
                simplificationRatio: 1,
                tolerance: 0,
                timestamp: Date.now(),
              });
              completed++;
              if (task.taskId) {
                const completionMessage = buildSimplify2CompletionMessage(input.featureCount ?? 0, input.data.byteLength);
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
                });
              }
            }
            finished = true;
            break;
          }
          const baseTolerance = task.config?.tolerance ?? task.tolerance ?? 0;
          const retry = task.config?.retry ?? 0;
          const retryScale = retry > 0 ? 1 + retry * 2 : 1;
          const tolerance = baseTolerance * retryScale;
          const quantizeBase = task.config?.quantize;
          const quantize = typeof quantizeBase === 'number'
            ? Math.max(1, Math.round(quantizeBase / (1 + retry * 2)))
            : quantizeBase;
          const enablePerFeatureSimplification = task.config?.enablePerFeatureSimplification ?? true;
          let simplifiedPayload: unknown = geojson;
          let usedTopo = false;
          if (simplificationMode === 'topojson' && task.config?.preserveSharedBoundaries && isFeatureCollection(geojson)) {
            try {
              simplifiedPayload = simplifyTopoJsonByTiles(geojson, {
                tolerance,
                quantize,
                zoomLevels: task.zoomLevels,
              });
              usedTopo = true;
            } catch (error) {
              console.warn('[LocalSimplify2Adapter] TopoJSON simplify failed; falling back to per-feature', error);
            }
          }
          const simplified = usedTopo
            ? simplifiedPayload
            : simplifyGeoJson(geojson, {
              tolerance,
              perFeature: enablePerFeatureSimplification,
              quantize,
            });
          const hasSimplifiedFeatures = isFeatureCollection(simplified);
          const outputBufferId = `${task.nodeId ?? ''}-simplify2-${taskIndex}`;
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
            skipped += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: SIMPLIFY2_SKIP_MESSAGE,
                });
              }
            finished = true;
            break;
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
          completed++;
          if (task.taskId) {
            const completionMessage = buildSimplify2CompletionMessage(featureCount, data.byteLength);
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'completed',
              completedAt: Date.now(),
              progress: 100,
              message: completionMessage,
            });
          }
          finished = true;
        } catch (error) {
          if (shouldAbort()) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
              continue;
            }
            return;
          }
          failed++;
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: error instanceof Error ? error.message : 'Simplify stage 2 failed',
            });
          }
          finished = true;
        }
      }
      if (shouldAbort()) {
        return;
      }
      const total = tasks.length;
      const done = completed + failed + skipped;
      onProgress({
        total,
        completed,
        failed,
        skipped,
        percentage: total > 0 ? (done / total) * 100 : 0,
        currentStage: 'simplify2',
        currentTask: task.taskId,
      });
    };
    await batch.mapChunks(tasks, processTask, { concurrency: maxConcurrent });
    return { processed: completed, failed };
  }
}
