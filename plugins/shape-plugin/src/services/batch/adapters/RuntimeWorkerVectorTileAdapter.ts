import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { type VectorTileTaskInputData, type VectorTileTaskOutputData } from '../../database/ShapeDB.js';
import { getShapeDbApiClient } from '../ShapeBatchApiClient.js';
import { geojson } from 'flatgeobuf';
import type { Feature, FeatureCollection } from 'geojson';
import { BatchService } from '@hierarchidb/batch';
import { createStageWorkerClient, getStageWorkerProxy, runVectorTileStage } from '@hierarchidb/runtime-worker';
import { encodeFlatGeobufFromFeatureCollection, type VectorTileProgress } from '@hierarchidb/gis-sdk';
import { assembleTileGeoJSON } from '../session/tiles/assembleTileGeoJSON.js';
import type { NodeId } from '@hierarchidb/common-types';
import { readDownloadBuffer } from '../../utils/chunkStore.js';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const MAX_VECTOR_TILE_INPUT_BYTES = 100 * 1024 * 1024;

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  clearFeatureCache(nodeId: NodeId): void {
    void nodeId;
  }

  private async listBufferIdsForTile(nodeId: NodeId, tileId: string): Promise<string[]> {
    const rows = await getShapeDbApiClient().ephemeral.listTileIdRelationsByTileId(nodeId, tileId);
    if (!rows.length) return [];
    return Array.from(new Set(rows.map((row) => row.bufferId)));
  }

  private async loadExtract2Collection(bufferId: string): Promise<FeatureCollection | null> {
    const input = await getShapeDbApiClient().ephemeral.getExtractedBuffer(bufferId);
    if (!input) return null;
    const decoded = await this.decodeGeoJson(input.data);
    if (decoded && typeof decoded === 'object' && (decoded as FeatureCollection).type === 'FeatureCollection') {
      return decoded as FeatureCollection;
    }
    return null;
  }
  private async decodeGeoJson(buffer: ArrayBuffer): Promise<unknown> {
    const decoded = geojson.deserialize(new Uint8Array(buffer));
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
  }

  private async buildGeoJsonBuffer(nodeId: NodeId, inputBufferId: string): Promise<ArrayBuffer> {
    const ephemeral = getShapeDbApiClient().ephemeral;
    const input = await ephemeral.getExtractedBuffer(inputBufferId);
    const rawBuffer = input ? null : await readDownloadBuffer(nodeId, inputBufferId);
    if (!input && !rawBuffer) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    const geojsonPayload = await this.decodeGeoJson(input?.data ?? (rawBuffer as ArrayBuffer));
    const text = JSON.stringify(geojsonPayload);
    return new TextEncoder().encode(text).buffer;
  }

  private async buildFlatGeobufBuffer(nodeId: NodeId, inputBufferId: string): Promise<ArrayBuffer> {
    const ephemeral = getShapeDbApiClient().ephemeral;
    const input = await ephemeral.getExtractedBuffer(inputBufferId);
    if (input) return input.data;
    const rawBuffer = await readDownloadBuffer(nodeId, inputBufferId);
    if (!rawBuffer) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    return rawBuffer;
  }

  private async buildVectorTileInputBuffer(
    nodeId: NodeId,
    inputBufferId: string,
    inputFormat: 'geojson' | 'flatgeobuf',
  ): Promise<ArrayBuffer> {
    if (inputFormat === 'flatgeobuf') {
      return this.buildFlatGeobufBuffer(nodeId, inputBufferId);
    }
    return this.buildGeoJsonBuffer(nodeId, inputBufferId);
  }

  private async encodeVectorTileFeatures(
    features: Feature[],
    inputFormat: 'geojson' | 'flatgeobuf',
  ): Promise<ArrayBuffer> {
    if (inputFormat === 'flatgeobuf') {
      return encodeFlatGeobufFromFeatureCollection({ type: 'FeatureCollection', features });
    }
    const text = JSON.stringify({ type: 'FeatureCollection', features });
    return new TextEncoder().encode(text).buffer;
  }

  private async resolveInputByteLength(nodeId: NodeId, inputBufferId: string): Promise<number | null> {
    const ephemeral = getShapeDbApiClient().ephemeral;
    const input = await ephemeral.getExtractedBuffer(inputBufferId);
    if (input) return input.data.byteLength;
    const rawBuffer = await readDownloadBuffer(nodeId, inputBufferId);
    return rawBuffer ? rawBuffer.byteLength : null;
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) return 'unknown size';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  private formatTileId(z: number, x: number, y: number): string {
    return `z${z}/${x}/${y}`;
  }

  private buildCompletionMessage(featureCount?: number | null, sizeBytes?: number | null): string | undefined {
    const parts: string[] = [];
    if (typeof featureCount === 'number') {
      parts.push(`Features: ${featureCount}`);
    }
    if (typeof sizeBytes === 'number') {
      parts.push(`Size: ${this.formatBytes(sizeBytes)}`);
    }
    return parts.length > 0 ? `Completed (${parts.join(', ')})` : undefined;
  }

  async process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const resolvedNodeId = tasks[0]?.nodeId ?? null;
    if (!resolvedNodeId) {
      throw new Error('Vector tile tasks require nodeId to resolve download buffers.');
    }
    const inputByTaskId = new Map<string, VectorTileTaskInputData>();
    const outputByTaskId = new Map<string, Partial<VectorTileTaskOutputData>>();
    const rows = await getShapeDbApiClient().ephemeral.listBatchTasksByType(resolvedNodeId, 'vectortile');
    rows.forEach((row) => {
      const inputData = row.inputData as VectorTileTaskInputData | undefined;
      if (!inputData) {
        throw new Error(`Vector tile input data is missing for task ${row.taskId}.`);
      }
      inputByTaskId.set(row.taskId, inputData);
      if (row.outputData) {
        outputByTaskId.set(row.taskId, row.outputData as Partial<VectorTileTaskOutputData>);
      }
    });
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    const clients = await Promise.all(
      Array.from({ length: maxConcurrent }, () => createStageWorkerClient()),
    );
    let nextClientIndex = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const metadataReplaceRef = { value: true };
    const tasksByInput = new Map<string, VectorTileTask[]>();
    for (const task of tasks) {
      const input = inputByTaskId.get(task.taskId);
      if (!input) {
        throw new Error(`Vector tile input is missing for task ${task.taskId}.`);
      }
      const inputBufferId = input.inputBufferId;
      if (!tasksByInput.has(inputBufferId)) {
        tasksByInput.set(inputBufferId, []);
      }
      tasksByInput.get(inputBufferId)?.push(task);
    }
    try {
      const processInputTasks = async ([inputBufferId, inputTasks]: [string, VectorTileTask[]]) => {
        const client = clients[nextClientIndex % clients.length];
        if (!client) {
          throw new Error('Vector tile worker client is unavailable');
        }
        nextClientIndex += 1;
        const vectorTileClient = client.vectortile;
        let finished = false;
        let abortKey: string | null = null;
        while (!finished) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          if (shouldAbort()) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
              continue;
            }
            return { processed: completed, failed };
          }
          const sample = inputTasks[0];
          if (!sample) {
            finished = true;
            continue;
          }
          const sampleInput = inputByTaskId.get(sample.taskId);
          if (!sampleInput) {
            throw new Error(`Vector tile input is missing for task ${sample.taskId}.`);
          }
          if (!inputBufferId) {
            throw new Error('Vector tile input bufferId is required.');
          }
          try {
          const isTileTask = (
            typeof sampleInput.tileZ === 'number'
            && typeof sampleInput.tileX === 'number'
            && typeof sampleInput.tileY === 'number'
          );
          if (!isTileTask) {
            const inputBytes = await this.resolveInputByteLength(resolvedNodeId, inputBufferId);
            if (typeof inputBytes === 'number' && inputBytes > MAX_VECTOR_TILE_INPUT_BYTES) {
              const message = `Vector tile input too large (${this.formatBytes(inputBytes)} > ${this.formatBytes(MAX_VECTOR_TILE_INPUT_BYTES)}).`;
                console.error('[VectorTile] Input size exceeds limit', {
                  inputBufferId,
                  inputBytes,
                  limitBytes: MAX_VECTOR_TILE_INPUT_BYTES,
                });
                for (const task of inputTasks) {
                  const taskOutput = outputByTaskId.get(task.taskId);
                  const currentRetry = typeof taskOutput?.retry === 'number' ? taskOutput.retry : 0;
                  const shouldRegress = currentRetry <= 1;
                  const nextRetry = currentRetry + 1;
                  if (!shouldRegress) {
                    failed += 1;
                  }
                  if (task.taskId) {
                    const updates: {
                      status: 'regression' | 'failed';
                      completedAt: number;
                      progress: number;
                      message: string;
                      errorMessage?: string;
                      outputData?: VectorTileTaskOutputData;
                    } = {
                      status: shouldRegress ? 'regression' : 'failed',
                      completedAt: Date.now(),
                      progress: 100,
                      message,
                      errorMessage: shouldRegress ? undefined : message,
                    };
                    if (shouldRegress) {
                      updates.outputData = { tileId: inputBufferId, retry: nextRetry };
                    }
                    await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, updates);
                  }
                  onProgress({
                    total: tasks.length,
                    completed,
                    failed,
                    skipped,
                    percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                    currentStage: 'vectortile',
                    currentTask: task.taskId,
                  });
                }
                finished = true;
                continue;
              }
            }
          let tileFeatureCount: number | null = null;
          let tileKey: string | null = null;
          let tileInputBuffer: ArrayBuffer | undefined;
          const inputFormat: 'geojson' | 'flatgeobuf' = (sampleInput.format ?? 'geojson') as ('geojson' | 'flatgeobuf');
          const inputCompression: 'none' | 'gzip' = (sampleInput.compression ?? 'none') as ('none' | 'gzip');
          const format = (sampleInput.format ?? 'mvt') as 'mvt';
          const tileSizeConfig = sampleInput.tileSize ?? 256;
          const buffer = sampleInput.buffer;
          const minZoom = sampleInput.minZoom;
          const maxZoom = sampleInput.maxZoom;
          const metadataEnabled = Boolean(sampleInput.metadataEnabled);
          const replace = metadataEnabled && metadataReplaceRef.value;
          if (metadataEnabled && metadataReplaceRef.value) {
            metadataReplaceRef.value = false;
          }
          if (isTileTask) {
            const tileZ = sampleInput.tileZ;
            const tileX = sampleInput.tileX;
            const tileY = sampleInput.tileY;
            if (typeof tileZ !== 'number' || typeof tileX !== 'number' || typeof tileY !== 'number') {
              throw new Error(`Invalid tile input: ${inputBufferId}`);
            }
            tileKey = inputBufferId;
            const relationBufferIds = await this.listBufferIdsForTile(resolvedNodeId, tileKey);
            let tileFeatures: Feature[] = [];
            if (relationBufferIds.length === 0) {
              throw new Error(`Missing tileId relations for ${this.formatTileId(tileZ, tileX, tileY)}.`);
            }
            const collections = (await Promise.all(
              relationBufferIds.map((bufferId) => this.loadExtract2Collection(bufferId)),
            )).filter((collection): collection is FeatureCollection => Boolean(collection));
            const assembled = assembleTileGeoJSON({
              z: tileZ,
              x: tileX,
              y: tileY,
              collections,
            });
            tileFeatures = assembled.features.filter(Boolean);
            tileFeatureCount = tileFeatures.length;
            if (tileFeatures.length === 0) {
              const skipMessage = `Skipped: no features intersect tile ${this.formatTileId(tileZ, tileX, tileY)}.`;
                console.warn('[VectorTile] Skipping empty tile input', {
                  inputBufferId,
                  tileId: this.formatTileId(tileZ, tileX, tileY),
                });
                for (const task of inputTasks) {
                  skipped += 1;
                  if (task.taskId) {
                    const outputData: VectorTileTaskOutputData = {
                      tileId: inputBufferId,
                      tileCount: 0,
                      totalBytes: 0,
                    };
                    await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                      status: 'completed',
                      completedAt: Date.now(),
                      progress: 100,
                      message: skipMessage,
                      outputData,
                    });
                  }
                  onProgress({
                    total: tasks.length,
                    completed,
                    failed,
                    skipped,
                    percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                    currentStage: 'vectortile',
                    currentTask: task.taskId,
                  });
                }
                finished = true;
                continue;
              }
              let encodedBuffer: ArrayBuffer;
              try {
                encodedBuffer = await this.encodeVectorTileFeatures(tileFeatures, inputFormat);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Tile input serialization failed';
                const detailMessage = `Vector tile input serialization failed for ${this.formatTileId(tileZ, tileX, tileY)}: ${errorMessage}`;
                console.error('[VectorTile] Tile input serialization failed', {
                  inputBufferId,
                  tileId: this.formatTileId(tileZ, tileX, tileY),
                  error,
                });
                for (const task of inputTasks) {
                  failed += 1;
                  if (task.taskId) {
                    await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                      status: 'failed',
                      completedAt: Date.now(),
                      progress: 100,
                      message: detailMessage,
                      errorMessage,
                    });
                  }
                  onProgress({
                    total: tasks.length,
                    completed,
                    failed,
                    skipped,
                    percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                    currentStage: 'vectortile',
                    currentTask: task.taskId,
                  });
                }
                finished = true;
                continue;
              }
              tileInputBuffer = encodedBuffer;
              if (encodedBuffer.byteLength > MAX_VECTOR_TILE_INPUT_BYTES) {
                const detailMessage = `Vector tile input too large for ${this.formatTileId(tileZ, tileX, tileY)} (${this.formatBytes(encodedBuffer.byteLength)} > ${this.formatBytes(MAX_VECTOR_TILE_INPUT_BYTES)}).`;
                console.error('[VectorTile] Tile input exceeds size limit', {
                  inputBufferId,
                  tileId: this.formatTileId(tileZ, tileX, tileY),
                  sizeBytes: encodedBuffer.byteLength,
                  limitBytes: MAX_VECTOR_TILE_INPUT_BYTES,
                });
                for (const task of inputTasks) {
                  failed += 1;
                  if (task.taskId) {
                    await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                      status: 'failed',
                      completedAt: Date.now(),
                      progress: 100,
                      message: detailMessage,
                      errorMessage: detailMessage,
                    });
                  }
                  onProgress({
                    total: tasks.length,
                    completed,
                    failed,
                    skipped,
                    percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                    currentStage: 'vectortile',
                    currentTask: task.taskId,
                  });
                }
                finished = true;
                continue;
              }
            }
            const taskIds = inputTasks
              .map((task) => task.taskId)
              .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0);
            let lastProgressPercent = -1;
            let lastProgressAt = 0;
            let progressInFlight = false;
            const progressHandler = async (progress: VectorTileProgress) => {
              const percent = Math.min(99, Math.max(1, Math.floor(progress.percent)));
              if (!Number.isFinite(percent)) return;
              const now = Date.now();
              if (percent <= lastProgressPercent && now - lastProgressAt < 1000) return;
              if (progressInFlight) return;
              progressInFlight = true;
              lastProgressPercent = percent;
              lastProgressAt = now;
              try {
                await Promise.all(taskIds.map((taskId) => (
                  getShapeDbApiClient().ephemeral.updateBatchTask(taskId, {
                    status: 'running',
                    progress: percent,
                  })
                )));
              } catch (error) {
                console.warn('[VectorTile] Progress update failed', error);
              } finally {
                progressInFlight = false;
              }
            };
            const progressReporter = taskIds.length > 0
              ? await getStageWorkerProxy(progressHandler)
              : undefined;
            await Promise.all(inputTasks.map(async (task) => {
              if (!task.taskId) return;
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'running',
                startedAt: Date.now(),
                progress: 0,
              });
            }));
            if (shouldAbort()) {
              continue;
            }
            const inputBuffer = isTileTask
              ? tileInputBuffer
              : await this.buildVectorTileInputBuffer(resolvedNodeId, inputBufferId, inputFormat);
            if (shouldAbort()) {
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
              } else {
                return { processed: completed, failed };
              }
            }
            abortKey = `${inputBufferId}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
            const signal = getSignal?.();
            const abortListener = async () => {
              if (abortKey && vectorTileClient.abortGenerateTiles) {
                await vectorTileClient.abortGenerateTiles(abortKey);
              }
            };
            if (signal) {
              signal.addEventListener('abort', abortListener, { once: true });
            }
            let stageResult: Awaited<ReturnType<typeof runVectorTileStage>> | null = null;
            try {
              stageResult = await runVectorTileStage({
                bufferId: inputBufferId,
                buffer: inputBuffer,
                config: {
                  format,
                  compression: inputCompression,
                  tileSize: tileSizeConfig,
                  buffer,
                  minZoom,
                  maxZoom,
                  inputFormat,
                  inputCompression,
                  metadataEnabled,
                  metadataReplace: replace,
                  metadataContext: {
                    dataSource: sampleInput.dataSource,
                    countryCode: sampleInput.countryCode,
                    countryName: sampleInput.countryName,
                    adminLevel: sampleInput.adminLevel,
                  },
                  targetNodeId: sample.nodeId,
                  abortKey,
                },
                onProgress: progressReporter,
              }, vectorTileClient, {
                nodeId: sample.nodeId,
                tileId: tileKey ?? inputBufferId,
                storage: 'ephemeral',
              });
            } finally {
              if (signal) {
                signal.removeEventListener('abort', abortListener);
              }
            }
            let tileSizeBytes: number | null = null;
            if (tileKey && stageResult?.tiles?.length) {
              const tileZ = sampleInput.tileZ;
              const tileX = sampleInput.tileX;
              const tileY = sampleInput.tileY;
              const match = stageResult.tiles.find((tile) => (
                tile.z === tileZ && tile.x === tileX && tile.y === tileY
              ));
              tileSizeBytes = typeof match?.size === 'number' ? match.size : null;
            }
            const completionMessage = this.buildCompletionMessage(tileFeatureCount, tileSizeBytes);
            if (shouldAbort()) {
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
              } else {
                return { processed: completed, failed };
              }
            }
            for (const task of inputTasks) {
              completed++;
              if (task.taskId) {
                const outputData: VectorTileTaskOutputData = {
                  tileId: tileKey ?? inputBufferId,
                  tileCount: tileFeatureCount != null ? 1 : undefined,
                  totalBytes: tileSizeBytes ?? undefined,
                };
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
                  outputData,
                });
              }
              onProgress({
                total: tasks.length,
                completed,
                failed,
                skipped,
                percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                currentStage: 'vectortile',
                currentTask: task.taskId,
              });
            }
            finished = true;
          } catch (error) {
            if (shouldAbort()) {
              if (abortKey && vectorTileClient.abortGenerateTiles) {
                await vectorTileClient.abortGenerateTiles(abortKey);
              }
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
                continue;
              }
              return { processed: completed, failed };
            }
            if (isAbortError(error)) {
              if (abortKey && vectorTileClient.abortGenerateTiles) {
                await vectorTileClient.abortGenerateTiles(abortKey);
              }
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
                continue;
              }
              return { processed: completed, failed };
            }
            for (const task of inputTasks) {
              failed++;
              if (task.taskId) {
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'failed',
                  completedAt: Date.now(),
                  progress: 100,
                  errorMessage: error instanceof Error ? error.message : 'Vector tile generation failed',
                });
              }
              onProgress({
                total: tasks.length,
                completed,
                failed,
                skipped,
                percentage: tasks.length > 0 ? ((completed + failed + skipped) / tasks.length) * 100 : 0,
                currentStage: 'vectortile',
                currentTask: task.taskId,
              });
            }
            finished = true;
          }
        }
      };
      const entries = Array.from(tasksByInput.entries());
      await batch.mapChunks(entries, processInputTasks, { concurrency: maxConcurrent });
      return { processed: completed, failed };
    } finally {
      for (const client of clients) {
        (client as { terminate?: () => void }).terminate?.();
      }
    }
  }
}
