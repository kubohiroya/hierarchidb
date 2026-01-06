import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { type VectorTileTaskInputData, type VectorTileTaskOutputData } from '../../database/ShapeDB.js';
import { getShapeDbApiClient } from '../ShapeBatchApiClient.js';
import { geojson } from 'flatgeobuf';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { Tile } from 'geojson-vt';
import { BatchService } from '@hierarchidb/batch';
import { createStageWorkerClient, getStageWorkerProxy, runVectorTileStage } from '@hierarchidb/runtime-worker';
import { type VectorTileProgress } from '@hierarchidb/gis-sdk';
import type { NodeId } from '@hierarchidb/common-types';
import { readDownloadBuffer } from '../../utils/chunkStore.js';
import type { ShapeGeojsonVtIndexRecord } from '@hierarchidb/plugin-service-api';
import type vtPbfNS = require('@maplibre/vt-pbf');

type GeojsonVtModule = typeof import('geojson-vt');
type GeojsonVtIndexOptions = {
  extent: number;
  buffer: number;
  indexMaxZoom: number;
  promoteId: string;
};
type GeojsonVtIndexObject = {
  getTile: (z: number, x: number, y: number) => GeojsonVtTileObject | null;
};
type GeojsonVtTileObject = Tile;
type VtPbfModule = typeof vtPbfNS;

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const MAX_VECTOR_TILE_INPUT_BYTES = 100 * 1024 * 1024;
const GEOJSON_VT_PROMOTE_ID = 'id';

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  private readonly geojsonVtIndexCache = new Map<string, {
    index: GeojsonVtIndexObject;
    options: GeojsonVtIndexOptions;
  }>();
  private readonly geojsonVtPrototypeCache = new Map<string, object>();

  clearFeatureCache(nodeId: NodeId): void {
    void nodeId;
  }

  private async loadGeojsonVt(): Promise<GeojsonVtModule> {
    const mod = await import('geojson-vt');
    const candidate = mod as unknown as { default?: GeojsonVtModule } & GeojsonVtModule;
    return candidate.default ?? candidate;
  }

  private async loadVtPbf(): Promise<VtPbfModule> {
    const mod = await import('@maplibre/vt-pbf');
    const candidate = mod as unknown as { default?: VtPbfModule } & VtPbfModule;
    return candidate.default ?? candidate;
  }

  private buildGeojsonVtOptionsKey(options: GeojsonVtIndexOptions): string {
    return `${options.extent}:${options.buffer}:${options.indexMaxZoom}:${options.promoteId}`;
  }

  private async resolveGeojsonVtPrototype(options: GeojsonVtIndexOptions): Promise<object> {
    const cacheKey = this.buildGeojsonVtOptionsKey(options);
    const cached = this.geojsonVtPrototypeCache.get(cacheKey);
    if (cached) return cached;
    const geojsonvt = await this.loadGeojsonVt();
    const emptyCollection: FeatureCollection<Geometry, GeoJsonProperties> = { type: 'FeatureCollection', features: [] };
    const index = geojsonvt(emptyCollection, {
      maxZoom: options.indexMaxZoom,
      indexMaxZoom: options.indexMaxZoom,
      extent: options.extent,
      buffer: options.buffer,
      promoteId: options.promoteId,
    });
    const proto = Object.getPrototypeOf(index);
    this.geojsonVtPrototypeCache.set(cacheKey, proto);
    return proto;
  }

  private normalizeGeojsonVtIndexRecord(
    record: ShapeGeojsonVtIndexRecord,
  ): { index: GeojsonVtIndexObject; options: GeojsonVtIndexOptions } {
    const options = record.options;
    if (!options || !Number.isFinite(options.extent) || !Number.isFinite(options.buffer) || !Number.isFinite(options.indexMaxZoom)) {
      throw new Error(`Invalid geojson-vt index options for buffer ${record.bufferId}`);
    }
    if (options.promoteId !== GEOJSON_VT_PROMOTE_ID) {
      throw new Error(`Unexpected geojson-vt promoteId for buffer ${record.bufferId}`);
    }
    const index = record.index as GeojsonVtIndexObject;
    if (!index || typeof index !== 'object') {
      throw new Error(`Invalid geojson-vt index payload for buffer ${record.bufferId}`);
    }
    return {
      index,
      options: {
        extent: Number(options.extent),
        buffer: Number(options.buffer),
        indexMaxZoom: Number(options.indexMaxZoom),
        promoteId: options.promoteId,
      },
    };
  }

  private async getGeojsonVtIndex(
    nodeId: NodeId,
    bufferId: string,
  ): Promise<{ index: GeojsonVtIndexObject; options: GeojsonVtIndexOptions }> {
    const cached = this.geojsonVtIndexCache.get(bufferId);
    if (cached) return cached;
    const record = await getShapeDbApiClient().ephemeral.getGeojsonVtIndex(nodeId, bufferId);
    if (!record) {
      throw new Error(`Geojson-vt index not found for buffer ${bufferId}`);
    }
    const { index, options } = this.normalizeGeojsonVtIndexRecord(record);
    const proto = await this.resolveGeojsonVtPrototype(options);
    Object.setPrototypeOf(index, proto);
    const entry = { index, options };
    this.geojsonVtIndexCache.set(bufferId, entry);
    return entry;
  }

  private async buildTileFromIndexes(params: {
    nodeId: NodeId;
    bufferIds: string[];
    z: number;
    x: number;
    y: number;
    expectedBuffer: number;
    expectedExtent: number;
  }): Promise<{ bytes: Uint8Array; featureCount: number } | null> {
    const { nodeId, bufferIds, z, x, y, expectedBuffer, expectedExtent } = params;
    let mergedTile: GeojsonVtTileObject | null = null;
    let featureCount = 0;
    for (const bufferId of bufferIds) {
      const { index, options } = await this.getGeojsonVtIndex(nodeId, bufferId);
      if (options.buffer !== expectedBuffer || options.extent !== expectedExtent) {
        throw new Error(`Geojson-vt index options mismatch for buffer ${bufferId}`);
      }
      if (z > options.indexMaxZoom) {
        throw new Error(`Geojson-vt index maxZoom mismatch for buffer ${bufferId}`);
      }
      const tile = index.getTile(z, x, y);
      if (!tile) continue;
      const tileFeatures = tile.features;
      if (!Array.isArray(tileFeatures) || tileFeatures.length === 0) continue;
      if (!mergedTile) {
        mergedTile = { ...tile, features: [...tileFeatures] };
      } else {
        const existing = Array.isArray(mergedTile.features) ? mergedTile.features : [];
        mergedTile.features = existing.concat(tileFeatures);
      }
      featureCount += tileFeatures.length;
    }
    if (!mergedTile || !Array.isArray(mergedTile.features) || mergedTile.features.length === 0) {
      return null;
    }
    const vtpbf = await this.loadVtPbf();
    const layers: Record<string, Tile> = { layer0: mergedTile };
    const pbf = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 });
    return { bytes: pbf as Uint8Array, featureCount };
  }

  private async listBufferIdsForTile(nodeId: NodeId, tileId: string): Promise<string[]> {
    const rows = await getShapeDbApiClient().ephemeral.listTileIdRelationsByTileId(nodeId, tileId);
    if (!rows.length) return [];
    return Array.from(new Set(rows.map((row) => row.bufferId)));
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
            if (metadataEnabled) {
              throw new Error(`Metadata-enabled vectortile tasks are not supported for geojson-vt reuse: ${inputBufferId}`);
            }
            tileKey = inputBufferId;
            const expectedBuffer = sampleInput.buffer;
            const expectedExtent = sampleInput.extent;
            if (!Number.isFinite(expectedBuffer) || !Number.isFinite(expectedExtent)) {
              throw new Error(`Vector tile config is missing for ${inputBufferId}`);
            }
            const relationBufferIds = await this.listBufferIdsForTile(resolvedNodeId, tileKey);
            if (relationBufferIds.length === 0) {
              throw new Error(`Missing tileId relations for ${this.formatTileId(tileZ, tileX, tileY)}.`);
            }
            const tileResult = await this.buildTileFromIndexes({
              nodeId: resolvedNodeId,
              bufferIds: relationBufferIds,
              z: tileZ,
              x: tileX,
              y: tileY,
              expectedBuffer: Number(expectedBuffer),
              expectedExtent: Number(expectedExtent),
            });
            tileFeatureCount = tileResult?.featureCount ?? 0;
            if (!tileResult || tileFeatureCount === 0) {
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
            tileInputBuffer = tileResult.bytes.buffer.slice(
              tileResult.bytes.byteOffset,
              tileResult.bytes.byteOffset + tileResult.bytes.byteLength,
            );
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
              ? undefined
              : await this.buildVectorTileInputBuffer(resolvedNodeId, inputBufferId, inputFormat);
            if (shouldAbort()) {
              if (controls?.waitIfPaused) {
                await controls.waitIfPaused();
              } else {
                return { processed: completed, failed };
              }
            }
            let tileSizeBytes: number | null = null;
            if (isTileTask && tileInputBuffer) {
              const tileZ = sampleInput.tileZ;
              const tileX = sampleInput.tileX;
              const tileY = sampleInput.tileY;
              if (typeof tileZ !== 'number' || typeof tileX !== 'number' || typeof tileY !== 'number') {
                throw new Error('Vector tile task is missing tile coordinates.');
              }
              const bytes = new Uint8Array(tileInputBuffer);
              tileSizeBytes = bytes.byteLength;
              await vectorTileClient.storeTiles(
                sample.nodeId,
                'shape',
                [{
                  z: tileZ,
                  x: tileX,
                  y: tileY,
                  data: bytes,
                  size: bytes.byteLength,
                  contentType: 'application/vnd.mapbox-vector-tile',
                  timestamp: Date.now(),
                }],
              );
            } else {
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
              try {
                await runVectorTileStage({
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
