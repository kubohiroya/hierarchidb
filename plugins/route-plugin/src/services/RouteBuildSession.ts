import { AbstractBuildSession } from '@hierarchidb/batch-runtime-services';
import type { BuildProgressEvent, TaskStatus } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteGenerationConfig, RouteGenerationMethod } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import { RouteGenerator } from '@hierarchidb/route-engine';
import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import { runStageTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskStage } from '@hierarchidb/batch-api';

export type RouteBuildTaskType = 'location_resolution' | 'route_generation' | 'validation' | 'optimization';
export type RouteBuildTaskStage = 'location-resolution' | 'route-generation' | 'validation' | 'optimization';

export type RouteBuildTask = {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
  taskType: RouteBuildTaskType;
  stage: RouteBuildTaskStage;
  status: TaskStatus;
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

export type RouteBuildTaskQueueInput = {
  taskType: RouteBuildTaskType;
  routeData?: RouteBuildTask['routeData'];
};

export type RouteBuildSessionDeps = {
  generator?: { generate: (points: [number, number][], config: RouteGenerationConfig) => Promise<unknown> };
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
  private readonly tasksById: Map<string, RouteBuildTask>;
  private readonly generator: RouteBuildSessionDeps['generator'];

  constructor(nodeId: NodeId, config: RouteBuildConfig, tasks: RouteBuildTask[], deps?: RouteBuildSessionDeps) {
    super(nodeId, config);
    this.tasks = tasks;
    this.tasksById = new Map(tasks.map((task) => [task.taskId, task]));
    this.generator = deps?.generator ?? new RouteGenerator();
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');

    const total = this.tasks.length;
    let { completed, failed } = this.countTaskResults();
    this.updateProgress({ total, completed, failed }, 'idle');

    const resolveTaskFilter = (taskType: RouteBuildTaskType) =>
      (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => task.inputData?.taskType === taskType;

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'fetch',
      taskFilter: resolveTaskFilter('location_resolution'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleNoopRouteTask(task, 'location_resolution', 'location-resolution'),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'location-resolution');

    const globalMaxConcurrent = Math.max(1, this.config.routeGeneration?.maxConcurrent ?? 1);
    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'transform',
      taskFilter: resolveTaskFilter('route_generation'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>, _signal: AbortSignal) =>
        this.handleRouteGenerationTask(task, signal),
      maxConcurrent: this.config.routeGeneration?.parallel ? globalMaxConcurrent : 1,
      failureHandling: 'continue',
      lanePolicy: {
        enabled: true,
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.resolveRouteLane(task),
        maxConcurrentForLane: (lane: string) => {
          const override = this.config.laneCaps?.[lane as RouteGenerationMethod];
          return override ?? DEFAULT_LANE_CAPS[lane] ?? 1;
        },
      },
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>, signal?: AbortSignal) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'route-generation');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'transform',
      taskFilter: resolveTaskFilter('validation'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleNoopRouteTask(task, 'validation', 'validation'),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'validation');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'vt',
      taskFilter: resolveTaskFilter('optimization'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleNoopRouteTask(task, 'optimization', 'optimization'),
      failureHandling: 'continue',
    } as {
      nodeId: TaskQueueRecord['nodeId'];
      stage: TaskStage;
      handler: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => Promise<{ status: 'completed'; progress: number }>;
      taskFilter?: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => boolean;
      maxConcurrent?: number;
      failureHandling?: 'continue' | 'stop' | 'skip';
      lanePolicy?: {
        enabled: boolean;
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => string;
        maxConcurrentForLane?: (lane: string, task: TaskQueueRecord<RouteBuildTaskQueueInput>) => number;
      };
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'optimization');

    if (failed > 0) {
      throw new Error('Route build completed with failures');
    }
  }

  protected onBuildProgressEvent(_event: BuildProgressEvent): void {
  }

  private async handleRouteGenerationTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
    signal: AbortSignal,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }

    localTask.status = 'running';
    localTask.error = undefined;
    const method = localTask.routeData?.method ?? this.config.routeGeneration.method;
    const options = localTask.routeData?.methodOptions;
    const start = localTask.routeData?.startCoordinates;
    const end = localTask.routeData?.endCoordinates;

    if (!start || !end) {
      const message = 'Route build task missing coordinates';
      localTask.status = 'failed';
      localTask.error = message;
      this.updateProgressByTaskType(localTask.stage);
      throw new Error(message);
    }

    await this.runRouteTask([start, end], method, options, signal);

    localTask.status = 'completed';
    this.updateProgressByTaskType(localTask.stage);
    return {
      status: 'completed',
      progress: 100,
    };
  }

  private async handleNoopRouteTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
    taskType: RouteBuildTaskType,
    stage: RouteBuildTaskStage,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.taskType !== taskType) {
      localTask.status = 'failed';
      const error = `Unexpected route task type. expected=${taskType}, actual=${localTask.taskType}`;
      localTask.error = error;
      this.updateProgressByTaskType(stage);
      throw new Error(error);
    }
    localTask.status = 'completed';
    localTask.error = undefined;
    this.updateProgressByTaskType(stage);
    return {
      status: 'completed',
      progress: 100,
    };
  }

  private async runRouteTask(
    points: [number, number][],
    method: RouteGenerationMethod,
    options: RouteGenerationConfig['options'],
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');
    const config: RouteGenerationConfig = {
      method,
      options,
    };
    await this.generator?.generate(points, config);
  }

  private resolveRouteLane(task: TaskQueueRecord<RouteBuildTaskQueueInput>): string {
    const fallbackMethod = this.config.routeGeneration.method;
    return task.inputData?.routeData?.method ?? fallbackMethod;
  }

  private countTaskResults(): { completed: number; failed: number } {
    let completed = 0;
    let failed = 0;
    for (const task of this.tasks) {
      if (task.status === 'completed') {
        completed += 1;
      } else if (task.status === 'failed') {
        failed += 1;
      }
    }
    return { completed, failed };
  }

  private findTask(taskId: string): RouteBuildTask | undefined {
    return this.tasksById.get(taskId);
  }

  private updateProgressByTaskType(stage: RouteBuildTaskStage): void {
    const { completed, failed } = this.countTaskResults();
    this.updateProgress({ total: this.tasks.length, completed, failed }, stage);
  }
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}
