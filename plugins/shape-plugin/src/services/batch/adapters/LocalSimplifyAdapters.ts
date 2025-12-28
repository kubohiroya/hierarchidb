import type { ProgressInfo } from '../../../common/types/index.js';
import type { Simplify1Task, Simplify2Task } from '../../../common/types/index.js';
import type { Simplify1StageAdapter } from './Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './Simplify2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { applyFeatureFiltering, type FeatureFilterSettings, simplifyGeoJson } from '@hierarchidb/gis-sdk';
import { BatchService } from '@hierarchidb/batch';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature } from 'geojson';
import type { FeatureCollection } from 'geojson';

const decodeGeoJson = async (buffer: ArrayBuffer): Promise<unknown> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return {
      type: 'FeatureCollection',
      features,
    };
  }
  return decoded;
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
              id: `${task.sessionId ?? ''}-simplify1-${taskIndex}`,
              sessionId: String(task.sessionId ?? ''),
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
          const outputBufferId = `${task.sessionId ?? ''}-simplify1-${taskIndex}`;
          const hasFilteredFeatures = isFeatureCollection(filtered);
          const data = hasFilteredFeatures ? await encodeGeoJson(filtered) : raw.data;
          const featureCount = hasFilteredFeatures
            ? filtered.features.length
            : raw.featureCount;
          if (!featureCount) {
            await db.simplifiedBuffers.put({
              id: outputBufferId,
              sessionId: String(task.sessionId ?? ''),
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
              });
            }
            finished = true;
            break;
          }
          await db.simplifiedBuffers.put({
            id: outputBufferId,
            sessionId: String(task.sessionId ?? ''),
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
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'completed',
              completedAt: Date.now(),
              progress: 100,
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
              errorMessage: error instanceof Error ? error.message : 'Simplify stage 1 failed',
            });
          }
          finished = true;
        }
      }
      if (shouldAbort()) {
        return;
      }
      const effectiveTotal = Math.max(0, tasks.length - skipped);
      onProgress({
        total: effectiveTotal,
        completed,
        failed,
        skipped,
        percentage: effectiveTotal > 0 ? (completed / effectiveTotal) * 100 : 100,
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
          const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
          const input = await db.simplifiedBuffers.get(inputBufferId)
            ?? await db.rawBuffers.get(inputBufferId);
          if (!input) {
            throw new Error(`Simplify2 input buffer not found: ${inputBufferId}`);
          }
          const taskIndex = task.index ?? 0;
          if (!input.featureCount) {
            const outputBufferId = `${task.sessionId ?? ''}-simplify2-${taskIndex}`;
            await db.simplifiedBuffers.put({
              id: outputBufferId,
              sessionId: String(task.sessionId ?? ''),
              nodeId: input.nodeId,
              stage: 'simplify2',
              data: input.data,
              featureCount: 0,
              simplificationRatio: 0,
              tolerance: task.config?.tolerance ?? task.tolerance ?? 0,
              timestamp: Date.now(),
            });
            skipped += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
              });
            }
            finished = true;
            break;
          }
          const geojson = await decodeGeoJson(input.data);
          const tolerance = task.config?.tolerance ?? task.tolerance ?? 0;
          const quantize = task.config?.quantize;
          const enablePerFeatureSimplification = task.config?.enablePerFeatureSimplification ?? true;
          const simplified = simplifyGeoJson(geojson, {
            tolerance,
            perFeature: enablePerFeatureSimplification,
            quantize,
          });
          const hasSimplifiedFeatures = isFeatureCollection(simplified);
          const outputBufferId = `${task.sessionId ?? ''}-simplify2-${taskIndex}`;
          const data = hasSimplifiedFeatures ? await encodeGeoJson(simplified) : input.data;
          const featureCount = hasSimplifiedFeatures
            ? simplified.features.length
            : input.featureCount;
          await db.simplifiedBuffers.put({
            id: outputBufferId,
            sessionId: String(task.sessionId ?? ''),
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
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'completed',
              completedAt: Date.now(),
              progress: 100,
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
      const effectiveTotal = Math.max(0, tasks.length - skipped);
      onProgress({
        total: effectiveTotal,
        completed,
        failed,
        skipped,
        percentage: effectiveTotal > 0 ? (completed / effectiveTotal) * 100 : 100,
        currentStage: 'simplify2',
        currentTask: task.taskId,
      });
    };
    await batch.mapChunks(tasks, processTask, { concurrency: maxConcurrent });
    return { processed: completed, failed };
  }
}
