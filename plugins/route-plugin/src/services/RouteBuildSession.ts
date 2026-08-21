import type {
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  TaskQueueRecord,
  TaskStatus,
} from '@hierarchidb/build-api';
import {
  AbstractBuildSession,
  type CanonicalBuildSessionEventSource,
} from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  RouteBuildConfig,
  RouteGenerationConfig,
  RouteGenerationMethod,
  RouteMode,
} from '@hierarchidb/route-api';
import type { RouteEnginesProvider, RouteGenerationResult } from '@hierarchidb/route-engine';
import { RouteGenerator } from '@hierarchidb/route-engine';
import {
  deleteTasksByNode,
  listTasksByStatus,
  runStageTasks,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import {
  persistRouteSourceArtifact,
  type RouteSourceArtifactOutput,
} from './persistRouteSourceArtifact.js';

export type RouteBuildTaskStage = 'source' | 'geometry' | 'tileEmit';

export type RouteBuildTask = {
  taskId: string;
  treeNodeId: NodeId;
  nodeId: NodeId;
  stage: RouteBuildTaskStage;
  status: TaskStatus;
  progress: number;
  version: number;
  index: number;
  routeData?: {
    startLocationId: NodeId;
    endLocationId: NodeId;
    startCoordinates: [number, number];
    endCoordinates: [number, number];
    routeMode: RouteMode;
    method: RouteGenerationMethod;
    methodOptions?: RouteGenerationConfig['options'];
    sourceKey: string;
    inputHash: string;
    bidirectional: boolean;
  };
  error?: string;
};

export type RouteBuildTaskQueueInput = {
  routeStage: RouteBuildTaskStage;
  routeData?: RouteBuildTask['routeData'];
  cacheKey?: string;
  inputHash?: string;
};

export type RouteBuildSessionDeps = {
  engines?: RouteEnginesProvider;
  generator?: {
    generate: (
      points: [number, number][],
      config: RouteGenerationConfig
    ) => Promise<RouteGenerationResult>;
  };
};

const DEFAULT_LANE_CAPS: Record<string, number> = {
  osm_route: 1,
  searoute: 3,
  direct: 64,
  great_circle: 64,
  custom: 8,
};

type RouteStageTiming = {
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt?: number;
};

export class RouteBuildSession
  extends AbstractBuildSession<RouteBuildConfig>
  implements CanonicalBuildSessionEventSource
{
  private readonly tasks: RouteBuildTask[];
  private readonly tasksById: Map<string, RouteBuildTask>;
  private readonly generator: RouteBuildSessionDeps['generator'];
  private readonly stageTiming = new Map<RouteBuildTaskStage, RouteStageTiming>();
  private readonly pendingTaskProgressUpdates: TaskProgressUpdatedEvent['payload'][] = [];
  private activeStage: RouteBuildTaskStage | null = null;

  constructor(
    nodeId: NodeId,
    config: RouteBuildConfig,
    tasks: RouteBuildTask[],
    deps?: RouteBuildSessionDeps
  ) {
    super(nodeId, config);
    this.tasks = tasks;
    this.tasksById = new Map(tasks.map((task) => [task.taskId, task]));
    this.generator = deps?.generator ?? new RouteGenerator(deps?.engines);
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError('Route build aborted');

    const total = this.tasks.length;
    let { completed, failed } = this.countTaskResults();

    const resolveTaskFilter =
      (routeStage: RouteBuildTaskStage) => (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        task.inputData?.routeStage === routeStage;

    this.beginStage('source');
    this.updateProgress({ total, completed, failed }, 'source');
    await runStageTasks<RouteBuildTaskQueueInput, RouteSourceArtifactOutput>({
      nodeId: this.nodeId,
      stage: 'source',
      taskFilter: resolveTaskFilter('source'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleSourceRouteTask(task, signal),
      maxConcurrent: this.config.routeGeneration.parallel
        ? requirePositiveInteger(
            'routeGeneration.maxConcurrent',
            this.config.routeGeneration.maxConcurrent
          )
        : 1,
      failureHandling: 'continue',
      abortController: this.ensureAbortController(),
      lanePolicy: {
        enabled: true,
        laneOfTask: (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
          this.resolveRouteLane(task),
        maxConcurrentForLane: (lane: string) => {
          const override = this.config.laneCaps?.[lane as RouteGenerationMethod];
          if (override !== undefined) {
            return requirePositiveInteger(`laneCaps.${lane}`, override);
          }
          const defaultCap = DEFAULT_LANE_CAPS[lane];
          if (defaultCap === undefined) {
            throw new Error(`Route source task has unsupported generation lane: ${lane}`);
          }
          return defaultCap;
        },
      },
    });
    requireNotAborted(signal, 'Route build paused during source stage');
    ({ completed, failed } = this.countTaskResults());
    this.completeStage('source');
    this.updateProgress({ total, completed, failed }, 'source');

    this.beginStage('geometry');
    this.updateProgress({ total, completed, failed }, 'geometry');
    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'geometry',
      taskFilter: resolveTaskFilter('geometry'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleGeometryRouteTask(task),
      maxConcurrent: this.config.geometryConfig?.maxConcurrent ?? 1,
      failureHandling: 'continue',
      abortController: this.ensureAbortController(),
    });
    requireNotAborted(signal, 'Route build paused during geometry stage');
    ({ completed, failed } = this.countTaskResults());
    this.completeStage('geometry');
    this.updateProgress({ total, completed, failed }, 'geometry');

    this.beginStage('tileEmit');
    this.updateProgress({ total, completed, failed }, 'tileEmit');
    await runStageTasks<RouteBuildTaskQueueInput>({
      nodeId: this.nodeId,
      stage: 'tileEmit',
      taskFilter: resolveTaskFilter('tileEmit'),
      handler: async (task: TaskQueueRecord<RouteBuildTaskQueueInput>) =>
        this.handleTileEmitRouteTask(task),
      failureHandling: 'continue',
      abortController: this.ensureAbortController(),
    });
    requireNotAborted(signal, 'Route build paused during tileEmit stage');
    ({ completed, failed } = this.countTaskResults());
    this.completeStage('tileEmit');
    this.updateProgress({ total, completed, failed }, 'tileEmit');

    if (failed > 0) {
      throw new Error('Route build completed with failures');
    }
  }

  getCanonicalStageSnapshot(): StageSnapshotUpdatedEvent['payload'] | null {
    if (!this.activeStage) return null;
    const timing = this.stageTiming.get(this.activeStage);
    if (!timing) {
      throw new Error(`Route stage ${this.activeStage} is active without timing`);
    }
    return {
      stageId: this.activeStage,
      tasks: this.tasks
        .filter((task) => task.stage === this.activeStage)
        .map((task) => ({
          taskId: task.taskId,
          stage: task.stage,
          status: task.status,
          progress: task.progress,
          version: task.version,
          errorMessage: task.error,
        })),
      ...timing,
    };
  }

  takeCanonicalTaskProgressUpdates(): TaskProgressUpdatedEvent['payload'][] {
    return this.pendingTaskProgressUpdates.splice(0);
  }

  private async handleSourceRouteTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>,
    signal: AbortSignal
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'source') {
      return this.failRouteTask(
        localTask,
        'source',
        `Unexpected route task stage. expected=source, actual=${localTask.stage}`
      );
    }

    localTask.status = 'running';
    localTask.error = undefined;
    this.updateRouteTaskProgress(localTask, 0);
    this.updateProgressByStage('source');

    const routeData = localTask.routeData;
    if (!routeData) {
      return this.failRouteTask(localTask, 'source', 'Route source task data is required');
    }

    try {
      const generationStartedAt = Date.now();
      const generationResult = await this.runRouteTask(
        [routeData.startCoordinates, routeData.endCoordinates],
        routeData.method,
        routeData.methodOptions
      );
      requireNotAborted(signal, 'Route source task was paused');
      const outputData = await persistRouteSourceArtifact({
        nodeId: this.nodeId,
        routeMode: routeData.routeMode,
        generationMethod: routeData.method,
        identity: {
          sourceKey: routeData.sourceKey,
          inputHash: routeData.inputHash,
          bidirectional: routeData.bidirectional,
          from: {
            locationId: routeData.startLocationId,
            coordinates: routeData.startCoordinates,
          },
          to: {
            locationId: routeData.endLocationId,
            coordinates: routeData.endCoordinates,
          },
        },
        generationResult,
        generationTimeMs: Date.now() - generationStartedAt,
      });
      requireNotAborted(signal, 'Route source artifact persistence was paused');
      return this.completeRouteTask(localTask, 'source', outputData);
    } catch (error) {
      if (isAbortError(error)) throw error;
      const message = error instanceof Error ? error.message : String(error);
      return this.failRouteTask(localTask, 'source', message);
    }
  }

  private async handleGeometryRouteTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'geometry') {
      return this.failRouteTask(
        localTask,
        'geometry',
        `Unexpected route task stage. expected=geometry, actual=${localTask.stage}`
      );
    }

    localTask.status = 'running';
    localTask.error = undefined;
    this.updateRouteTaskProgress(localTask, 0);
    this.updateProgressByStage('geometry');
    // Geometry-stage logic for route tasks will be implemented as needed.
    return this.completeRouteTask(localTask, 'geometry');
  }

  private async handleTileEmitRouteTask(
    task: TaskQueueRecord<RouteBuildTaskQueueInput>
  ): Promise<{ status: 'completed'; progress: number }> {
    const localTask = this.findTask(task.taskId);
    if (!localTask) {
      throw new Error(`Unknown route task ${task.taskId}`);
    }
    if (localTask.stage !== 'tileEmit') {
      return this.failRouteTask(
        localTask,
        'tileEmit',
        `Unexpected route task stage. expected=tileEmit, actual=${localTask.stage}`
      );
    }

    localTask.status = 'running';
    localTask.error = undefined;
    this.updateRouteTaskProgress(localTask, 0);
    this.updateProgressByStage('tileEmit');
    // TileEmit-stage logic for route tasks will be implemented as needed.
    return this.completeRouteTask(localTask, 'tileEmit');
  }

  private async runRouteTask(
    points: [number, number][],
    method: RouteGenerationMethod,
    options: RouteGenerationConfig['options']
  ): Promise<RouteGenerationResult> {
    const config: RouteGenerationConfig = {
      method,
      options,
    };
    if (!this.generator) {
      throw new Error('Route generator is required');
    }
    return this.generator.generate(points, config);
  }

  private completeRouteTask<TOutput>(
    task: RouteBuildTask,
    stage: RouteBuildTaskStage,
    outputData?: TOutput
  ): { status: 'completed'; progress: number; outputData?: TOutput } {
    task.status = 'completed';
    task.error = undefined;
    this.updateRouteTaskProgress(task, 100);
    this.updateProgressByStage(stage);
    return {
      status: 'completed',
      progress: 100,
      ...(outputData === undefined ? {} : { outputData }),
    };
  }

  private failRouteTask(task: RouteBuildTask, stage: RouteBuildTaskStage, error: string): never {
    task.status = 'failed';
    task.error = error;
    this.updateRouteTaskProgress(task, task.progress, error);
    this.updateProgressByStage(stage);
    throw new Error(error);
  }

  private resolveRouteLane(task: TaskQueueRecord<RouteBuildTaskQueueInput>): string {
    const method = task.inputData?.routeData?.method;
    if (method === undefined) {
      throw new Error(`Route source task ${task.taskId} is missing generation method`);
    }
    return method;
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

  private beginStage(stage: RouteBuildTaskStage): void {
    if (this.stageTiming.has(stage)) {
      throw new Error(`Route stage ${stage} has already started`);
    }
    this.activeStage = stage;
    this.stageTiming.set(stage, {
      stageStartedAt: Date.now(),
      stageInactiveMs: 0,
    });
  }

  private completeStage(stage: RouteBuildTaskStage): void {
    const timing = this.stageTiming.get(stage);
    if (!timing || this.activeStage !== stage) {
      throw new Error(`Route stage ${stage} cannot complete before it starts`);
    }
    timing.stageCompletedAt = Date.now();
  }

  private updateRouteTaskProgress(task: RouteBuildTask, value: number, message?: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Route task progress must be finite 0..100, received ${String(value)}`);
    }
    task.progress = value;
    task.version += 1;
    this.pendingTaskProgressUpdates.push({
      taskId: task.taskId,
      version: task.version,
      stageId: task.stage,
      value,
      message,
    });
  }

  protected override async onPause(): Promise<void> {
    for (const task of this.tasks) {
      if (task.status !== 'running') continue;
      task.status = 'queued';
      task.error = undefined;
      this.updateRouteTaskProgress(task, 0);
    }

    const taskQueue = new VtTaskQueueDb();
    const runningTasks = await listTasksByStatus(taskQueue, this.nodeId, 'running');
    await Promise.all(
      runningTasks.map((task) =>
        updateTask(taskQueue, task.taskId, {
          status: 'queued',
          progress: 0,
          startedAt: undefined,
          completedAt: undefined,
          errorMessage: undefined,
        })
      )
    );
  }

  protected override async onCancelQueued(): Promise<void> {
    this.tasks.splice(0);
    this.tasksById.clear();
    await deleteTasksByNode(new VtTaskQueueDb(), this.nodeId);
    this.updateProgress({ total: 0, completed: 0, failed: 0, skipped: 0 });
  }
}

function requireNotAborted(signal: AbortSignal, message: string): void {
  if (signal.aborted) throw abortError(message);
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function requirePositiveInteger(label: string, value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`Route build ${label} must be a positive integer`);
  }
  return value as number;
}
