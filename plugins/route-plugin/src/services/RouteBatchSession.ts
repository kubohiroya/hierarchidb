import { AbstractBatchSession, BatchService } from '@hierarchidb/batch-runtime-services';
import type { RouteGenerationConfig } from '../common/entities/RouteEntity.js';
import { RouteGenerator } from './RouteGenerator.js';
import { TabularWriter } from '@hierarchidb/tabular-store';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteBatchConfig } from '../common/types/BatchConfig.js';

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

  constructor(sessionId: string, nodeId: NodeId, config: RouteBatchConfig, tasks: RouteBatchTask[], deps?: {
    generator?: RouteGenerator
  }) {
    super(sessionId, nodeId, config);
    this.tasks = tasks;
    this.generator = deps?.generator ?? new RouteGenerator();
    // Apply lane cap overrides from config (best-effort, safe parse)
    if (config.laneCaps) {
      this.laneConfig = { ...this.laneConfig, ...pickNumeric(config.laneCaps) };
    }
  }

  protected async onInitialize(): Promise<void> {
    this.writer = new TabularWriter('route');
    const columns = ['taskId', 'method', 'distance', 'duration', 'startLon', 'startLat', 'endLon', 'endLat'];
    await this.writer.begin({ filename: `route-${this.sessionId}.json`, columns });
    this.writerReady = true;
  }

  protected async onStart(): Promise<void> {
  }

  protected async onPause(): Promise<void> {
  }

  protected async onResume(): Promise<void> {
  }

  protected async onCancel(): Promise<void> {}

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
        case 'optimization':
          // no-op demo
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
}

function abortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Route batch cancelled', 'AbortError');
  }
  const error = new Error('Route batch cancelled');
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
