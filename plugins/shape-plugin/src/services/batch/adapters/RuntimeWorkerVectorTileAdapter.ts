import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { shapeDB, type VectorTileTaskInputData, type VectorTileTaskOutputData } from '../../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { geojson } from 'flatgeobuf';
import type { Feature } from 'geojson';
import { BatchService } from '@hierarchidb/batch';
import { createStageWorkerClient, getStageWorkerProxy, runVectorTileStage } from '@hierarchidb/runtime-worker';
import { TilesDB } from '@hierarchidb/vectortile-store';
import { encodeFlatGeobufFromFeatureCollection, type VectorTileProgress } from '@hierarchidb/gis-sdk';
import { assignFeatureIds, HDB_ORIGIN_KEY } from '../utils/featureIds.js';
import { bbox as turfBbox } from '@turf/turf';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const MAX_VECTOR_TILE_INPUT_BYTES = 100 * 1024 * 1024;

type OriginSummary = {
  totalFeatures: number;
  uniqueOrigins: number;
  originKeyCounts: Array<{ originKey: string; count: number }>;
  truncated: boolean;
};

type OriginDiffSummary = {
  removedOrigins: Array<{ originKey: string; count: number }>;
  truncated: boolean;
};

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  private readonly featureCache = new Map<string, Array<{ feature: Feature; bbox: [number, number, number, number] }>>();
  private readonly originSummaryCache = new Map<string, OriginSummary>();

  private summarizeOriginKeys(features: Feature[], limit = 20): OriginSummary {
    const counts = new Map<string, number>();
    for (const feature of features) {
      if (!feature) continue;
      const properties = feature.properties ?? {};
      const raw = properties[HDB_ORIGIN_KEY] ?? properties.originKey;
      const originKey = typeof raw === 'string' && raw.trim().length > 0 ? raw : '__unknown__';
      counts.set(originKey, (counts.get(originKey) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([originKey, count]) => ({ originKey, count }));
    const truncated = sorted.length > limit;
    return {
      totalFeatures: features.length,
      uniqueOrigins: counts.size,
      originKeyCounts: truncated ? sorted.slice(0, limit) : sorted,
      truncated,
    };
  }

  private diffOriginKeys(total: OriginSummary, intersecting: OriginSummary, limit = 20): OriginDiffSummary {
    const totalMap = new Map(total.originKeyCounts.map((entry) => [entry.originKey, entry.count]));
    const intersectMap = new Map(intersecting.originKeyCounts.map((entry) => [entry.originKey, entry.count]));
    const removed: Array<{ originKey: string; count: number }> = [];
    for (const [originKey, count] of totalMap.entries()) {
      if (!intersectMap.has(originKey)) {
        removed.push({ originKey, count });
      }
    }
    removed.sort((a, b) => b.count - a.count);
    const truncated = removed.length > limit;
    return {
      removedOrigins: truncated ? removed.slice(0, limit) : removed,
      truncated,
    };
  }

  private getOriginSummary(nodeId: string, features: Feature[]): OriginSummary {
    const cached = this.originSummaryCache.get(nodeId);
    if (cached) return cached;
    const summary = this.summarizeOriginKeys(features);
    this.originSummaryCache.set(nodeId, summary);
    return summary;
  }

  clearFeatureCache(nodeId: string): void {
    this.featureCache.delete(nodeId);
    this.originSummaryCache.delete(nodeId);
  }

  private updateBounds(coords: unknown, bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const x = coords[0];
      const y = coords[1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
      return;
    }
    for (const child of coords) {
      this.updateBounds(child, bounds);
    }
  }

  private computeBBox(geometry?: Feature['geometry'] | null): [number, number, number, number] | null {
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') {
      const merged = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const child of geometry.geometries ?? []) {
        const childBox = this.computeBBox(child);
        if (!childBox) continue;
        merged.minX = Math.min(merged.minX, childBox[0]);
        merged.minY = Math.min(merged.minY, childBox[1]);
        merged.maxX = Math.max(merged.maxX, childBox[2]);
        merged.maxY = Math.max(merged.maxY, childBox[3]);
      }
      if (!Number.isFinite(merged.minX)) {
        const fallback = this.computeFallbackBBox(geometry);
        return fallback;
      }
      return [merged.minX, merged.minY, merged.maxX, merged.maxY];
    }
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.updateBounds(geometry.coordinates, bounds);
    if (!Number.isFinite(bounds.minX)) {
      return this.computeFallbackBBox(geometry);
    }
    return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
  }

  private computeFallbackBBox(geometry: Feature['geometry']): [number, number, number, number] | null {
    try {
      const bbox = turfBbox(geometry);
      if (!bbox || bbox.length !== 4) return null;
      const [minX, minY, maxX, maxY] = bbox;
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
      }
      return [minX, minY, maxX, maxY];
    } catch (error) {
      console.debug('[VectorTile] BBox fallback failed', { error });
      return null;
    }
  }

  private tileToBBox(z: number, x: number, y: number): [number, number, number, number] {
    const n = 2 ** z;
    const lon1 = (x / n) * 360 - 180;
    const lon2 = ((x + 1) / n) * 360 - 180;
    const lat1 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat2 = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
    const minLon = Math.min(lon1, lon2);
    const maxLon = Math.max(lon1, lon2);
    const minLat = Math.min(lat1, lat2);
    const maxLat = Math.max(lat1, lat2);
    return [minLon, minLat, maxLon, maxLat];
  }

  private intersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  }

  private async loadExtract2Features(nodeId: string): Promise<Array<{ feature: Feature; bbox: [number, number, number, number] }>> {
    const cached = this.featureCache.get(nodeId);
    if (cached) return cached;
    const db = getEphemeralShapeDB();
    const buffers = await db.extractedBuffers.where({ nodeId, stage: 'extract2' }).toArray();
    const result: Array<{ feature: Feature; bbox: [number, number, number, number] }> = [];
    let totalFeatures = 0;
    let missingBbox = 0;
    let missingOriginKey = 0;
    const missingBboxByOrigin = new Map<string, number>();
    for (const row of buffers) {
      const decoded = await this.decodeGeoJson(row.data);
      if (!decoded || typeof decoded !== 'object') continue;
      const features = (decoded as { features?: Feature[] }).features ?? [];
      for (const feature of features) {
        if (!feature) continue;
        totalFeatures += 1;
        const properties = feature.properties ?? {};
        const rawOrigin = properties[HDB_ORIGIN_KEY] ?? properties.originKey;
        const originKey = typeof rawOrigin === 'string' && rawOrigin.trim().length > 0
          ? rawOrigin
          : '__unknown__';
        if (originKey === '__unknown__') {
          missingOriginKey += 1;
        }
        const bbox = this.computeBBox(feature.geometry);
        if (!bbox) {
          missingBbox += 1;
          missingBboxByOrigin.set(originKey, (missingBboxByOrigin.get(originKey) ?? 0) + 1);
          continue;
        }
        result.push({ feature, bbox });
      }
    }
    if (result.length > 0) {
      assignFeatureIds(
        {
          type: 'FeatureCollection',
          features: result.map((entry) => entry.feature),
        },
        {},
      );
    }
    console.debug('[VectorTile] Extract2 features loaded', {
      nodeId,
      buffers: buffers.length,
      totalFeatures,
      indexedFeatures: result.length,
      missingBbox,
    });
    if (missingOriginKey > 0) {
      console.warn('[VectorTile] Extract2 features missing origin key', {
        nodeId,
        missingOriginKey,
        totalFeatures,
      });
    }
    if (missingBbox > 0) {
      const sorted = Array.from(missingBboxByOrigin.entries())
        .sort((a, b) => b[1] - a[1]);
      const limit = 10;
      const truncated = sorted.length > limit;
      const originKeyCounts = (truncated ? sorted.slice(0, limit) : sorted)
        .map(([originKey, count]) => ({ originKey, count }));
      console.warn('[VectorTile] Extract2 features missing bbox', {
        nodeId,
        missingBbox,
        originKeyCounts,
        truncated,
      });
    }
    this.featureCache.set(nodeId, result);
    return result;
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

  private async buildGeoJsonBuffer(inputBufferId: string): Promise<ArrayBuffer> {
    const db = getEphemeralShapeDB();
    const input = await db.extractedBuffers.get(inputBufferId)
      ?? await db.rawBuffers.get(inputBufferId);
    if (!input) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    const geojsonPayload = await this.decodeGeoJson(input.data);
    const text = JSON.stringify(geojsonPayload);
    return new TextEncoder().encode(text).buffer;
  }

  private async buildFlatGeobufBuffer(inputBufferId: string): Promise<ArrayBuffer> {
    const db = getEphemeralShapeDB();
    const input = await db.extractedBuffers.get(inputBufferId)
      ?? await db.rawBuffers.get(inputBufferId);
    if (!input) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    return input.data;
  }

  private async buildVectorTileInputBuffer(
    inputBufferId: string,
    inputFormat: 'geojson' | 'flatgeobuf',
  ): Promise<ArrayBuffer> {
    if (inputFormat === 'flatgeobuf') {
      return this.buildFlatGeobufBuffer(inputBufferId);
    }
    return this.buildGeoJsonBuffer(inputBufferId);
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

  private async resolveInputByteLength(inputBufferId: string): Promise<number | null> {
    const db = getEphemeralShapeDB();
    const input = await db.extractedBuffers.get(inputBufferId)
      ?? await db.rawBuffers.get(inputBufferId);
    if (!input) return null;
    return input.data.byteLength;
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
    const resolvedNodeId = tasks[0]?.nodeId ? String(tasks[0].nodeId) : null;
    const inputByTaskId = new Map<string, VectorTileTaskInputData>();
    const outputByTaskId = new Map<string, VectorTileTaskOutputData>();
    if (resolvedNodeId) {
      const rows = await shapeDB.batchTasks
        .where('nodeId')
        .equals(resolvedNodeId)
        .and((row) => row.taskType === 'vectortile')
        .toArray();
      rows.forEach((row) => {
        inputByTaskId.set(row.taskId, (row.inputData ?? {}) as VectorTileTaskInputData);
        outputByTaskId.set(row.taskId, (row.outputData ?? {}) as VectorTileTaskOutputData);
      });
    }
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
      const input = inputByTaskId.get(task.taskId) ?? {};
      const inputBufferId = input.inputBufferId ?? '';
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
          const sampleInput = inputByTaskId.get(sample.taskId) ?? {};
          try {
          const isTileTask = (
            typeof sampleInput.tileZ === 'number'
            && typeof sampleInput.tileX === 'number'
            && typeof sampleInput.tileY === 'number'
          );
          if (!isTileTask) {
            const inputBytes = await this.resolveInputByteLength(inputBufferId);
            if (typeof inputBytes === 'number' && inputBytes > MAX_VECTOR_TILE_INPUT_BYTES) {
              const message = `Vector tile input too large (${this.formatBytes(inputBytes)} > ${this.formatBytes(MAX_VECTOR_TILE_INPUT_BYTES)}).`;
                console.error('[VectorTile] Input size exceeds limit', {
                  inputBufferId,
                  inputBytes,
                  limitBytes: MAX_VECTOR_TILE_INPUT_BYTES,
                });
                for (const task of inputTasks) {
                  const taskOutput = outputByTaskId.get(task.taskId) ?? {};
                  const currentRetry = typeof taskOutput.retry === 'number' ? taskOutput.retry : 0;
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
                      updates.outputData = { ...taskOutput, retry: nextRetry };
                    }
                    await shapeDB.updateBatchTask(task.taskId, updates);
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
          const compression = sampleInput.compression ?? false;
          const inputFormat = sampleInput.inputFormat ?? 'geojson';
          const inputCompression = sampleInput.inputCompression ?? 'none';
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
            const features = await this.loadExtract2Features(String(sample.nodeId));
            const totalFeatures = features.length;
            const tileBBox = this.tileToBBox(tileZ, tileX, tileY);
            const tileFeatures = features
              .filter((entry) => this.intersects(entry.bbox, tileBBox))
              .map((entry) => entry.feature)
              .filter(Boolean);
            tileFeatureCount = tileFeatures.length;
            tileKey = inputBufferId;
            if (totalFeatures > 0 && tileFeatureCount !== totalFeatures) {
              const totalOriginSummary = this.getOriginSummary(String(sample.nodeId), features.map((entry) => entry.feature));
              const intersectOriginSummary = this.summarizeOriginKeys(tileFeatures);
              const removedOriginSummary = this.diffOriginKeys(totalOriginSummary, intersectOriginSummary);
              console.debug('[VectorTile] Tile feature reduction', {
                nodeId: sample.nodeId,
                tileId: this.formatTileId(tileZ, tileX, tileY),
                totalFeatures,
                intersectingFeatures: tileFeatureCount,
                originKeyTotals: totalOriginSummary,
                originKeyIntersecting: intersectOriginSummary,
                originKeyRemoved: removedOriginSummary,
              });
            }
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
                    await shapeDB.updateBatchTask(task.taskId, {
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
                    await shapeDB.updateBatchTask(task.taskId, {
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
                    await shapeDB.updateBatchTask(task.taskId, {
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
                  shapeDB.updateBatchTask(taskId, {
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
              await shapeDB.updateBatchTask(task.taskId, {
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
              : await this.buildVectorTileInputBuffer(inputBufferId, inputFormat);
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
            try {
              await runVectorTileStage({
                bufferId: inputBufferId,
                buffer: inputBuffer,
                config: {
                  format,
                  compression: compression ? 'gzip' : 'none',
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
                  targetNodeId: String(sample.nodeId),
                  abortKey,
                },
                onProgress: progressReporter,
              }, vectorTileClient);
            } finally {
              if (signal) {
                signal.removeEventListener('abort', abortListener);
              }
            }
            let tileSizeBytes: number | null = null;
            if (tileKey) {
              const tilesDb = await TilesDB.getSingleton();
              const row = await tilesDb.tiles.get(tileKey);
              tileSizeBytes = typeof row?.size === 'number' ? row.size : null;
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
                await shapeDB.updateBatchTask(task.taskId, {
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
                await shapeDB.updateBatchTask(task.taskId, {
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
