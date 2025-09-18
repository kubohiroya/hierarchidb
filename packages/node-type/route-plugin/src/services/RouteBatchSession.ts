import {
  AbstractBatchSession,
  type BaseBatchConfig,
  type StandardProgressEvent,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';
import { BatchService } from '@hierarchidb/batch';
import { RouteDatabase } from '../database/RouteDatabase.js';
import type { RouteGenerationConfig } from '../entities/RouteEntity.js';
import { RouteGenerator } from './RouteGenerator.js';
import { TabularWriter } from '@hierarchidb/tabular-store';

export interface RouteBatchConfig extends BaseBatchConfig {
  routeGeneration: {
    method: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
    parallel: boolean;
    maxConcurrent: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  locationResolution?: { batchSize: number; cacheResults: boolean; fallbackToCoordinates: boolean };
  validation?: {
    checkLocationExists: boolean;
    checkDuplicateRoutes: boolean;
    validateDistance: boolean;
    maxDistanceKm?: number
  };
  /** Optional per-lane concurrency caps override (e.g. { osm_route: 1, searoute: 4 }) */
  laneCaps?: Partial<Record<'osm_route' | 'searoute' | 'direct' | 'great_circle' | 'custom', number>>;
}

export interface RouteBatchTask {
  taskId: string;
  treeNodeId: NodeId;
  sessionId: string;
  taskType: 'route_generation' | 'location_resolution' | 'validation' | 'optimization';
  stage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  index: number;
  routeData?: {
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    method: string;
    methodOptions?: any;
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    estimatedDistance?: number;
  };
  error?: string;
}

export class RouteBatchSession extends AbstractBatchSession<RouteBatchConfig, RouteBatchTask, void> {
  private db: RouteDatabase;
  private tasks: RouteBatchTask[] = [];
  private laneSemaphores = new Map<string, Semaphore>();
  private laneConfig: Record<string, number> = { osm_route: 1, searoute: 3, direct: 64, great_circle: 64, custom: 8 };
  private generator: RouteGenerator;
  private writer: TabularWriter | null = null;
  private writerReady = false;

  constructor(sessionId: string, nodeId: NodeId, config: RouteBatchConfig, tasks: RouteBatchTask[], private progressSink?: (ev: ProgressEvent) => void, deps?: {
    generator?: RouteGenerator
  }) {
    super(sessionId, nodeId, config);
    this.db = new RouteDatabase();
    this.tasks = tasks;
    this.generator = deps?.generator ?? new RouteGenerator();
    // Apply lane cap overrides from config and env/global flags (best-effort, safe parse)
    try {
      if (config.laneCaps) {
        this.laneConfig = { ...this.laneConfig, ...pickNumeric(config.laneCaps) };
      }
    } catch {
    }
    try {
      const envJson = (typeof process !== 'undefined' && (process as any)?.env?.ROUTE_LANE_CAPS) || undefined;
      const flagCaps = (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.ROUTE_LANE_CAPS) || undefined;
      const parsed = typeof envJson === 'string' ? JSON.parse(envJson) : flagCaps;
      if (parsed && typeof parsed === 'object') {
        this.laneConfig = { ...this.laneConfig, ...pickNumeric(parsed) };
      }
    } catch {
    }
  }

  protected async onInitialize(): Promise<void> {
    await this.db.routeCursors?.put({
      sessionId: this.sessionId,
      completed: 0,
      total: this.tasks.length,
      updatedAt: Date.now(),
      paused: false,
    } as any);
    const enabled = (typeof process !== 'undefined' && (process as any)?.env?.ROUTE_TABULAR === '1') || (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.ROUTE_TABULAR === true);
    if (enabled) {
      this.writer = new TabularWriter('route');
      const columns = ['taskId', 'method', 'distance', 'duration', 'startLon', 'startLat', 'endLon', 'endLat'];
      await this.writer.begin({ filename: `route-${this.sessionId}.json`, columns });
      this.writerReady = true;
    }
  }

  protected async onStart(): Promise<void> {
  }

  protected async onPause(): Promise<void> {
  }

  protected async onResume(): Promise<void> {
  }

  protected async onCancel(): Promise<void> {
  }

  protected async onComplete(): Promise<void> {
    if (this.writer && this.writerReady) {
      try {
        const { tableId } = await this.writer.commit();
        await (this.db.table('routeCursors') as any)?.update(this.sessionId, { tableId });
      } catch {
      }
    }
  }

  protected async processBatch(): Promise<void> {
    const maxConcurrent = this.config.routeGeneration.maxConcurrent;
    const batch = new BatchService();
    let completed = 0;
    await batch.mapChunks(this.tasks, async (task, _i) => {
      if (this.isAborted()) throw new Error('aborted');
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
      completed++;
      await this.db.routeCursors?.put({
        sessionId: this.sessionId,
        completed,
        total: this.tasks.length,
        updatedAt: Date.now(),
        paused: this.getState().status === 'paused',
      } as any);
      this.updateProgress({
        total: this.tasks.length,
        completed,
        currentStage: task.stage,
        currentTask: `Processing ${task.taskType}`,
      });
      // Pause handling (poll cursor flag)
      for (; ;) {
        const cur = await (this.db.routeCursors as any)?.get(this.sessionId);
        if (!cur?.paused) break;
        this.updateProgress({ currentTask: `paused:${task.taskType}` });
        await this.delay(250);
      }
    }, { concurrency: maxConcurrent });
  }

  protected onProgressUpdate(_p: any): void {
    const p = this.getProgress();
    const event: StandardProgressEvent = {
      sessionId: this.sessionId,
      stage: p.currentStage || 'processing',
      total: p.total,
      completed: p.completed,
      failed: p.failed,
      percentage: Math.round(p.percentage),
      currentTask: p.currentTask || '',
    };
    this.onStandardProgressUpdate(event);
  }

  protected onStandardProgressUpdate(event: StandardProgressEvent): void {
    // Convert to legacy ProgressEvent for compatibility
    const legacyEvent: ProgressEvent = {
      sessionId: event.sessionId,
      stage: event.stage,
      total: event.total,
      completed: event.completed,
      failed: event.failed,
      percentage: event.percentage,
      currentTask: event.currentTask || '',
    };
    try {
      this.progressSink?.(legacyEvent);
    } catch {
    }
  }

  private async processTask(task: RouteBatchTask): Promise<void> {
    try {
      switch (task.taskType) {
        case 'route_generation': {
          const method = (task.routeData?.method || this.config.routeGeneration.method) as RouteGenerationConfig['method'];
          const start = (task.routeData as any)?.startCoordinates as [number, number] | undefined;
          const end = (task.routeData as any)?.endCoordinates as [number, number] | undefined;
          const pts: [number, number][] = start && end ? [start, end] : [[0, 0], [1, 1]];
          const res = await this.generator.generate(pts, { method, options: (task.routeData as any)?.methodOptions });
          try {
            // @ts-ignore best-effort
            await (this.db.table('routeResults') as any)?.put({
              id: `${this.sessionId}:${task.taskId}`,
              sessionId: this.sessionId,
              taskId: task.taskId,
              method,
              lineGeometry: res.lineGeometry,
              distance: res.distance,
              duration: res.duration,
              createdAt: Date.now(),
            });
          } catch {
          }
          try {
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
          } catch {
          }
          break;
        }
        case 'location_resolution':
        case 'validation':
        case 'optimization':
          // no-op demo
          break;
      }
      task.status = 'completed';
    } catch (e: any) {
      task.status = 'failed';
      task.error = e?.message || String(e);
      this.updateProgress({ failed: (this.getProgress().failed || 0) + 1, currentTask: `error:${task.taskType}` });
      if (this.config.routeGeneration.retryOnFailure) {
        // rudimentary retry with small delay
        const max = this.config.routeGeneration.maxRetries || 0;
        let done = false;
        for (let i = 0; i < max && !done; i++) {
          await this.delay(150);
          try {
            await this.processTask({ ...task, status: 'pending' });
            done = true;
          } catch {
          }
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
      const resolve = this.queue.shift()!;
      resolve();
    } else this.count = Math.min(this.count + 1, this.capacity);
  }
}

function pickNumeric(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && isFinite(v) && v > 0) out[k] = Math.floor(v);
  }
  return out;
}
