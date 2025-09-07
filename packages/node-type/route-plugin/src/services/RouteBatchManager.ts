/**
 * @file RouteBatchManager.ts
 * @description Route batch processing manager extending Shape's batch infrastructure
 */

import type { NodeId } from '@hierarchidb/common-type';
// No longer extend local batch shim; RouteBatchSession provides shared behavior
import type { RouteGenerationConfig } from '../entities/RouteEntity';
// import { RouteGenerator } from './RouteGenerator';
import { RouteDatabase } from '../database/RouteDatabase';
import type { ProgressEvent } from '@hierarchidb/common-type';
import { RouteBatchSession, type RouteBatchTask, type RouteBatchConfig } from './RouteBatchSession';

/**
 * Route-specific batch configuration
 */
export class RouteBatchManager {
  constructor(private deps?: { engines?: any; emitter?: any; store?: any }) {}
  private routeSpecificTasks = new Map<string, RouteBatchTask[]>();
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
    routes: Array<{
      startLocationId?: NodeId;
      endLocationId?: NodeId;
      startCoordinates?: [number, number];
      endCoordinates?: [number, number];
      method?: RouteGenerationConfig['method'];
    }>
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
            treeNodeId: nodeId as any,
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
        treeNodeId: nodeId as any,
        sessionId,
        taskType: 'route_generation',
        stage: 'simplify1', // Reuse Shape's stage for processing
        status: 'pending',
        index: routeTasks.length,
        routeData: {
          startLocationId: route.startLocationId,
          endLocationId: route.endLocationId,
          method: route.method || config.routeGeneration.method,
          ...(route.startCoordinates && route.endCoordinates ? { startCoordinates: route.startCoordinates, endCoordinates: route.endCoordinates } as any : {}),
          ...(route as any).methodOptions ? { methodOptions: (route as any).methodOptions } : {},
        },
      });
    }
    
    // Phase 3: Validation tasks
    if (config.validation && (config.validation.checkDuplicateRoutes || config.validation.validateDistance)) {
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId as any,
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
      treeNodeId: nodeId as any,
      sessionId,
      taskType: 'optimization',
      stage: 'vectortile', // Reuse Shape's stage for final optimization
      status: 'pending',
      index: routeTasks.length,
    });
    
    // Store route-specific tasks
    this.routeSpecificTasks.set(sessionId, routeTasks);
    
    // Initialize cursor
    await this.db.routeCursors?.put({ sessionId, completed: 0, total: routeTasks.length, updatedAt: Date.now(), paused: false } as any);
    // Start processing using Shape's infrastructure
    const session = new RouteBatchSession(sessionId, nodeId, config, routeTasks, (ev: ProgressEvent) => this.emitProgress(ev));
    await session.initialize();
    await session.start();

    return sessionId;
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
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    const routeGenerationTasks = tasks.filter(t => t.taskType === 'route_generation');
    const completedRoutes = routeGenerationTasks.filter(t => t.status === 'completed').length;
    
    // Determine current phase
    let phase = 'idle';
    if (tasks.some(t => t.taskType === 'location_resolution' && t.status === 'processing')) {
      phase = 'resolving_locations';
    } else if (tasks.some(t => t.taskType === 'route_generation' && t.status === 'processing')) {
      phase = 'generating_routes';
    } else if (tasks.some(t => t.taskType === 'validation' && t.status === 'processing')) {
      phase = 'validating';
    } else if (tasks.some(t => t.taskType === 'optimization' && t.status === 'processing')) {
      phase = 'optimizing';
    }
    
    return {
      phase,
      progress: (completedTasks.length / tasks.length) * 100,
      completedRoutes,
      totalRoutes: routeGenerationTasks.length,
      errors: failedTasks.map(t => t.error || 'Unknown error'),
    };
  }

  /** Pause a running session */
  async pauseRouteBatchSession(sessionId: string): Promise<void> {
    try {
      const c = await (this.db.routeCursors as any)?.get(sessionId);
      await (this.db.routeCursors as any)?.put({ ...(c ?? { sessionId, completed: 0, total: 0, updatedAt: Date.now() }), paused: true, updatedAt: Date.now() });
    } catch {}
  }

  /** Resume a paused session */
  async resumeRouteBatchSession(_sessionId: string): Promise<void> {
    try {
      const c = await (this.db.routeCursors as any)?.get(_sessionId);
      await (this.db.routeCursors as any)?.put({ ...(c ?? { sessionId: _sessionId, completed: 0, total: 0 }), paused: false, updatedAt: Date.now() });
    } catch {}
  }

  private emitProgress(ev: ProgressEvent): void {
    // bridge to UI progress emitter/store if provided via deps in createRouteBatchManager
    try { this.deps?.emitter?.emit({ jobId: ev.sessionId, progress: ev.percentage, phase: ev.stage, ts: Date.now() }); } catch {}
    try { this.deps?.store?.upsert(ev.sessionId, { jobId: ev.sessionId, progress: ev.percentage, phase: ev.stage, ts: Date.now() }); } catch {}
  }

  private computeJobKey(config: RouteBatchConfig, routes: Array<{ startCoordinates?: [number,number]; endCoordinates?: [number,number]; method?: string }>): string {
    const payload = {
      method: config.routeGeneration.method,
      mc: config.routeGeneration.maxConcurrent,
      r: routes.map(r => ({ s: r.startCoordinates, e: r.endCoordinates, m: r.method })).slice(0, 200),
    };
    return hashCyrb53(stableStringify(payload));
  }
}

function stableStringify(x: any): string {
  const seen = new WeakSet();
  return JSON.stringify(x, function (_key, value) {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      if (!Array.isArray(value)) {
        const sorted: any = {};
        for (const k of Object.keys(value).sort()) sorted[k] = (value as any)[k];
        return sorted;
      }
    }
    return value;
  });
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

// Bridge notifyProgress (shim) to UI progress emitter/store using common ProgressEvent shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RouteBatchManager.prototype as any)['notifyProgress'] = function (this: any, sessionId: string, ev: any) {
  try {
    const pct = typeof ev?.percentage === 'number' ? ev.percentage : (ev?.total ? Math.round(((ev?.completed ?? 0) / ev.total) * 100) : (ev?.progress ?? 0));
    this['deps']?.emitter?.emit({ jobId: sessionId, progress: pct, phase: ev?.stage ?? 'processing', ts: Date.now() });
  } catch {}
  try {
    const pct = typeof ev?.percentage === 'number' ? ev.percentage : (ev?.total ? Math.round(((ev?.completed ?? 0) / ev.total) * 100) : (ev?.progress ?? 0));
    this['deps']?.store?.upsert(sessionId, { jobId: sessionId, progress: pct, phase: ev?.stage ?? 'processing', ts: Date.now() });
  } catch {}
};

// (removed) Semaphore helper; concurrency control is handled in RouteBatchSession
