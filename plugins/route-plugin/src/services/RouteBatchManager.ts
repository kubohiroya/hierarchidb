/**
 * @file RouteBatchManager.ts
 * @description Route batch processing manager extending Shape's batch infrastructure
 */

import type { NodeId } from '@hierarchidb/common-types';

// No longer extend local batch shim; RouteBatchSession provides shared behavior
import type { RouteGenerationConfig } from '../common/entities/RouteEntity.js';
import { RouteDatabase, type RouteCursorRow } from './database/RouteDatabase.js';
import type { RouteBatchConfig } from '../common/types/BatchConfig.js';
import { RouteBatchSession, type RouteBatchTask } from './RouteBatchSession.js';
import { BatchProgressEvent } from '@hierarchidb/common-api';

export type ProgressUpdate = { jobId: string; progress: number; phase: string; ts: number };
export type ProgressEmitter = { emit?: (event: ProgressUpdate) => void };
export type ProgressStore = { upsert?: (sessionId: string, record: ProgressUpdate) => void };
export type RouteBatchManagerDeps = {
  engines?: unknown;
  emitter?: ProgressEmitter;
  store?: ProgressStore;
};

export type RouteBatchRouteInput = {
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  startCoordinates?: [number, number];
  endCoordinates?: [number, number];
  method?: RouteGenerationConfig['method'];
  methodOptions?: RouteGenerationConfig['options'];
};

const logRouteBatchWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[RouteBatchManager]', message, error);
};

/**
 * Route-specific batch configuration
 */

export class RouteBatchManager {
  constructor(protected readonly deps?: RouteBatchManagerDeps) {}

  private routeSpecificTasks = new Map<string, RouteBatchTask[]>();
  private activeSessions = new Map<string, RouteBatchSession>();
  // private generator = new RouteGenerator();
  private db = new RouteDatabase();
  // Idempotency (jobKey -> session)
  private static jobKeyToSession = new Map<string, string>();
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
   * Start route batch generation session
   */
  async startRouteBatchSession(
    nodeId: NodeId,
    config: RouteBatchConfig,
    routes: RouteBatchRouteInput[],
  ): Promise<string> {
    // Idempotency: reuse an existing session if the same payload arrives
    const jobKey = this.computeJobKey(config, routes);
    const existing = RouteBatchManager.jobKeyToSession.get(jobKey);
    if (existing) return existing;
    const sessionId = crypto.randomUUID();
    RouteBatchManager.jobKeyToSession.set(jobKey, sessionId);

    // Create route-specific tasks
    const routeTasks: RouteBatchTask[] = [];

    // Phase 1: Location resolution tasks
    if (config.validation && config.validation.checkLocationExists) {
      for (const route of routes) {
        if (route.startLocationId || route.endLocationId) {
          routeTasks.push({
            taskId: crypto.randomUUID(),
            treeNodeId: nodeId,
            sessionId,
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
      const route = routes[i]!;
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        sessionId,
        taskType: 'route_generation',
        stage: 'simplify1', // Reuse Shape's stage for processing
        status: 'pending',
        index: routeTasks.length,
        routeData: {
          startLocationId: route.startLocationId,
          endLocationId: route.endLocationId,
          method: route.method || config.routeGeneration.method,
          ...(route.startCoordinates && route.endCoordinates ? {
            startCoordinates: route.startCoordinates,
            endCoordinates: route.endCoordinates,
          } : {}),
          // 追加オプションは型安全に存在チェック
          ...(route.methodOptions ? { methodOptions: route.methodOptions } : {}),
        },
      });
    }

    // Phase 3: Validation tasks
    if (config.validation && (config.validation.checkDuplicateRoutes || config.validation.validateDistance)) {
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        sessionId,
        taskType: 'validation',
        stage: 'simplify2', // Reuse Shape's stage for validation
        status: 'pending',
        index: routeTasks.length,
      });
    }

    // Phase 4: Optimization tasks (vector tiles for routes)
    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      sessionId,
      taskType: 'optimization',
      stage: 'vectortile', // Reuse Shape's stage for final optimization
      status: 'pending',
      index: routeTasks.length,
    });

    // Store route-specific tasks
    this.routeSpecificTasks.set(sessionId, routeTasks);

    // Initialize cursor
    await this.db.routeCursors.put(createCursorRow(sessionId, nodeId, 0, routeTasks.length));
    // Start processing using Shape's infrastructure
    const session = new RouteBatchSession(sessionId, nodeId, config, routeTasks);
    this.activeSessions.set(sessionId, session);
    const unsubscribe = session.addBatchProgressListener((event: BatchProgressEvent) => this.emitProgressEvent(event));
    await session.initialize();
    const runPromise = session.start();
    void runPromise.catch((error: unknown) => {
      logRouteBatchWarning('Route batch session failed', error);
    });
    void runPromise.finally(() => {
      unsubscribe();
      this.activeSessions.delete(sessionId);
    });

    return sessionId;
  }

  getSession(sessionId: string): RouteBatchSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  // Process route tasks using RouteBatchSession (handled within session)

  // Grouping helper kept for reference (not used in current flow)

  // private async processTaskGroup(...): Promise<void> { /* consolidated into RouteBatchSession */ }

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
  // private async processIndividualTask(...): Promise<void> { /* handled by RouteBatchSession */ }

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
   * Get route batch progress
   */
  async getRouteBatchProgress(sessionId: string): Promise<{
    phase: string;
    progress: number;
    completedRoutes: number;
    totalRoutes: number;
    errors: string[];
  }> {
    const tasks = this.routeSpecificTasks.get(sessionId) || [];
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

  /** Pause a running session */
  async pauseRouteBatchSession(sessionId: string): Promise<void> {
    try {
      const cursor = await this.db.routeCursors.get(sessionId);
      const update: RouteCursorRow = {
        sessionId,
        nodeId: cursor?.nodeId ?? ('' as NodeId),
        completed: cursor?.completed ?? 0,
        total: cursor?.total ?? 0,
        paused: true,
        updatedAt: Date.now(),
        tableId: cursor?.tableId,
      };
      await this.db.routeCursors.put(update);
    } catch (error) {
      logRouteBatchWarning(`Failed to persist pause state for session ${sessionId}`, error);
    }
  }

  /** Resume a paused session */
  async resumeRouteBatchSession(_sessionId: string): Promise<void> {
    try {
      const cursor = await this.db.routeCursors.get(_sessionId);
      const update: RouteCursorRow = {
        sessionId: _sessionId,
        nodeId: cursor?.nodeId ?? ('' as NodeId),
        completed: cursor?.completed ?? 0,
        total: cursor?.total ?? 0,
        paused: false,
        updatedAt: Date.now(),
        tableId: cursor?.tableId,
      };
      await this.db.routeCursors.put(update);
    } catch (error) {
      logRouteBatchWarning(`Failed to persist resume state for session ${_sessionId}`, error);
    }
  }

  private emitProgressEvent(event: BatchProgressEvent): void {
    const payload = event.payload ?? {};
    const total = coerceNumber(payload.total);
    const completed = coerceNumber(payload.completed);
    const percentage = computePercentage(total, completed, event.phase === 'completed');
    const ts = event.timestamp ?? Date.now();
    const update: ProgressUpdate = {
      jobId: event.sessionId,
      progress: percentage,
      phase: event.stage,
      ts,
    };
    try {
      this.deps?.emitter?.emit?.(update);
    } catch (error) {
      logRouteBatchWarning('Progress emitter raised an error', error);
    }
    try {
      this.deps?.store?.upsert?.(event.sessionId, update);
    } catch (error) {
      logRouteBatchWarning('Progress store upsert failed', error);
    }
  }

  private computeJobKey(config: RouteBatchConfig, routes: RouteBatchRouteInput[]): string {
    const payload = {
      method: config.routeGeneration.method,
      mc: config.routeGeneration.maxConcurrent,
      r: routes.map(r => ({ s: r.startCoordinates, e: r.endCoordinates, m: r.method })).slice(0, 200),
    };
    return hashCyrb53(stableStringify(payload));
  }
}

function createCursorRow(sessionId: string, nodeId: NodeId, completed: number, total: number): RouteCursorRow {
  return {
    sessionId,
    nodeId,
    completed,
    total,
    updatedAt: Date.now(),
    paused: false,
  };
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
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h2 >>> 15), 2246822507) ^ Math.imul(h2 ^ (h1 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h2 >>> 13), 3266489909);
  const h = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return h.toString(36);
}

// (removed) Semaphore helper; concurrency control is handled in RouteBatchSession
