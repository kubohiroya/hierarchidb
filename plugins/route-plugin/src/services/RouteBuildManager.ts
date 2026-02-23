/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Shape's build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';

import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import { RouteGenerator } from '@hierarchidb/route-engine';
import type { RouteEnginesProvider } from '@hierarchidb/route-engine';
import {
  RouteBuildSession,
  type RouteBuildTask,
  type RouteBuildTaskStage,
} from './RouteBuildSession.js';
import type { BuildProgressEvent } from '../../../../packages/build-api';
import { VtTaskQueueDb, deleteTasksByNode, putTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord, TaskStage } from '../../../../packages/build-api';

export type ProgressUpdate = { jobId: string; progress: number; phase: string; ts: number };
export type ProgressEmitter = { emit?: (event: ProgressUpdate) => void };
export type ProgressStore = { upsert?: (nodeId: string, record: ProgressUpdate) => void };

export type RouteBuildManagerDeps = {
  engines?: RouteEnginesProvider;
  generator?: {
    generate: (points: [number, number][], config: RouteGenerationConfig) => Promise<unknown>;
  };
  routeDB?: Awaited<ReturnType<typeof import('@hierarchidb/route-store').getRouteDB>>;
  locationResolver?: import('./LocationResolver.js').LocationResolver;
  emitter?: ProgressEmitter;
  store?: ProgressStore;
};

export type RouteBuildRouteInput = {
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  startLocationFeatureId?: string;
  endLocationFeatureId?: string;
  startCoordinates?: [number, number];
  endCoordinates?: [number, number];
  method?: RouteGenerationConfig['method'];
  methodOptions?: RouteGenerationConfig['options'];
};

const logRouteBuildWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[RouteBuildManager]', message, error);
};

/**
 * Route-specific build configuration
 */

export class RouteBuildManager {
  constructor(protected readonly deps?: RouteBuildManagerDeps) {}

  private routeSpecificTasks = new Map<NodeId, RouteBuildTask[]>();
  private activeSessions = new Map<NodeId, RouteBuildSession>();
  // Lane semaphores: enforce per-engine concurrency regardless of build size
  // private laneSemaphores = new Map<string, Semaphore>();
  // private laneConfig: Record<string, number> = {
  //   osm_route: 1,
  //   searoute: 3,
  //   direct: 64,
  //   great_circle: 64,
  //   custom: 8,
  // };

  /**
   * Start route build generation session
   */
  async startRouteBuildSession(
    nodeId: NodeId,
    config: RouteBuildConfig,
    routes: RouteBuildRouteInput[],
  ): Promise<NodeId> {
    const existingSession = this.activeSessions.get(nodeId);
    if (existingSession) return nodeId;

    // Create route-specific tasks
    const routeTasks: RouteBuildTask[] = [];

    // Phase 1: Location resolution tasks
    if (config.validation?.checkLocationExists) {
      for (const route of routes) {
        if (!route) continue;
        const startLocationId = route.startLocationId ?? (route.startLocationFeatureId as NodeId | undefined);
        const endLocationId = route.endLocationId ?? (route.endLocationFeatureId as NodeId | undefined);
        if (startLocationId || endLocationId) {
          routeTasks.push({
            taskId: crypto.randomUUID(),
            treeNodeId: nodeId,
            nodeId,
            stage: 'location-resolution',
            status: 'queued',
            index: routeTasks.length,
            routeData: {
              startLocationId,
              endLocationId,
              method: route.method || config.routeGeneration.method,
            },
          });
        }
      }
    }

    // Phase 2: Route generation tasks
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (!route) continue;
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'route-generation',
        status: 'queued',
        index: routeTasks.length,
        routeData: {
          startLocationId: route.startLocationId ?? (route.startLocationFeatureId as NodeId | undefined),
          endLocationId: route.endLocationId ?? (route.endLocationFeatureId as NodeId | undefined),
          method: route?.method || config.routeGeneration.method,
          ...(route?.startCoordinates && route.endCoordinates ? {
            startCoordinates: route.startCoordinates,
            endCoordinates: route.endCoordinates,
          } : {}),
          // 追加オプションは型安全に存在チェック
          ...(route?.methodOptions ? { methodOptions: route.methodOptions } : {}),
        },
      });
    }

    // Phase 3: Transform tasks for simplification & tile indexing
    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      nodeId,
      stage: 'transform',
      status: 'queued',
      index: routeTasks.length,
    });

    // Phase 4: VT tasks (vector tiles for routes)
    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      nodeId,
      stage: 'vt',
      status: 'queued',
      index: routeTasks.length,
    });

    // Store route-specific tasks
    this.routeSpecificTasks.set(nodeId, routeTasks);

    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await putTasks(taskQueue, routeTasks.map((task) => toTaskQueueRecord(task)));

    const generator = this.deps?.generator ??
      (this.deps?.engines ? new RouteGenerator(this.deps.engines) : undefined);
    const routeDB = await this.deps?.routeDB;
    const routeSession = new RouteBuildSession(nodeId, config, routeTasks, {
      generator,
      routeDB,
      locationResolver: this.deps?.locationResolver,
    });

    // Start processing using Shape's infrastructure
    this.activeSessions.set(nodeId, routeSession);
    const unsubscribe = routeSession.addBuildProgressListener((event: BuildProgressEvent) => this.emitProgressEvent(event));
    await routeSession.initialize();
    const runPromise = routeSession.start();
    void runPromise.catch((error: unknown) => {
      logRouteBuildWarning('Route build session failed', error);
    });
    void runPromise.finally(() => {
      unsubscribe();
      this.activeSessions.delete(nodeId);
    });

    return nodeId;
  }
  getSession(nodeId: NodeId): RouteBuildSession | undefined {
    return this.activeSessions.get(nodeId);
  }

  // Process route tasks using RouteBuildSession (handled within session)

  // Grouping helper kept for reference (not used in current flow)

  // private async processTaskGroup(...): Promise<void> { /* consolidated into RouteBuildSession */ }

  // private getLaneSemaphore(method: string): Semaphore {
  //   let sem = this.laneSemaphores.get(method);
  //   if (!sem) {
  //     const cap = this.laneConfig[method] ?? 4;
  //     sem = new Semaphore(cap);
  //     this.laneSemaphores.set(method, sem);
  //   }
  //   return sem;
  // }

  /**
   * Process individual route task
   */
  // private async processIndividualTask(...): Promise<void> { /* handled by RouteBuildSession */ }

  /**
   * Resolve location references
   */
  // private async resolveLocations(...): Promise<void> {}

  /**
   * Generate route geometry
   */
  // private async generateRoute(...): Promise<void> {}

  /**
   * Validate route
   */
  // private async validateRoute(...): Promise<void> {}

  /**
   * Optimize route for rendering
   */
  // private async optimizeRoute(...): Promise<void> {}

  /**
   * Retry failed task
   */

  // private async retryTask(...): Promise<void> {}

  /**
   * Get route build progress
   */
  async getRouteBuildProgress(nodeId: NodeId): Promise<{
    phase: string;
    progress: number;
    completedRoutes: number;
  totalRoutes: number;
  errors: string[];
}> {
    const tasks = this.routeSpecificTasks.get(nodeId) || [];
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const failedTasks = tasks.filter((t) => t.status === 'failed');

    const routeGenerationTasks = tasks.filter((t) => t.stage === 'route-generation');
    const completedRoutes = routeGenerationTasks.filter((t) => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0
      ? Math.min(100, Math.max(0, (completedTasks.length / totalTasks) * 100))
      : 0;

    // Determine current phase
    let phase = 'idle';
    if (tasks.some((t) => t.stage === 'location-resolution' && t.status === 'running')) {
      phase = 'resolving_locations';
    } else if (tasks.some((t) => t.stage === 'route-generation' && t.status === 'running')) {
      phase = 'generating_routes';
    } else if (tasks.some((t) => t.stage === 'transform' && t.status === 'running')) {
      phase = 'transform';
    } else if (tasks.some((t) => t.stage === 'vt' && t.status === 'running')) {
      phase = 'vt';
    }

    return {
      phase,
      progress: Number.isFinite(percentage) ? percentage : 0,
      completedRoutes,
      totalRoutes: routeGenerationTasks.length,
      errors: failedTasks.map(t => t.error || 'Unknown error'),
    };
  }

  private emitProgressEvent(event: BuildProgressEvent): void {
    const payload = event.payload ?? {};
    const total = coerceNumber(payload.total);
    const completed = coerceNumber(payload.completed);
    const percentage = computePercentage(total, completed, event.phase === 'completed');
    const stage = normalizeRouteProgressStage(event.stage);
    const ts = event.timestamp ?? Date.now();
    const update: ProgressUpdate = {
      jobId: event.nodeId,
      progress: percentage,
      phase: stage,
      ts,
    };
    try {
      this.deps?.emitter?.emit?.(update);
    } catch (error) {
      logRouteBuildWarning('Progress emitter raised an error', error);
    }
    try {
      this.deps?.store?.upsert?.(event.nodeId, update);
    } catch (error) {
      logRouteBuildWarning('Progress store upsert failed', error);
    }
  }

}

function toTaskQueueRecord(task: RouteBuildTask): TaskQueueRecord {
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: mapRouteStageToVtStage(task.stage),
    status: 'queued',
    index: task.index,
    progress: 0,
    inputData: {
      routeStage: task.stage,
      routeData: task.routeData,
    },
  };
}

function mapRouteStageToVtStage(stage: RouteBuildTaskStage): TaskStage {
  switch (stage) {
    case 'location-resolution':
      return 'fetch';
    case 'route-generation':
      return 'fetch';
    case 'transform':
      return 'transform';
    case 'vt':
      return 'vt';
    default:
      throw new Error(`Unsupported route stage for vt task queue: ${stage}`);
  }
}

function normalizeRouteProgressStage(stage: string): string {
  switch (stage) {
    case 'location-resolution':
      return 'resolving_locations';
    case 'route-generation':
      return 'generating_routes';
    case 'transform':
      return 'transform';
    case 'vt':
      return 'vt';
    default:
      return stage;
  }
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function computePercentage(total: number, completed: number, isCompletedPhase: boolean): number {
  if (isCompletedPhase) return 100;
  if (total <= 0) return Math.max(0, Math.min(100, Math.round(completed)));
  const ratio = (completed / total) * 100;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

// (removed) Semaphore helper; concurrency control is handled in RouteBuildSession
