import type { ProgressInfo, Extract1Task, Extract2Task, ExtractTaskInput } from '../../../common/types/index.js';
import type { Extract1StageAdapter } from './Extract1StageAdapter.js';
import type { Extract2StageAdapter } from './Extract2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import {
  type Extract1TaskInputData,
  type Extract1TaskOutputData,
  type Extract2TaskInputData,
  type Extract2TaskOutputData,
} from '../../database/ShapeDB.js';
import { getShapeDbApiClient } from '../ShapeBatchApiClient.js';
import { readDownloadBuffer } from '../../utils/chunkStore.js';
import { BatchService } from '@hierarchidb/batch';
import { ShapeWorkerPool } from './ShapeWorkerPool.js';
import { resolveExtractStageSettings } from '../utils/resolveExtractSettings.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature } from 'geojson';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const requireNodeId = (value: Extract1Task['nodeId'] | Extract2Task['nodeId']): NonNullable<typeof value> => {
  if (!value) {
    throw new Error('Task nodeId is required');
  }
  return value;
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

const countFeaturesInFlatGeobuf = async (buffer: ArrayBuffer): Promise<number> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    let count = 0;
    for await (const feature of decoded as AsyncIterable<Feature>) {
      if (feature) count += 1;
    }
    return count;
  }
  const collection = decoded as { type?: string; features?: unknown[] } | null;
  if (collection?.type === 'FeatureCollection' && Array.isArray(collection.features)) {
    return collection.features.filter(Boolean).length;
  }
  return 0;
};

export class ShapeWorkerExtract1Adapter implements Extract1StageAdapter {
  async process(tasks: Extract1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const resolvedNodeId = tasks[0]?.nodeId ? requireNodeId(tasks[0].nodeId) : null;
    const extractSettings = resolvedNodeId ? await resolveExtractStageSettings(resolvedNodeId) : null;
    if (!resolvedNodeId || !extractSettings) {
      throw new Error('Extract1 tasks require nodeId to resolve batch settings.');
    }
    const inputByTaskId = new Map<string, Extract1TaskInputData>();
    if (resolvedNodeId) {
      const rows = await getShapeDbApiClient().ephemeral.listBatchTasksByType(resolvedNodeId, 'extract1');
      rows.forEach((row) => {
        inputByTaskId.set(row.taskId, (row.inputData ?? {}) as Extract1TaskInputData);
      });
    }
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    try {
      await batch.mapChunks(tasks, async (task, index) => {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          return;
        }
        if (task.taskId) {
          await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
            status: 'running',
            startedAt: Date.now(),
            progress: 0,
          });
        }
        try {
          const taskIndex = task.index ?? index;
          const resolvedNodeId = requireNodeId(task.nodeId);
          const baseInput = inputByTaskId.get(task.taskId) ?? {};
          const input: ExtractTaskInput = { ...baseInput, ...extractSettings.extract1 };
          const result = await workerPool.run((api) => api.processExtract1Task({
            nodeId: resolvedNodeId,
            task,
            taskIndex,
            input,
          }));
          if (result.status === 'failed') {
            failed += 1;
            if (task.taskId) {
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: result.errorMessage ?? 'Extract stage 1 failed',
              });
            }
          } else if (result.status === 'skipped') {
            skipped += 1;
            if (task.taskId) {
              const outputBufferId = `${String(resolvedNodeId)}-extract1-${taskIndex}`;
              const outputData: Extract1TaskOutputData = {
                outputBufferId,
                featureCount: 0,
                extractionRatio: 0,
              };
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: SIMPLIFY1_SKIP_MESSAGE,
                outputData,
              });
              console.log('[ShapeExtract1] Task skipped', {
                taskId: task.taskId,
                reason: SIMPLIFY1_SKIP_MESSAGE,
              });
            }
          } else {
            completed += 1;
            if (task.taskId) {
              const inputBufferId = input.inputBufferId ?? '';
              const outputBufferId = `${String(resolvedNodeId)}-extract1-${taskIndex}`;
              const ephemeral = getShapeDbApiClient().ephemeral;
              const rawBuffer = await readDownloadBuffer(requireNodeId(resolvedNodeId), inputBufferId);
              const output = await ephemeral.getExtractedBuffer(outputBufferId);
              const rawFeatureCount = rawBuffer ? await countFeaturesInFlatGeobuf(rawBuffer) : 0;
              const completionMessage = buildExtract1CompletionMessage(
                rawBuffer?.byteLength,
                output?.data.byteLength,
              );
              const featureCount = output?.featureCount ?? 0;
              const extractionRatio = rawFeatureCount > 0 ? featureCount / rawFeatureCount : 1;
              const outputData: Extract1TaskOutputData = {
                outputBufferId,
                featureCount,
                extractionRatio,
              };
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: completionMessage,
                outputData,
              });
            }
          }
        } catch (error) {
          if (shouldAbort() || isAbortError(error)) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
            }
            return;
          }
          failed += 1;
          if (task.taskId) {
            await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: formatErrorWithSource(error, 'Extract stage 1 failed'),
            });
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
      }, { concurrency: workerPool.size });
    } finally {
      await workerPool.shutdown();
    }
    return { processed: completed, failed, skipped };
  }
}

export class ShapeWorkerExtract2Adapter implements Extract2StageAdapter {
  async process(tasks: Extract2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const resolvedNodeId = tasks[0]?.nodeId ? requireNodeId(tasks[0].nodeId) : null;
    const extractSettings = resolvedNodeId ? await resolveExtractStageSettings(resolvedNodeId) : null;
    if (!resolvedNodeId || !extractSettings) {
      throw new Error('Extract2 tasks require nodeId to resolve batch settings.');
    }
    const inputByTaskId = new Map<string, Extract2TaskInputData>();
    const outputByTaskId = new Map<string, Extract2TaskOutputData>();
    if (resolvedNodeId) {
      const rows = await getShapeDbApiClient().ephemeral.listBatchTasksByType(resolvedNodeId, 'extract2');
      rows.forEach((row) => {
        inputByTaskId.set(row.taskId, (row.inputData ?? {}) as Extract2TaskInputData);
        outputByTaskId.set(row.taskId, (row.outputData ?? {}) as Extract2TaskOutputData);
      });
    }
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    try {
      await batch.mapChunks(tasks, async (task, index) => {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          return;
        }
        if (task.taskId) {
          await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
            status: 'running',
            startedAt: Date.now(),
            progress: 0,
          });
        }
        try {
          const taskIndex = task.index ?? index;
          const resolvedNodeId = requireNodeId(task.nodeId);
          const baseInput = inputByTaskId.get(task.taskId) ?? {};
          const baseOutput = outputByTaskId.get(task.taskId) ?? {};
          const input: ExtractTaskInput = { ...extractSettings.extract2, ...baseInput, retry: baseOutput.retry };
          const sourceTaskId = input.sourceTaskId
            ?? `${String(resolvedNodeId)}-extract1-${taskIndex}`;
          const extract1Task = await getShapeDbApiClient().ephemeral.getBatchTask(sourceTaskId);
          if (extract1Task?.status === 'failed') {
            failed += 1;
            if (task.taskId) {
              const extract1TaskLabel = extract1Task.taskId ?? sourceTaskId;
              const extract1Reason = extract1Task.errorMessage ?? 'unknown error';
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: `Extract1 failed (${extract1TaskLabel}): ${extract1Reason}`,
              });
            }
          } else {
            const result = await workerPool.run((api) => api.processExtract2Task({
              nodeId: resolvedNodeId,
              task,
              taskIndex,
              input,
            }));
            if (result.status === 'failed') {
              failed += 1;
              if (task.taskId) {
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'failed',
                  completedAt: Date.now(),
                  progress: 100,
                  errorMessage: result.errorMessage ?? 'Extract stage 2 failed',
                });
              }
            } else if (result.status === 'skipped') {
              skipped += 1;
              if (task.taskId) {
                const outputBufferId = `${String(resolvedNodeId)}-extract2-${taskIndex}`;
                const outputData: Extract2TaskOutputData = {
                  outputBufferId,
                  featureCount: 0,
                  extractionRatio: 0,
                  retry: input.retry,
                };
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: SIMPLIFY2_SKIP_MESSAGE,
                  outputData,
                });
              }
            } else {
              completed += 1;
              if (task.taskId) {
                const outputBufferId = `${String(resolvedNodeId)}-extract2-${taskIndex}`;
                const ephemeral = getShapeDbApiClient().ephemeral;
                const output = await ephemeral.getExtractedBuffer(outputBufferId);
                const completionMessage = output
                  ? buildExtract2CompletionMessage(output.featureCount, output.data.byteLength)
                  : undefined;
                const outputData: Extract2TaskOutputData = {
                  outputBufferId,
                  featureCount: output?.featureCount ?? 0,
                  extractionRatio: output?.extractionRatio,
                  retry: input.retry,
                };
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
                  outputData,
                });
              }
            }
          }
        } catch (error) {
          if (shouldAbort() || isAbortError(error)) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
            }
            return;
          }
          failed += 1;
          if (task.taskId) {
            await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: error instanceof Error ? error.message : 'Extract stage 2 failed',
            });
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
      }, { concurrency: workerPool.size });
    } finally {
      await workerPool.shutdown();
    }
    return { processed: completed, failed };
  }
}
