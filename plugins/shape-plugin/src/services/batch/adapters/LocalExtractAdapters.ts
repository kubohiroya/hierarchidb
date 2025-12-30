import type { ProgressInfo } from '../../../common/types/index.js';
import type { Extract1Task, Extract2Task, ExtractTaskInput } from '../../../common/types/index.js';
import type { Extract1StageAdapter } from './Extract1StageAdapter.js';
import type { Extract2StageAdapter } from './Extract2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { applyFeatureFiltering, type FeatureFilterSettings, extractGeoJson } from '@hierarchidb/gis-sdk';
import { extractTopoJsonByTiles } from '../utils/topojsonExtract.js';
import { assignFeatureIds, HDB_ORIGIN_KEY } from '../utils/featureIds.js';
import { resolveExtractStageSettings } from '../utils/resolveExtractSettings.js';
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
    const properties = (feature.properties ??= {}) as Record<string, unknown>;
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

const SIMPLIFY1_SKIP_MESSAGE = 'Skipped: no features remain after filtering.';
const SIMPLIFY2_SKIP_MESSAGE = 'Skipped: no features remain after extraction.';

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

const buildExtract2CompletionMessage = (featureCount?: number, sizeBytes?: number): string | undefined => {
  const parts: string[] = [];
  if (typeof featureCount === 'number') {
    parts.push(`Features: ${featureCount}`);
  }
  if (typeof sizeBytes === 'number') {
    parts.push(`Size: ${formatBytes(sizeBytes)}`);
  }
  return parts.length > 0 ? `Completed (${parts.join(', ')})` : undefined;
};

const buildExtract1CompletionMessage = (
  rawBytes?: number,
  extractedBytes?: number,
): string | undefined => {
  if (typeof rawBytes !== 'number' || typeof extractedBytes !== 'number' || rawBytes <= 0) {
    return undefined;
  }
  const ratio = (extractedBytes / rawBytes) * 100;
  return `Completed (Raw: ${formatBytes(rawBytes)}, Extracted: ${formatBytes(extractedBytes)}, Ratio: ${ratio.toFixed(1)}%)`;
};

export class LocalExtract1Adapter implements Extract1StageAdapter {
  async process(tasks: Extract1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const resolvedNodeId = tasks[0]?.nodeId ? String(tasks[0].nodeId) : null;
    const extractSettings = resolvedNodeId ? await resolveExtractStageSettings(resolvedNodeId) : null;
    if (!resolvedNodeId || !extractSettings) {
      throw new Error('Extract1 tasks require nodeId to resolve batch settings.');
    }
    const inputByTaskId = new Map<string, ExtractTaskInput>();
    if (resolvedNodeId) {
      const rows = await shapeDB.batchTasks
        .where('nodeId')
        .equals(resolvedNodeId)
        .and((row) => row.taskType === 'extract1')
        .toArray();
      rows.forEach((row) => {
        inputByTaskId.set(row.taskId, (row.inputData ?? {}) as ExtractTaskInput);
      });
    }
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const processTask = async (task: Extract1Task) => {
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
          const baseInput = inputByTaskId.get(task.taskId) ?? {};
          const input: ExtractTaskInput = { ...baseInput, ...extractSettings.extract1 };
          const inputBufferId = task.inputBufferId ?? input.inputBufferId ?? '';
          const raw = await db.rawBuffers.get(inputBufferId);
          if (!raw) {
            throw new Error(`Raw buffer not found: ${inputBufferId}`);
          }
          const taskIndex = task.index ?? 0;
          if (!raw.featureCount) {
            await db.extractedBuffers.put({
              id: `${task.nodeId ?? ''}-extract1-${taskIndex}`,
              nodeId: raw.nodeId,
              stage: 'extract1',
              data: raw.data,
              featureCount: 0,
              extractionRatio: 0,
              tolerance: input.tolerance ?? 0,
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
          const enableFeatureFiltering = input.enableFeatureFiltering ?? true;
          if (!enableFeatureFiltering) {
            const outputBufferId = `${task.nodeId ?? ''}-extract1-${taskIndex}`;
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
            completed++;
            if (task.taskId) {
              const completionMessage = buildExtract1CompletionMessage(raw.data.byteLength, raw.data.byteLength);
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: completionMessage,
              });
            }
            finished = true;
            break;
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
          const outputBufferId = `${task.nodeId ?? ''}-extract1-${taskIndex}`;
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
          completed++;
          if (task.taskId) {
            const completionMessage = buildExtract1CompletionMessage(raw.data.byteLength, data.byteLength);
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
              errorMessage: formatErrorWithSource(error, 'Extract stage 1 failed'),
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
        currentStage: 'extract1',
        currentTask: task.taskId,
      });
    };
    await batch.mapChunks(tasks, processTask, { concurrency: maxConcurrent });
    return { processed: completed, failed };
  }
}

export class LocalExtract2Adapter implements Extract2StageAdapter {
  async process(tasks: Extract2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const db = getEphemeralShapeDB();
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const resolvedNodeId = tasks[0]?.nodeId ? String(tasks[0].nodeId) : null;
    const extractSettings = resolvedNodeId ? await resolveExtractStageSettings(resolvedNodeId) : null;
    if (!resolvedNodeId || !extractSettings) {
      throw new Error('Extract2 tasks require nodeId to resolve batch settings.');
    }
    const inputByTaskId = new Map<string, ExtractTaskInput>();
    if (resolvedNodeId) {
      const rows = await shapeDB.batchTasks
        .where('nodeId')
        .equals(resolvedNodeId)
        .and((row) => row.taskType === 'extract2')
        .toArray();
      rows.forEach((row) => {
        inputByTaskId.set(row.taskId, (row.inputData ?? {}) as ExtractTaskInput);
      });
    }
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const processTask = async (task: Extract2Task) => {
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
          const baseInput = inputByTaskId.get(task.taskId) ?? {};
          const input: ExtractTaskInput = { ...baseInput, ...extractSettings.extract2 };
          const taskIndex = task.index ?? 0;
          const sourceTaskId = input.sourceTaskId
            ?? `${task.nodeId ?? ''}-extract1-${taskIndex}`;
          const extract1Task = await shapeDB.batchTasks.get(sourceTaskId);
          if (extract1Task?.status === 'failed') {
            failed++;
            if (task.taskId) {
              const extract1TaskLabel = extract1Task.taskId ?? sourceTaskId;
              const extract1Reason = extract1Task.errorMessage ?? 'unknown error';
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: `Extract1 failed (${extract1TaskLabel}): ${extract1Reason}`,
              });
            }
            finished = true;
            continue;
          }
          const inputBufferId = task.inputBufferId ?? input.inputBufferId ?? '';
          const input = await db.extractedBuffers.get(inputBufferId)
            ?? await db.rawBuffers.get(inputBufferId);
          if (!input) {
            throw new Error(`Extract2 input buffer not found: ${inputBufferId}`);
          }
          if (!input.featureCount) {
            const outputBufferId = `${task.nodeId ?? ''}-extract2-${taskIndex}`;
            const baseTolerance = input.tolerance ?? 0;
            const retry = input.retry ?? 0;
            const retryScale = retry > 0 ? 1 + retry * 2 : 1;
            const effectiveTolerance = baseTolerance * retryScale;
            await db.extractedBuffers.put({
              id: outputBufferId,
              nodeId: input.nodeId,
              stage: 'extract2',
              data: input.data,
              featureCount: 0,
              extractionRatio: 0,
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
          if (isFeatureCollection(geojson)) {
            const continent = input.continent;
            const countryName = input.countryName;
            const countryCode = task.countryCode;
            const adminCode = input.adminCode ?? input.featureGroupId;
            const origin = input.originKey;
            applyFeatureContext(geojson, {
              continent,
              countryName,
              countryCode,
              adminCode,
              originKey: origin,
            });
          }
          const extractionMode = input.extractionMode
            ?? (input.preserveSharedBoundaries ? 'topojson' : 'geojson');
          if (extractionMode === 'off') {
            const outputBufferId = `${task.nodeId ?? ''}-extract2-${taskIndex}`;
            if (isFeatureCollection(geojson)) {
              const sanitized = sanitizeFeatureCollection(geojson);
              assignFeatureIds(sanitized, {
                countryCode: task.countryCode,
                adminLevel: task.adminLevel,
              });
              const data = await encodeGeoJson(sanitized);
              const featureCount = sanitized.features.length;
              await db.extractedBuffers.put({
                id: outputBufferId,
                nodeId: input.nodeId,
                stage: 'extract2',
                data,
                featureCount,
                extractionRatio: input.featureCount ? featureCount / input.featureCount : 1,
                tolerance: 0,
                timestamp: Date.now(),
              });
              completed++;
              if (task.taskId) {
                const completionMessage = buildExtract2CompletionMessage(featureCount, data.byteLength);
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
                });
              }
            } else {
              await db.extractedBuffers.put({
                id: outputBufferId,
                nodeId: input.nodeId,
                stage: 'extract2',
                data: input.data,
                featureCount: input.featureCount ?? 0,
                extractionRatio: 1,
                tolerance: 0,
                timestamp: Date.now(),
              });
              completed++;
              if (task.taskId) {
                const completionMessage = buildExtract2CompletionMessage(input.featureCount ?? 0, input.data.byteLength);
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
          const baseTolerance = input.tolerance ?? 0;
          const retry = input.retry ?? 0;
          const retryScale = retry > 0 ? 1 + retry * 2 : 1;
          const tolerance = baseTolerance * retryScale;
          const quantizeBase = input.quantize;
          const quantize = typeof quantizeBase === 'number'
            ? Math.max(1, Math.round(quantizeBase / (1 + retry * 2)))
            : quantizeBase;
          const enablePerFeatureExtraction = input.enablePerFeatureExtraction ?? true;
          let extractedPayload: unknown = geojson;
          let usedTopo = false;
          if (extractionMode === 'topojson' && input.preserveSharedBoundaries && isFeatureCollection(geojson)) {
            try {
              extractedPayload = extractTopoJsonByTiles(geojson, {
                tolerance,
                quantize,
                zoomLevels: input.zoomLevels,
              });
              usedTopo = true;
            } catch (error) {
              console.warn('[LocalExtract2Adapter] TopoJSON extract failed; falling back to per-feature', error);
            }
          }
          const extracted = usedTopo
            ? extractedPayload
            : extractGeoJson(geojson, {
              tolerance,
              perFeature: enablePerFeatureExtraction,
              quantize,
            });
          const hasExtractedFeatures = isFeatureCollection(extracted);
          const outputBufferId = `${task.nodeId ?? ''}-extract2-${taskIndex}`;
          const sanitizedExtracted = hasExtractedFeatures
            ? sanitizeFeatureCollection(extracted)
            : null;
          const featureCount = sanitizedExtracted
            ? sanitizedExtracted.features.length
            : input.featureCount;
          if (sanitizedExtracted && featureCount === 0) {
            await db.extractedBuffers.put({
              id: outputBufferId,
              nodeId: input.nodeId,
              stage: 'extract2',
              data: input.data,
              featureCount: 0,
              extractionRatio: 0,
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
          const data = sanitizedExtracted
            ? await encodeGeoJson(sanitizedExtracted)
            : input.data;
          await db.extractedBuffers.put({
            id: outputBufferId,
            nodeId: input.nodeId,
            stage: 'extract2',
            data,
            featureCount,
            extractionRatio: input.featureCount ? featureCount / input.featureCount : 1,
            tolerance,
            timestamp: Date.now(),
          });
          completed++;
          if (task.taskId) {
            const completionMessage = buildExtract2CompletionMessage(featureCount, data.byteLength);
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
              errorMessage: error instanceof Error ? error.message : 'Extract stage 2 failed',
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
        currentStage: 'extract2',
        currentTask: task.taskId,
      });
    };
    await batch.mapChunks(tasks, processTask, { concurrency: maxConcurrent });
    return { processed: completed, failed };
  }
}
