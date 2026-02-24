/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import {
  RouteBuildSession,
  type RouteBuildTask,
} from './RouteBuildSession.js';
import type { BuildProgressEvent, TaskStage, TaskQueueRecord } from '@hierarchidb/build-api';
import { VtTaskQueueDb, deleteTasksByNode, putTasks } from '@hierarchidb/vt-orchestrator';

export type ProgressUpdate = {
  jobId: string;
  progress: number;
  stage: TaskStage;
  phase: string;
  ts: number;
};
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

export class RouteBuildManager {
  constructor(protected readonly deps?: RouteBuildManagerDeps) {}

  private routeSpecificTasks = new Map<NodeId, RouteBuildTask[]>();
  private activeSessions = new Map<NodeId, RouteBuildSession>();

  async startRouteBuildSession(
    nodeId: NodeId,
    config: RouteBuildConfig,
    routes: RouteBuildRouteInput[],
  ): Promise<NodeId> {
    const existingSession = this.activeSessions.get(nodeId);
    if (existingSession) return nodeId;

    const routeTasks: RouteBuildTask[] = [];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if(! route){
        throw new Error(`Route ${i} is missing coordinates`);
      }
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'fetch',
        status: 'queued',
        index: routeTasks.length,
        routeData: createRouteTaskData(route, config),
      });
    }

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if(! route){
        throw new Error(`Route ${i} is missing coordinates`);
      }
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'transform',
        status: 'queued',
        index: routeTasks.length,
        routeData: createRouteTaskData(route, config),
      });
    }

    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      nodeId,
      stage: 'vt',
      status: 'queued',
      index: routeTasks.length,
    });

    this.routeSpecificTasks.set(nodeId, routeTasks);

    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await putTasks(taskQueue, routeTasks.map((task) => toTaskQueueRecord(task)));

    const session = new RouteBuildSession(nodeId, config, routeTasks);
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

  async getRouteBuildProgress(nodeId: NodeId): Promise<{
    phase: string;
    progress: number;
    completedRoutes: number;
    totalRoutes: number;
    errors: string[];
  }> {
    const tasks = this.routeSpecificTasks.get(nodeId) || [];
    const completedTasks = tasks.filter((task) => task.status === 'completed');
    const failedTasks = tasks.filter((task) => task.status === 'failed');

    const fetchTasks = tasks.filter((task) => task.stage === 'fetch');
    const completedRoutes = fetchTasks.filter((task) => task.status === 'completed').length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0
      ? Math.min(100, Math.max(0, (completedTasks.length / totalTasks) * 100))
      : 0;

    let phase = 'idle';
    if (tasks.some((task) => task.stage === 'fetch' && task.status === 'running')) {
      phase = 'fetching_routes';
    } else if (tasks.some((task) => task.stage === 'transform' && task.status === 'running')) {
      phase = 'simplifying_routes';
    } else if (tasks.some((task) => task.stage === 'vt' && task.status === 'running')) {
      phase = 'generating_vector_tiles';
    }

    return {
      phase,
      progress: Number.isFinite(percentage) ? percentage : 0,
      completedRoutes,
      totalRoutes: fetchTasks.length,
      errors: failedTasks.map((task) => task.error ?? 'Unknown error'),
    };
  }

  private emitProgressEvent(event: BuildProgressEvent): void {
    const payload = event.payload ?? {};
    const total = coerceNumber(payload.total);
    const completed = coerceNumber(payload.completed);
    const percentage = computePercentage(total, completed, event.phase === 'completed');
    const phase = normalizeRouteProgressStage(event.stage);
    const ts = event.timestamp ?? Date.now();
    const update: ProgressUpdate = {
      jobId: event.nodeId,
      progress: percentage,
      stage: event.stage,
      phase,
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

function createRouteTaskData(route: RouteBuildRouteInput, config: RouteBuildConfig): RouteBuildTask['routeData'] {
  return {
    startLocationId: route?.startLocationId,
    endLocationId: route?.endLocationId,
    method: route?.method ?? config.routeGeneration.method,
    ...(route?.startCoordinates && route?.endCoordinates ? {
      startCoordinates: route.startCoordinates,
      endCoordinates: route.endCoordinates,
    } : {}),
    ...(route?.methodOptions ? { methodOptions: route.methodOptions } : {}),
  };
}

function toTaskQueueRecord(task: RouteBuildTask): TaskQueueRecord {
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: task.stage as TaskStage,
    status: 'queued',
    index: task.index,
    progress: 0,
    inputData: {
      routeStage: task.stage,
      routeData: task.routeData,
    },
  };
}

function normalizeRouteProgressStage(stage: string): string {
  switch (stage) {
    case 'fetch':
      return 'fetching_routes';
    case 'transform':
      return 'simplifying_routes';
    case 'vt':
      return 'generating_vector_tiles';
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
