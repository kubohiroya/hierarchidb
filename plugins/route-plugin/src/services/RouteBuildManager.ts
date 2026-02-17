/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Shape's build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';

import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import { RouteBuildSession, type RouteBuildTask } from './RouteBuildSession.js';
import type { BuildProgressEvent } from '@hierarchidb/batch-api';
import { VtTaskQueueDb, putTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord, TaskStage } from '@hierarchidb/batch-api';

export type ProgressUpdate = { jobId: string; progress: number; phase: string; ts: number };
export type ProgressEmitter = { emit?: (event: ProgressUpdate) => void };
export type ProgressStore = { upsert?: (nodeId: string, record: ProgressUpdate) => void };

export type RouteBuildManagerDeps = {
  engines?: unknown;
  emitter?: ProgressEmitter;
  store?: ProgressStore;
};

export type RouteBuildRouteInput = {
  startLocationId?: NodeId;
  endLocationId?: NodeId;
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
  // Idempotency (jobKey -> session)
  private static jobKeyToSession = new Map<string, NodeId>();
  // Lane semaphores: enforce per-engine concurrency regardless of batch size
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
    // Idempotency: reuse an existing session if the same payload arrives
    const jobKey = this.computeJobKey(nodeId, config, routes);
    const existing = RouteBuildManager.jobKeyToSession.get(jobKey);
    if (existing) return existing;
    RouteBuildManager.jobKeyToSession.set(jobKey, nodeId);

    // Create route-specific tasks
    const routeTasks: RouteBuildTask[] = [];

    // Phase 1: Location resolution tasks
    if (config.validation?.checkLocationExists) {
      for (const route of routes) {
        if (route.startLocationId || route.endLocationId) {
          routeTasks.push({
            taskId: crypto.randomUUID(),
            treeNodeId: nodeId,
            nodeId,
            taskType: 'location_resolution',
            stage: 'download', // Reuse Shape's stage
            status: 'pending',
            index: routeTasks.length,
            routeData: {
              startLocationId: route.startLocationId,
              endLocationId: route.endLocationId,
              method: route.method || config.routeGeneration.method,
            },
          });
        }
      }
    }

    // Phase 2: Route generation tasks
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        taskType: 'route_generation',
        stage: 'extract1', // Reuse Shape's stage for processing
        status: 'pending',
        index: routeTasks.length,
        routeData: {
          startLocationId: route?.startLocationId,
          endLocationId: route?.endLocationId,
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

    // Phase 3: Validation tasks
    if (config.validation && (config.validation.checkDuplicateRoutes || config.validation.validateDistance)) {
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        taskType: 'validation',
        stage: 'extract2', // Reuse Shape's stage for validation
        status: 'pending',
        index: routeTasks.length,
      });
    }

    // Phase 4: Optimization tasks (vector tiles for routes)
    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      nodeId,
      taskType: 'optimization',
      stage: 'vectortile', // Reuse Shape's stage for final optimization
      status: 'pending',
      index: routeTasks.length,
    });

    // Store route-specific tasks
    this.routeSpecificTasks.set(nodeId, routeTasks);

    const taskQueue = new VtTaskQueueDb();
    await putTasks(taskQueue, routeTasks.map((task) => toTaskQueueRecord(task)));

    // Start processing using Shape's infrastructure
    const session = new RouteBuildSession(nodeId, config, routeTasks, { taskQueue });
    this.activeSessions.set(nodeId, session);
    const unsubscribe = session.addBuildProgressListener((event: BuildProgressEvent) => this.emitProgressEvent(event));
    await session.initialize();
    const runPromise = session.start();
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

    const routeGenerationTasks = tasks.filter((t) => t.taskType === 'route_generation');
    const completedRoutes = routeGenerationTasks.filter((t) => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0
      ? Math.min(100, Math.max(0, (completedTasks.length / totalTasks) * 100))
      : 0;

    // Determine current phase
    let phase = 'idle';
    if (tasks.some((t) => t.taskType === 'location_resolution' && t.status === 'processing')) {
      phase = 'resolving_locations';
    } else if (tasks.some((t) => t.taskType === 'route_generation' && t.status === 'processing')) {
      phase = 'generating_routes';
    } else if (tasks.some((t) => t.taskType === 'validation' && t.status === 'processing')) {
      phase = 'validating';
    } else if (tasks.some((t) => t.taskType === 'optimization' && t.status === 'processing')) {
      phase = 'optimizing';
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
    const ts = event.timestamp ?? Date.now();
    const update: ProgressUpdate = {
      jobId: event.nodeId,
      progress: percentage,
      phase: event.stage,
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

  private computeJobKey(nodeId: NodeId, config: RouteBuildConfig, routes: RouteBuildRouteInput[]): string {
    const payload = {
      nodeId,
      method: config.routeGeneration.method,
      mc: config.routeGeneration.maxConcurrent,
      r: routes.map(r => ({ s: r.startCoordinates, e: r.endCoordinates, m: r.method })).slice(0, 200),
    };
    return hashCyrb53(stableStringify(payload));
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
      taskType: task.taskType,
      routeData: task.routeData,
    },
  };
}

function mapRouteStageToVtStage(stage: string): TaskStage {
  switch (stage) {
    case 'download':
      return 'fetch';
    case 'extract1':
      return 'transform';
    case 'extract2':
      return 'transform';
    case 'vectortile':
      return 'vt';
    default:
      throw new Error(`Unsupported route stage for vt task queue: ${stage}`);
  }
}

function stableStringify(x: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(x, (_key, value: unknown) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      if (!Array.isArray(value)) {
        const sorted: Record<string, unknown> = {};
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, entryValue] of entries) {
          sorted[key] = entryValue;
        }
        return sorted;
      }
    }
    return value;
  });
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

function hashCyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  let ch: number = 0;
  for (let i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h2 >>> 15), 2246822507) ^ Math.imul(h2 ^ (h1 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h2 >>> 13), 3266489909);
  const h = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return h.toString(36);
}

// (removed) Semaphore helper; concurrency control is handled in RouteBuildSession
