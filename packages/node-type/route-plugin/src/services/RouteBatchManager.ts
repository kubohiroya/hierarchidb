/**
 * @file RouteBatchManager.ts
 * @description Route batch processing manager extending Shape's batch infrastructure
 */

import type { NodeId } from '@hierarchidb/common-type';
import { BatchSessionManager, type BatchConfig, type BatchTaskLike } from './batch-shim';
import type { RouteGenerationConfig } from '../entities/RouteEntity';
import { RouteGenerator } from './RouteGenerator';
import { RouteDatabase } from '../database/RouteDatabase';

/**
 * Route-specific batch configuration
 */
export interface RouteBatchConfig extends BatchConfig {
  routeGeneration: {
    method: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
    parallel: boolean;
    maxConcurrent: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  
  locationResolution: {
    batchSize: number;
    cacheResults: boolean;
    fallbackToCoordinates: boolean;
  };
  
  validation: {
    checkLocationExists: boolean;
    checkDuplicateRoutes: boolean;
    validateDistance: boolean;
    maxDistanceKm?: number;
  };
}

/**
 * Route batch task extending Shape's task interface
 */
export interface RouteBatchTask extends BatchTaskLike {
  taskType: 'route_generation' | 'location_resolution' | 'validation' | 'optimization';
  routeData?: {
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    method: string;
    methodOptions?: any;
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    estimatedDistance?: number;
  };
}

/**
 * Route batch manager leveraging Shape's batch infrastructure
 */
export class RouteBatchManager extends BatchSessionManager {
  private routeSpecificTasks = new Map<string, RouteBatchTask[]>();
  // Lane semaphores: enforce per-engine concurrency regardless of batch size
  private laneSemaphores = new Map<string, Semaphore>();
  private laneConfig: Record<string, number> = {
    osm_route: 1,        // strictly serialized
    searoute: 3,         // modest parallelism
    direct: 64,          // local
    great_circle: 64,
    custom: 8,
  };

  
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
    // Create session using Shape's infrastructure
    const sessionId = await this.startBatchSession(
      nodeId,
      config,
      [], // Countries not needed for routes
      []  // Admin levels not needed for routes
    );
    
    // Create route-specific tasks
    const routeTasks: RouteBatchTask[] = [];
    
    // Phase 1: Location resolution tasks
    if (config.validation.checkLocationExists) {
      for (const route of routes) {
        if (route.startLocationId || route.endLocationId) {
          routeTasks.push({
            taskId: crypto.randomUUID(),
            treeNodeId: nodeId as any,
            sessionId,
            taskType: 'location_resolution',
            stage: 'download', // Reuse Shape's stage
            status: 'pending',
            country: 'N/A',
            adminLevel: 0,
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
        country: 'N/A',
        adminLevel: 0,
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
    if (config.validation.checkDuplicateRoutes || config.validation.validateDistance) {
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId as any,
        sessionId,
        taskType: 'validation',
        stage: 'simplify2', // Reuse Shape's stage for validation
        status: 'pending',
        country: 'N/A',
        adminLevel: 0,
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
      country: 'N/A',
      adminLevel: 0,
      index: routeTasks.length,
    });
    
    // Store route-specific tasks
    this.routeSpecificTasks.set(sessionId, routeTasks);
    
    // Start processing using Shape's infrastructure
    await this.processTasks(sessionId, routeTasks);
    
    return sessionId;
  }
  
  /**
   * Process route tasks using Shape's worker infrastructure
   */
  private async processTasks(
    sessionId: string,
    tasks: RouteBatchTask[]
  ): Promise<void> {
    // Group tasks by type for parallel processing
    const taskGroups = this.groupTasksByType(tasks);
    
    // Process each phase sequentially
    for (const [taskType, groupTasks] of taskGroups) {
      await this.processTaskGroup(sessionId, taskType, groupTasks);
    }
  }
  
  /**
   * Group tasks by type for phased processing
   */
  private groupTasksByType(
    tasks: RouteBatchTask[]
  ): Map<string, RouteBatchTask[]> {
    const groups = new Map<string, RouteBatchTask[]>();
    
    for (const task of tasks) {
      const group = groups.get(task.taskType) || [];
      group.push(task);
      groups.set(task.taskType, group);
    }
    
    return groups;
  }
  
  /**
   * Process a group of tasks of the same type
   */
  private async processTaskGroup(
    sessionId: string,
    taskType: string,
    tasks: RouteBatchTask[]
  ): Promise<void> {
    const config = (this as any)['getSessionConfig'](sessionId) as RouteBatchConfig | undefined; // access protected
    if (!config) return;
    const maxConcurrent = config.routeGeneration.maxConcurrent;

    // Process in windows, but gate each task by its lane semaphore
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      await Promise.all(batch.map(async (task) => {
        if (task.taskType === 'route_generation') {
          const method = (task.routeData?.method || config.routeGeneration.method) as string;
          const sem = this.getLaneSemaphore(method);
          await sem.acquire();
          try {
            await this.processIndividualTask(task, config);
          } finally {
            sem.release();
          }
        } else {
          await this.processIndividualTask(task, config);
        }
      }));
      
      // Update progress using Shape's callback mechanism
      (this as any)['notifyProgress'](sessionId, {
        sessionId,
        stage: (batch[0]?.stage ?? 'processing') as any,
        progress: ((i + batch.length) / tasks.length) * 100,
        completedTasks: i + batch.length,
        totalTasks: tasks.length,
        message: `Processing ${taskType} tasks...`,
      });
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
  
  /**
   * Process individual route task
   */
  private async processIndividualTask(
    task: RouteBatchTask,
    config: RouteBatchConfig
  ): Promise<void> {
    try {
      switch (task.taskType) {
        case 'location_resolution':
          await this.resolveLocations(task, config);
          break;
        
        case 'route_generation':
          await this.generateRoute(task, config);
          break;
        
        case 'validation':
          await this.validateRoute(task, config);
          break;
        
        case 'optimization':
          await this.optimizeRoute(task, config);
          break;
      }
      
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      
      if (config.routeGeneration.retryOnFailure) {
        // Retry logic using Shape's retry mechanism
        await this.retryTask(task, config);
      }
    }
  }
  
  /**
   * Resolve location references
   */
  private async resolveLocations(
    task: RouteBatchTask,
    _config: RouteBatchConfig
  ): Promise<void> {
    // Implementation would call LocationResolver
    console.log('Resolving locations for task:', task.taskId);
  }
  
  /**
   * Generate route geometry
   */
  private async generateRoute(
    task: RouteBatchTask,
    _config: RouteBatchConfig
  ): Promise<void> {
    const method = (task.routeData?.method || 'direct') as RouteGenerationConfig['method'];
    const start = (task.routeData as any)?.startCoordinates as [number, number] | undefined;
    const end = (task.routeData as any)?.endCoordinates as [number, number] | undefined;
    const pts: [number, number][] = start && end ? [start, end] : [[0,0],[1,1]];
    const res = await this.generator.generate(pts, { method, options: (task.routeData as any)?.methodOptions });
    try {
      // @ts-ignore
      await (this.db.table('routeResults') as any)?.put({
        id: `${task.sessionId}:${task.taskId}`,
        sessionId: task.sessionId,
        taskId: task.taskId,
        method,
        lineGeometry: res.lineGeometry,
        distance: res.distance,
        duration: res.duration,
        createdAt: Date.now(),
      });
    } catch {}
  }
  
  /**
   * Validate route
   */
  private async validateRoute(
    task: RouteBatchTask,
    _config: RouteBatchConfig
  ): Promise<void> {
    // Validation logic
    console.log('Validating route for task:', task.taskId);
  }
  
  /**
   * Optimize route for rendering
   */
  private async optimizeRoute(
    task: RouteBatchTask,
    _config: RouteBatchConfig
  ): Promise<void> {
    // Generate vector tiles for routes
    console.log('Optimizing route for task:', task.taskId);
  }
  
  /**
   * Retry failed task
   */
  private async retryTask(
    task: RouteBatchTask,
    _config: RouteBatchConfig
  ): Promise<void> {
    // Implement retry logic
    console.log('Retrying task:', task.taskId);
  }
  
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
}

class Semaphore {
  private queue: Array<() => void> = [];
  private count: number;
  constructor(private capacity: number) { this.count = capacity; }
  acquire(): Promise<void> {
    if (this.count > 0) { this.count--; return Promise.resolve(); }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release(): void {
    if (this.queue.length > 0) { const resolve = this.queue.shift()!; resolve(); }
    else this.count = Math.min(this.count + 1, this.capacity);
  }
}
