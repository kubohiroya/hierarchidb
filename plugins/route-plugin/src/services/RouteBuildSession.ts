import { AbstractBuildSession } from '@hierarchidb/batch';
import type { BuildProgressEvent } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteGenerationConfig, RouteGenerationMethod } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import { RouteGenerator } from '@hierarchidb/route-engine';
import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import { updateTask, type VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';

export type RouteBuildTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RouteBuildTaskType = 'location_resolution' | 'route_generation' | 'validation' | 'optimization';

export type RouteBuildTask = {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
  taskType: RouteBuildTaskType;
  stage: string;
  status: RouteBuildTaskStatus;
  index: number;
  routeData?: {
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    method?: RouteGenerationMethod;
    methodOptions?: RouteGenerationConfig['options'];
  };
  error?: string;
};

export type RouteBuildSessionDeps = {
  generator?: { generate: (points: [number, number][], config: RouteGenerationConfig) => Promise<unknown> };
  taskQueue?: VtTaskQueueDb;
};

type LaneGate = {
  limit: number;
  active: number;
  queue: Array<() => void>;
};

const DEFAULT_LANE_CAPS: Record<string, number> = {
  osm_route: 1,
  searoute: 3,
  direct: 64,
  great_circle: 64,
  custom: 8,
};

export class RouteBuildSession extends AbstractBuildSession<RouteBuildConfig> {
  private readonly tasks: RouteBuildTask[];
  private readonly generator: RouteBuildSessionDeps['generator'];
  private readonly taskQueue?: VtTaskQueueDb;

  constructor(nodeId: NodeId, config: RouteBuildConfig, tasks: RouteBuildTask[], deps?: RouteBuildSessionDeps) {
    super(nodeId, config);
    this.tasks = tasks;
    this.generator = deps?.generator ?? new RouteGenerator();
    this.taskQueue = deps?.taskQueue;
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');

    const total = this.tasks.length;
    let completed = 0;
    let failed = 0;
    this.updateProgress({ total, completed, failed }, 'idle');

    const locationTasks = this.tasks.filter((task) => task.taskType === 'location_resolution');
    const routeTasks = this.tasks.filter((task) => task.taskType === 'route_generation');
    const validationTasks = this.tasks.filter((task) => task.taskType === 'validation');
    const optimizationTasks = this.tasks.filter((task) => task.taskType === 'optimization');

    for (const task of locationTasks) {
      await this.runTask(task, signal, () => Promise.resolve());
      ({ completed, failed } = this.bumpCounts(task, completed, failed));
      this.updateProgress({ total, completed, failed }, task.stage);
    }

    if (routeTasks.length > 0) {
      const parallel = Boolean(this.config.routeGeneration?.parallel);
      const maxConcurrent = Math.max(1, this.config.routeGeneration?.maxConcurrent ?? 1);
      const globalGate = createGate(parallel ? maxConcurrent : 1);
      const laneGates = new Map<string, LaneGate>();

      const runners = routeTasks.map((task) => this.runWithGates(task, signal, globalGate, laneGates)
        .then(() => {
          ({ completed, failed } = this.bumpCounts(task, completed, failed));
          this.updateProgress({ total, completed, failed }, task.stage);
        }));
      await Promise.all(runners);
    }

    for (const task of validationTasks) {
      await this.runTask(task, signal, () => Promise.resolve());
      ({ completed, failed } = this.bumpCounts(task, completed, failed));
      this.updateProgress({ total, completed, failed }, task.stage);
    }

    for (const task of optimizationTasks) {
      await this.runTask(task, signal, () => Promise.resolve());
      ({ completed, failed } = this.bumpCounts(task, completed, failed));
      this.updateProgress({ total, completed, failed }, task.stage);
    }

    if (failed > 0) {
      throw new Error('Route build completed with failures');
    }
  }

  protected onBuildProgressEvent(_event: BuildProgressEvent): void {
  }

  private async runWithGates(
    task: RouteBuildTask,
    signal: AbortSignal,
    globalGate: LaneGate,
    laneGates: Map<string, LaneGate>,
  ): Promise<void> {
    const method = task.routeData?.method ?? this.config.routeGeneration.method;
    const laneGate = getLaneGate(laneGates, method, this.config.laneCaps);

    await acquire(globalGate);
    await acquire(laneGate);
    try {
      await this.runTask(task, signal, () => this.runRouteTask(task, method, signal));
    } finally {
      release(laneGate);
      release(globalGate);
    }
  }

  private async runTask(task: RouteBuildTask, signal: AbortSignal, work: () => Promise<void>): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');
    task.status = 'processing';
    await this.updateTaskQueue(task, { status: 'running', startedAt: Date.now(), progress: 0 });
    this.updateProgress({ total: this.tasks.length }, task.stage);

    try {
      await work();
      task.status = 'completed';
      await this.updateTaskQueue(task, { status: 'completed', progress: 100, completedAt: Date.now() });
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      await this.updateTaskQueue(task, { status: 'failed', errorMessage: task.error });
    }
  }

  private async runRouteTask(task: RouteBuildTask, method: RouteGenerationMethod, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');
    const start = task.routeData?.startCoordinates;
    const end = task.routeData?.endCoordinates;
    if (!start || !end) {
      throw new Error('Route build task missing coordinates');
    }
    const config: RouteGenerationConfig = {
      method,
      options: task.routeData?.methodOptions,
    };
    await this.generator?.generate([start, end], config);
  }

  private async updateTaskQueue(task: RouteBuildTask, updates: Partial<TaskQueueRecord>): Promise<void> {
    if (!this.taskQueue) return;
    await updateTask(this.taskQueue, task.taskId, updates);
  }

  private bumpCounts(task: RouteBuildTask, completed: number, failed: number): { completed: number; failed: number } {
    if (task.status === 'completed') {
      return { completed: completed + 1, failed };
    }
    if (task.status === 'failed') {
      return { completed, failed: failed + 1 };
    }
    return { completed, failed };
  }
}

function createGate(limit: number): LaneGate {
  return {
    limit: Math.max(1, limit),
    active: 0,
    queue: [],
  };
}

async function acquire(gate: LaneGate): Promise<void> {
  if (gate.active < gate.limit) {
    gate.active += 1;
    return;
  }
  await new Promise<void>((resolve) => gate.queue.push(resolve));
  gate.active += 1;
}

function release(gate: LaneGate): void {
  gate.active = Math.max(0, gate.active - 1);
  const next = gate.queue.shift();
  if (next && gate.active < gate.limit) {
    next();
  }
}

function getLaneGate(
  lanes: Map<string, LaneGate>,
  method: RouteGenerationMethod,
  overrides: RouteBuildConfig['laneCaps'] | undefined,
): LaneGate {
  const key = method ?? 'direct';
  const existing = lanes.get(key);
  if (existing) return existing;
  const cap = overrides?.[key] ?? DEFAULT_LANE_CAPS[key] ?? 1;
  const gate = createGate(cap);
  lanes.set(key, gate);
  return gate;
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}
