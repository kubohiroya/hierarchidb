import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../../database/EphemeralShapeDB.js';
import { DexieChunkStoragePort } from '@hierarchidb/download';
import { geojson } from 'flatgeobuf';
import type { Feature } from 'geojson';
import { BatchService } from '@hierarchidb/batch';
import { createStageWorkerClient } from '@hierarchidb/runtime-worker';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const MAX_VECTOR_TILE_INPUT_BYTES = 50 * 1024 * 1024;
const isStageTileInput = (inputBufferId: string): boolean => inputBufferId.startsWith('stage-tile:');

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
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

  private async persistGeoJsonInput(inputBufferId: string): Promise<void> {
    const db = getEphemeralShapeDB();
    const input = await db.simplifiedBuffers.get(inputBufferId)
      ?? await db.rawBuffers.get(inputBufferId);
    if (!input) {
      throw new Error(`Vector tile input buffer not found: ${inputBufferId}`);
    }
    const geojsonPayload = await this.decodeGeoJson(input.data);
    const text = JSON.stringify(geojsonPayload);
    const bytes = new TextEncoder().encode(text).buffer;
    const storage = new DexieChunkStoragePort('hidb-chunks');
    await storage.putChunk(inputBufferId, 0, bytes);
    await storage.commit(inputBufferId, { sizeBytes: bytes.byteLength, contentType: 'application/json' });
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
                await controls?.requestPause?.(message);
                return { processed: completed, failed };
              }
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
            const tileSize = sample.config?.tileSize ?? 256;
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
            if (!isStageTileInput(inputBufferId)) {
              await this.persistGeoJsonInput(inputBufferId);
            }
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
              await vectorTileClient.generateTiles(inputBufferId, {
                format,
                compression: compression ? 'gzip' : 'none',
                tileSize,
                buffer,
                minZoom,
                maxZoom,
                metadataEnabled,
                metadataReplace: replace,
                metadataContext: sample.config?.metadataContext,
                abortKey,
              });
            } finally {
              if (signal) {
                signal.removeEventListener('abort', abortListener);
              }
            }
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
                });
              }
              onProgress({
                total: tasks.length,
                completed,
                failed,
                skipped: 0,
                percentage: (completed / tasks.length) * 100,
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
                skipped: 0,
                percentage: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
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
