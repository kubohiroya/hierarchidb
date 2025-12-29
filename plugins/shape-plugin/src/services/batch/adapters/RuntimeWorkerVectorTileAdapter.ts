import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { getShapeTileMetadataDB } from '../../database/ShapeTileMetadataDB.js';
import { geojson } from 'flatgeobuf';
import type { Feature } from 'geojson';
import { BatchService } from '@hierarchidb/batch';
import { createStageWorkerClient, runVectorTileStage } from '@hierarchidb/runtime-worker';
import { TilesDB } from '@hierarchidb/gis-sdk';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const MAX_VECTOR_TILE_INPUT_BYTES = 50 * 1024 * 1024;
const isStageTileInput = (inputBufferId: string): boolean => inputBufferId.startsWith('stage-tile:');

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  private readonly featureCache = new Map<string, Array<{ feature: Feature; bbox: [number, number, number, number] }>>();

  private parseStageTileInput(inputBufferId: string): { key: string; nodeId: string; z: number; x: number; y: number } | null {
    if (!isStageTileInput(inputBufferId)) return null;
    const key = inputBufferId.slice('stage-tile:'.length);
    const match = key.match(/^input:(.+)-(\d+)-(\d+)-(\d+)$/) ?? key.match(/^(.+)-(\d+)-(\d+)-(\d+)$/);
    if (!match) return null;
    const [, nodeId, z, x, y] = match;
    if (!nodeId) return null;
    return {
      key,
      nodeId,
      z: Number(z),
      x: Number(x),
      y: Number(y),
    };
  }

  clearFeatureCache(nodeId: string): void {
    this.featureCache.delete(nodeId);
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
      if (!Number.isFinite(merged.minX)) return null;
      return [merged.minX, merged.minY, merged.maxX, merged.maxY];
    }
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.updateBounds(geometry.coordinates, bounds);
    if (!Number.isFinite(bounds.minX)) return null;
    return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
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

  private async loadSimplify2Features(nodeId: string): Promise<Array<{ feature: Feature; bbox: [number, number, number, number] }>> {
    const cached = this.featureCache.get(nodeId);
    if (cached) return cached;
    const db = getEphemeralShapeDB();
    const buffers = await db.simplifiedBuffers.where({ nodeId, stage: 'simplify2' }).toArray();
    const result: Array<{ feature: Feature; bbox: [number, number, number, number] }> = [];
    for (const row of buffers) {
      const decoded = await this.decodeGeoJson(row.data);
      if (!decoded || typeof decoded !== 'object') continue;
      const features = (decoded as { features?: Feature[] }).features ?? [];
      for (const feature of features) {
        if (!feature) continue;
        const bbox = this.computeBBox(feature.geometry);
        if (!bbox) continue;
        result.push({ feature, bbox });
      }
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
    const input = await db.simplifiedBuffers.get(inputBufferId)
      ?? await db.rawBuffers.get(inputBufferId);
    if (!input) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    const geojsonPayload = await this.decodeGeoJson(input.data);
    const text = JSON.stringify(geojsonPayload);
    return new TextEncoder().encode(text).buffer;
  }

  private async resolveInputByteLength(inputBufferId: string): Promise<number | null> {
    const db = getEphemeralShapeDB();
    const input = await db.simplifiedBuffers.get(inputBufferId)
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
      const inputBufferId = task.config?.inputBufferId ?? '';
      if (!tasksByInput.has(inputBufferId)) {
        tasksByInput.set(inputBufferId, []);
      }
      tasksByInput.get(inputBufferId)!.push(task);
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
          try {
            if (!isStageTileInput(inputBufferId)) {
              const inputBytes = await this.resolveInputByteLength(inputBufferId);
              if (typeof inputBytes === 'number' && inputBytes > MAX_VECTOR_TILE_INPUT_BYTES) {
                const message = `Vector tile input too large (${this.formatBytes(inputBytes)} > ${this.formatBytes(MAX_VECTOR_TILE_INPUT_BYTES)}).`;
                console.error('[VectorTile] Input size exceeds limit', {
                  inputBufferId,
                  inputBytes,
                  limitBytes: MAX_VECTOR_TILE_INPUT_BYTES,
                });
                for (const task of inputTasks) {
                  const currentRetry = typeof task.config?.retry === 'number' ? task.config.retry : 0;
                  const shouldRegress = currentRetry <= 1;
                  const nextRetry = currentRetry + 1;
                  if (!shouldRegress) {
                    failed += 1;
                  }
                  if (task.taskId) {
                    const updates: Record<string, unknown> = {
                      status: shouldRegress ? 'regression' : 'failed',
                      completedAt: Date.now(),
                      progress: 100,
                      message,
                      errorMessage: shouldRegress ? undefined : message,
                    };
                    if (shouldRegress) {
                      updates.inputData = { ...(task.config ?? {}), retry: nextRetry };
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
          if (isStageTileInput(inputBufferId)) {
            const parsed = this.parseStageTileInput(inputBufferId);
            if (!parsed) {
              throw new Error(`Invalid stage tile input: ${inputBufferId}`);
            }
            const features = await this.loadSimplify2Features(parsed.nodeId);
            const tileBBox = this.tileToBBox(parsed.z, parsed.x, parsed.y);
            const tileFeatures = features
              .filter((entry) => this.intersects(entry.bbox, tileBBox))
              .map((entry) => entry.feature)
              .filter(Boolean);
            tileFeatureCount = tileFeatures.length;
            tileKey = `${parsed.nodeId}-${parsed.z}-${parsed.x}-${parsed.y}`;
            if (tileFeatures.length === 0) {
              const skipMessage = `Skipped: no features intersect tile ${this.formatTileId(parsed.z, parsed.x, parsed.y)}.`;
                console.warn('[VectorTile] Skipping empty tile input', {
                  inputBufferId,
                  tileId: this.formatTileId(parsed.z, parsed.x, parsed.y),
                });
                for (const task of inputTasks) {
                  skipped += 1;
                  if (task.taskId) {
                    await shapeDB.updateBatchTask(task.taskId, {
                      status: 'completed',
                      completedAt: Date.now(),
                      progress: 100,
                      message: skipMessage,
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
              let json: string;
              try {
                json = JSON.stringify({ type: 'FeatureCollection', features: tileFeatures });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Tile input serialization failed';
                const detailMessage = `Vector tile input serialization failed for ${this.formatTileId(parsed.z, parsed.x, parsed.y)}: ${errorMessage}`;
                console.error('[VectorTile] Tile input serialization failed', {
                  inputBufferId,
                  tileId: this.formatTileId(parsed.z, parsed.x, parsed.y),
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
              const buffer = new TextEncoder().encode(json).buffer;
              if (buffer.byteLength > MAX_VECTOR_TILE_INPUT_BYTES) {
                const detailMessage = `Vector tile input too large for ${this.formatTileId(parsed.z, parsed.x, parsed.y)} (${this.formatBytes(buffer.byteLength)} > ${this.formatBytes(MAX_VECTOR_TILE_INPUT_BYTES)}).`;
                console.error('[VectorTile] Tile input exceeds size limit', {
                  inputBufferId,
                  tileId: this.formatTileId(parsed.z, parsed.x, parsed.y),
                  sizeBytes: buffer.byteLength,
                  limitBytes: MAX_VECTOR_TILE_INPUT_BYTES,
                });
                for (const task of inputTasks) {
                  const currentRetry = typeof task.config?.retry === 'number' ? task.config.retry : 0;
                  const shouldRegress = currentRetry <= 1;
                  const nextRetry = currentRetry + 1;
                  if (!shouldRegress) {
                    failed += 1;
                  }
                  if (task.taskId) {
                    const updates: Record<string, unknown> = {
                      status: shouldRegress ? 'regression' : 'failed',
                      completedAt: Date.now(),
                      progress: 100,
                      message: detailMessage,
                      errorMessage: shouldRegress ? undefined : detailMessage,
                    };
                    if (shouldRegress) {
                      updates.inputData = { ...(task.config ?? {}), retry: nextRetry };
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
              const tileDb = await getShapeTileMetadataDB();
              await tileDb.tiles.put({
                key: parsed.key,
                nodeId: parsed.key.startsWith('input:') ? `input:${parsed.nodeId}` : parsed.nodeId,
                z: parsed.z,
                x: parsed.x,
                y: parsed.y,
                data: buffer,
                size: buffer.byteLength,
                contentType: 'application/json',
                timestamp: Date.now(),
              });
            }
            await Promise.all(inputTasks.map(async (task) => {
              if (!task.taskId) return;
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'running',
                startedAt: Date.now(),
                progress: 0,
              });
            }));
            const compression = sample.config?.compression ?? false;
            const format = (sample.config?.format ?? 'mvt') as 'mvt';
            const tileSizeConfig = sample.config?.tileSize ?? 256;
            const buffer = sample.config?.buffer;
            const minZoom = sample.config?.minZoom;
            const maxZoom = sample.config?.maxZoom;
            const metadataEnabled = Boolean(sample.config?.metadataEnabled);
            const replace = metadataEnabled && metadataReplaceRef.value;
            if (metadataEnabled && metadataReplaceRef.value) {
              metadataReplaceRef.value = false;
            }
            if (shouldAbort()) {
              continue;
            }
            const inputBuffer = isStageTileInput(inputBufferId)
              ? undefined
              : await this.buildGeoJsonBuffer(inputBufferId);
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
                inputBufferId,
                inputBuffer,
                contentType: 'application/json',
                config: {
                  format,
                  compression: compression ? 'gzip' : 'none',
                  tileSize: tileSizeConfig,
                  buffer,
                  minZoom,
                  maxZoom,
                  metadataEnabled,
                  metadataReplace: replace,
                  metadataContext: sample.config?.metadataContext,
                  abortKey,
                },
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
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: completionMessage,
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
