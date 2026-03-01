import { AbstractBuildSession } from '@hierarchidb/build-runtime-services';
import type { BuildProgressEvent, TaskStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteGenerationConfig, RouteGenerationMethod } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import { RouteGenerator } from '@hierarchidb/route-engine';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import { runStageTasks } from '@hierarchidb/vt-orchestrator';

export type RouteBuildTaskStage = 'source' | 'geometry' | 'tileEmit';

export type RouteBuildTask = {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
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
  routeStage: RouteBuildTaskStage;
  routeData?: RouteBuildTask['routeData'];
};

export type RouteBuildSessionDeps = {
  generator?: {
    generate: (points: [number, number][], config: RouteGenerationConfig) => Promise<unknown>;
  };
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
    this.updateProgress({ total, completed, failed });

    const resolveTaskFilter = (routeStage: RouteBuildTaskStage) =>
      (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => task.inputData?.routeStage === routeStage;

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'source',
      taskFilter: resolveTaskFilter('source'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.handleSourceRouteTask(task),
      maxConcurrent: this.config.routeGeneration?.parallel ? Math.max(1, this.config.routeGeneration.maxConcurrent) : 1,
      failureHandling: 'continue',
      lanePolicy: {
        enabled: true,
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.resolveRouteLane(task),
        maxConcurrentForLane: (lane: string) => {
          const override = this.config.laneCaps?.[lane as RouteGenerationMethod];
          return override ?? DEFAULT_LANE_CAPS[lane] ?? 1;
        },
      },
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'source');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'geometry',
      taskFilter: resolveTaskFilter('geometry'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.handleGeometryRouteTask(task),
      maxConcurrent: this.config.geometryConfig?.maxConcurrent ?? 1,
      failureHandling: 'continue',
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'geometry');

    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'tileEmit',
      taskFilter: resolveTaskFilter('tileEmit'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) => this.handleTileEmitRouteTask(task),
      failureHandling: 'continue',
    });
    ({ completed, failed } = this.countTaskResults());
    this.updateProgress({ total, completed, failed }, 'tileEmit');

    if (failed > 0) {
      throw new Error('Route build completed with failures');
    }
  }

  protected onBuildProgressEvent(_event: BuildProgressEvent): void {}

  private async handleSourceRouteTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'source') {
      return this.failRouteTask(localTask, 'source', `Unexpected route task stage. expected=source, actual=${localTask.stage}`);
    }

    localTask.status = 'running';
    localTask.error = undefined;

    const method = localTask.routeData?.method ?? this.config.routeGeneration.method;
    const options = localTask.routeData?.methodOptions;
    const start = localTask.routeData?.startCoordinates;
    const end = localTask.routeData?.endCoordinates;

    if (!start || !end) {
      const message = 'Route build task missing coordinates';
      return this.failRouteTask(localTask, 'source', message);
    }

    await this.runRouteTask([start, end], method, options);

    return this.completeRouteTask(localTask, 'source');
  }

  private async handleGeometryRouteTask(task: TaskQueueRecord<RouteBuildTaskQueueInput>): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'geometry') {
      return this.failRouteTask(localTask, 'geometry', `Unexpected route task stage. expected=geometry, actual=${localTask.stage}`);
    }

    localTask.status = 'running';
    localTask.error = undefined;
    // Geometry-stage logic for route tasks will be implemented as needed.
    return this.completeRouteTask(localTask, 'geometry');
  }

  private async handleTileEmitRouteTask(task: TaskQueueRecord<RouteBuildTaskQueueInput>): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'tileEmit') {
      return this.failRouteTask(localTask, 'tileEmit', `Unexpected route task stage. expected=tileEmit, actual=${localTask.stage}`);
    }

    localTask.status = 'running';
    localTask.error = undefined;
    // TileEmit-stage logic for route tasks will be implemented as needed.
    return this.completeRouteTask(localTask, 'tileEmit');
  }

  private async runRouteTask(
    points: [number, number][],
    method: RouteGenerationMethod,
    options: RouteGenerationConfig['options'],
  ): Promise<void> {
    const config: RouteGenerationConfig = {
      method,
      options,
    };
    await this.generator?.generate(points, config);
  }

  private completeRouteTask(task: RouteBuildTask, stage: RouteBuildTaskStage): { status: 'completed'; progress: number } {
    task.status = 'completed';
    task.error = undefined;
    this.updateProgressByStage(stage);
    return {
      status: 'completed',
      progress: 100,
    };
  }

  private failRouteTask(task: RouteBuildTask, stage: RouteBuildTaskStage, error: string): { status: 'completed'; progress: number } {
    task.status = 'failed';
    task.error = error;
    this.updateProgressByStage(stage);
    throw new Error(error);
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

  private updateProgressByStage(stage: RouteBuildTaskStage): void {
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
