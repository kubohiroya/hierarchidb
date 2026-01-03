import { AbstractBatchSession, BatchService } from '@hierarchidb/batch-runtime-services';
import type { RouteGenerationConfig } from '../common/entities/RouteEntity.js';
import { RouteGenerator, SearouteEngine } from '@hierarchidb/route-engine';
import { TabularWriter } from '@hierarchidb/tabular-store';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteBatchConfig } from '../common/types/BatchConfig.js';
import type { Feature, LineString } from 'geojson';
import { createStageWorkerClient, runVectorTileStage } from '@hierarchidb/runtime-worker';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import { RouteDB } from './database/RouteDatabase.js';
import type { RouteVectorTileRecord } from '@hierarchidb/route-store';

export interface RouteBatchTask {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
  taskType: 'route_generation' | 'location_resolution' | 'validation' | 'optimization';
  stage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  index: number;
  routeData?: {
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    method: RouteGenerationConfig['method'];
    methodOptions?: RouteGenerationConfig['options'];
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    estimatedDistance?: number;
  };
  error?: string;
}

export class RouteBatchSession extends AbstractBatchSession<RouteBatchConfig> {
  private tasks: RouteBatchTask[] = [];
  private laneSemaphores = new Map<string, Semaphore>();
  private laneConfig: Record<string, number> = { osm_route: 1, searoute: 3, direct: 64, great_circle: 64, custom: 8 };
  private generator: RouteGenerator;
  private writer: TabularWriter | null = null;
  private writerReady = false;
  private readonly vectorTileFeatures: Feature<LineString, Record<string, unknown>>[] = [];

  constructor(nodeId: NodeId, config: RouteBatchConfig, tasks: RouteBatchTask[], deps?: {
    generator?: RouteGenerator
  }) {
    super(nodeId, config);
    this.tasks = tasks;
    this.generator = deps?.generator ?? new RouteGenerator({ searoute: new SearouteEngine() });
    // Apply lane cap overrides from config (best-effort, safe parse)
    if (config.laneCaps) {
      this.laneConfig = { ...this.laneConfig, ...pickNumeric(config.laneCaps) };
    }
  }

  protected async onInitialize(): Promise<void> {
    this.writer = new TabularWriter('route');
    const columns = ['taskId', 'method', 'distance', 'duration', 'startLon', 'startLat', 'endLon', 'endLat'];
    await this.writer.begin({ filename: `route-${this.nodeId}.json`, columns });
    this.writerReady = true;
  }

  protected async onStart(): Promise<void> {
  }

  protected async onPause(): Promise<void> {
  }

  protected async onResume(): Promise<void> {
  }

  protected async onComplete(): Promise<void> {
    if (this.writer && this.writerReady) {
      await this.writer.commit();
    }
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    const maxConcurrent = this.config.routeGeneration.maxConcurrent;
    const batch = new BatchService();
    let completed = 0;
    await batch.mapChunks<RouteBatchTask, void>(this.tasks, async (task: RouteBatchTask, index: number) => {
      if (signal.aborted) {
        throw abortError();
      }
      if (task.taskType === 'route_generation') {
        const method = (task.routeData?.method || this.config.routeGeneration.method) as string;
        const sem = this.getLaneSemaphore(method);
        await sem.acquire();
        try {
          await this.processTask(task);
        } finally {
          sem.release();
        }
      } else {
        await this.processTask(task);
      }
      completed += 1;
      this.updateProgress({
        total: this.tasks.length,
        completed,
        currentStage: task.stage,
        currentTask: `Processing ${task.taskType}#${index}`,
      });
      // Pause handling (poll cursor flag)
      while (this.getState().status === 'paused') {
        this.updateProgress({ currentTask: `paused:${task.taskType}` });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }, { concurrency: maxConcurrent });
  }

  private async processTask(task: RouteBatchTask): Promise<void> {
    try {
      switch (task.taskType) {
        case 'route_generation': {
          const method = task.routeData?.method ?? this.config.routeGeneration.method;
          const start = task.routeData?.startCoordinates;
          const end = task.routeData?.endCoordinates;
          const pts: [number, number][] = start && end ? [start, end] : [[0, 0], [1, 1]];
          const config: RouteGenerationConfig = {
            method,
            options: task.routeData?.methodOptions,
          };
          const res = await this.generator.generate(pts, config);
          const line = res.lineGeometry ?? [];
          if (line.length >= 2) {
            this.vectorTileFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: line,
              },
              properties: {
                taskId: task.taskId,
                method,
              },
            });
          }
          if (this.writer && this.writerReady) {
            const row = {
              taskId: task.taskId,
              method,
                distance: res.distance,
                duration: res.duration,
                startLon: pts[0]?.[0],
                startLat: pts[0]?.[1],
                endLon: pts[1]?.[0],
                endLat: pts[1]?.[1],
              };
              await this.writer.writeRows([row]);
            }
          break;
        }
        case 'location_resolution':
        case 'validation':
          // no-op demo
          break;
        case 'optimization':
          await this.generateVectorTiles(task.nodeId);
          break;
      }
      task.status = 'completed';
    } catch (error: unknown) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      this.updateProgress({ failed: (this.getProgress().failed || 0) + 1, currentTask: `error:${task.taskType}` });
      if (this.config.routeGeneration.retryOnFailure) {
        // rudimentary retry with small delay
        const max = this.config.routeGeneration.maxRetries || 0;
        let done = false;
        for (let i = 0; i < max && !done; i++) {
          await this.processTask({ ...task, status: 'pending' });
          done = true;
        }
      }
    }
  }

  private getLaneSemaphore(method: string): Semaphore {
    let sem = this.laneSemaphores.get(method);
    if (!sem) {
      const cap = this.laneConfig[method] ?? 4;
      sem = new Semaphore(cap);
      this.laneSemaphores.set(method, sem);
    }
    return sem;
  }

  private async generateVectorTiles(nodeId: NodeId): Promise<void> {
    if (this.vectorTileFeatures.length === 0) {
      return;
    }
    const featureCollection = {
      type: 'FeatureCollection',
      features: this.vectorTileFeatures,
    } as const;
    const vectorTiles = (this.config as RouteBatchConfig & {
      vectorTiles?: {
        minZoom?: number;
        maxZoom?: number;
        buffer?: number;
        inputFormat?: 'geojson' | 'flatgeobuf';
        inputCompression?: 'gzip' | 'none';
      };
    }).vectorTiles;
    const minZoom = vectorTiles?.minZoom ?? 4;
    const maxZoom = vectorTiles?.maxZoom ?? 12;
    const buffer = vectorTiles?.buffer ?? 8;
    const inputFormat = vectorTiles?.inputFormat ?? 'geojson';
    const inputCompression = vectorTiles?.inputCompression ?? 'none';
    const bytes = inputFormat === 'flatgeobuf'
      ? await encodeFlatGeobufFromFeatureCollection(featureCollection)
      : new TextEncoder().encode(JSON.stringify(featureCollection)).buffer;
    const client = await createStageWorkerClient();
    try {
      const vectorTileClient = client.vectortile;
      if (!vectorTileClient) {
        throw new Error('vectortile client unavailable');
      }
      const result = await runVectorTileStage({
        bufferId: nodeId,
        buffer: bytes,
        contentType: 'application/json',
        config: {
          format: 'mvt',
          compression: 'none',
          minZoom,
          maxZoom,
          buffer,
          inputFormat,
          inputCompression,
        },
      }, vectorTileClient);

      const tiles = result.tiles;
      if (tiles.length === 0) return;
      const db = new RouteDB();
      await db.open?.();
      const records: RouteVectorTileRecord[] = [];
      for (const tile of tiles) {
        const data = await vectorTileClient.getTile(nodeId, tile.z, tile.x, tile.y);
        if (!data) continue;
        records.push({
          tileId: `${nodeId}-${tile.z}-${tile.x}-${tile.y}`,
          nodeId,
          z: tile.z,
          x: tile.x,
          y: tile.y,
          data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          size: data.byteLength,
          contentType: 'application/vnd.mapbox-vector-tile',
          timestamp: Date.now(),
        });
      }
      if (records.length > 0) {
        await db.vectorTiles.where('nodeId').equals(nodeId).delete();
        await db.vectorTiles.bulkPut(records);
      }
    } finally {
      (client as { terminate?: () => void }).terminate?.();
    }
  }
}

function abortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Route batch aborted', 'AbortError');
  }
  const error = new Error('Route batch aborted');
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private count: number;

  constructor(private capacity: number) {
    this.count = capacity;
  }

  acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise((r) => this.queue.push(r));
  }

  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      if(resolve) {resolve()}
    } else this.count = Math.min(this.count + 1, this.capacity);
  }
}

function pickNumeric(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
  }
  return out;
}
