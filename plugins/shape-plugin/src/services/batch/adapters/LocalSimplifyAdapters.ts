import type { ProgressInfo } from '../../../common/types/index.js';
import type { Simplify1Task, Simplify2Task } from '../../../common/types/index.js';
import type { Simplify1StageAdapter } from './Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './Simplify2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { applyFeatureFiltering, type FeatureFilterSettings } from '../utils/featureFiltering.js';
import { simplifyGeoJson } from '../utils/geometrySimplify.js';
import { deserialize, serialize } from 'flatgeobuf/lib/mjs/geojson';
import type { Feature } from 'geojson';

const decodeGeoJson = async (buffer: ArrayBuffer): Promise<unknown> => {
  const decoded = deserialize(new Uint8Array(buffer));
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

const encodeGeoJson = async (geojson: unknown): Promise<ArrayBuffer> => {
  const bytes = await serialize(geojson);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

export class LocalSimplify1Adapter implements Simplify1StageAdapter {
  async process(tasks: Simplify1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    let completed = 0;
    let failed = 0;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
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
        const geojson = await decodeGeoJson(raw.data);
        const filterSettings: FeatureFilterSettings = {
          minArea: task.minArea ?? task.config?.minimumArea ?? 0,
          featureFilterMethod: task.config?.featureFilterMethod,
          minVertexCountForAreaFilter: task.config?.minVertexCountForAreaFilter,
          hybridFilterConfig: task.config?.hybridFilterConfig,
        };
        const filtered = applyFeatureFiltering(geojson, filterSettings);
        const outputBufferId = `${task.sessionId ?? ''}-simplify1-${task.index ?? completed}`;
        const hasFilteredFeatures = Boolean(
          filtered
          && typeof filtered === 'object'
          && Array.isArray((filtered as { features?: unknown[] }).features),
        );
        const data = hasFilteredFeatures ? await encodeGeoJson(filtered) : raw.data;
        const featureCount = hasFilteredFeatures
          ? (filtered as { features: unknown[] }).features.length
          : raw.featureCount;
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
      } catch (error) {
        failed++;
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'failed',
            completedAt: Date.now(),
            progress: 100,
            errorMessage: error instanceof Error ? error.message : 'Simplify stage 1 failed',
          });
        }
      }
      onProgress({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
        currentStage: 'simplify1',
        currentTask: task.taskId,
      });
    }
    return { processed: completed, failed };
  }
}

export class LocalSimplify2Adapter implements Simplify2StageAdapter {
  async process(tasks: Simplify2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    let completed = 0;
    let failed = 0;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
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
        const geojson = await decodeGeoJson(input.data);
        const tolerance = task.config?.tolerance ?? task.tolerance ?? 0;
        const quantize = task.config?.quantize;
        const enablePerFeatureSimplification = task.config?.enablePerFeatureSimplification ?? true;
        const simplified = simplifyGeoJson(geojson, {
          tolerance,
          perFeature: enablePerFeatureSimplification,
          quantize,
        });
        const hasSimplifiedFeatures = Boolean(
          simplified
          && typeof simplified === 'object'
          && Array.isArray((simplified as { features?: unknown[] }).features),
        );
        const outputBufferId = `${task.sessionId ?? ''}-simplify2-${task.index ?? completed}`;
        const data = hasSimplifiedFeatures ? await encodeGeoJson(simplified) : input.data;
        const featureCount = hasSimplifiedFeatures
          ? (simplified as { features: unknown[] }).features.length
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
      } catch (error) {
        failed++;
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'failed',
            completedAt: Date.now(),
            progress: 100,
            errorMessage: error instanceof Error ? error.message : 'Simplify stage 2 failed',
          });
        }
      }
      onProgress({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
        currentStage: 'simplify2',
        currentTask: task.taskId,
      });
    }
    return { processed: completed, failed };
  }
}
