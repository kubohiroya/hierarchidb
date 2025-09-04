/**
 * @file RouteBatchManager.ts
 * @description Route batch processing manager extending Shape's batch infrastructure
 */

import type { NodeId } from '@hierarchidb/common-type';
import { BatchSessionManager, type BatchConfig, type BatchTaskLike } from './batch-shim';
import type { RouteGenerationConfig } from '../entities/RouteEntity';

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
    estimatedDistance?: number;
  };
}

/**
 * Route batch manager leveraging Shape's batch infrastructure
 */
export class RouteBatchManager extends BatchSessionManager {
  private routeSpecificTasks = new Map<string, RouteBatchTask[]>();
  
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
    
    // Process tasks in batches for parallelism
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      
      await Promise.all(
        batch.map(task => this.processIndividualTask(task, config))
      );
      
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
    // Implementation would call RouteGenerator
    console.log('Generating route for task:', task.taskId);
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
