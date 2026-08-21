/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-store';
import {
  RouteBuildSession,
  type RouteBuildSessionDeps,
  type RouteBuildTask,
} from './RouteBuildSession.js';
import type { TaskStage, TaskQueueRecord } from '@hierarchidb/build-api';
import { VtTaskQueueDb, deleteTasksByNode, putTasks } from '@hierarchidb/vt-orchestrator';

export type RouteBuildManagerDeps = {
  engines?: unknown;
  session?: RouteBuildSessionDeps;
};

export type RouteBuildManagerHooks = {
  onSessionReady: (session: RouteBuildSession) => void;
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
  constructor(
    protected readonly deps?: RouteBuildManagerDeps,
    private readonly hooks?: RouteBuildManagerHooks,
  ) { }

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
      if (!route) {
        throw new Error(`Route ${i} is missing coordinates`);
      }
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'source',
        status: 'queued',
        progress: 0,
        version: 1,
        index: routeTasks.length,
        routeData: createRouteTaskData(route, config),
      });
    }

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (!route) {
        throw new Error(`Route ${i} is missing coordinates`);
      }
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'geometry',
        status: 'queued',
        progress: 0,
        version: 1,
        index: routeTasks.length,
        routeData: createRouteTaskData(route, config),
      });
    }

    routeTasks.push({
      taskId: crypto.randomUUID(),
      treeNodeId: nodeId,
      nodeId,
      stage: 'tileEmit',
      status: 'queued',
      progress: 0,
      version: 1,
      index: routeTasks.length,
    });

    this.routeSpecificTasks.set(nodeId, routeTasks);

    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await putTasks(taskQueue, routeTasks.map((task) => toTaskQueueRecord(task)));

    const session = new RouteBuildSession(nodeId, config, routeTasks, this.deps?.session);
    this.activeSessions.set(nodeId, session);
    await session.initialize();
    this.hooks?.onSessionReady(session);
    const runPromise = session.start();
    void runPromise
      .catch((error: unknown) => {
        logRouteBuildWarning('Route build session failed', error);
      })
      .finally(() => {
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

    const sourceTasks = tasks.filter((task) => task.stage === 'source');
    const completedRoutes = sourceTasks.filter((task) => task.status === 'completed').length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0
      ? Math.min(100, Math.max(0, (completedTasks.length / totalTasks) * 100))
      : 0;

    let phase = 'idle';
    if (tasks.some((task) => task.stage === 'source' && task.status === 'running')) {
      phase = 'sourcing_routes';
    } else if (tasks.some((task) => task.stage === 'geometry' && task.status === 'running')) {
      phase = 'geometry_processing_routes';
    } else if (tasks.some((task) => task.stage === 'tileEmit' && task.status === 'running')) {
      phase = 'tile_emitting_routes';
    }

    return {
      phase,
      progress: Number.isFinite(percentage) ? percentage : 0,
      completedRoutes,
      totalRoutes: sourceTasks.length,
      errors: failedTasks.map((task) => task.error ?? 'Unknown error'),
    };
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
    version: task.version,
    stage: task.stage as TaskStage,
    status: 'queued',
    index: task.index,
    progress: task.progress,
    inputData: {
      routeStage: task.stage,
      routeData: task.routeData,
    },
  };
}
