/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Build infrastructure
 */

import type { TaskQueueRecord, TaskStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  RouteBuildConfig,
  RouteFeature,
  RouteGenerationConfig,
  RouteMode,
} from '@hierarchidb/route-api';
import type { RouteEnginesProvider } from '@hierarchidb/route-engine';
import { deleteTasksByNode, putTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import {
  RouteBuildSession,
  type RouteBuildSessionDeps,
  type RouteBuildTask,
} from './RouteBuildSession.js';
import { buildRouteSourceIdentity } from './routeSourceIdentity.js';

export type RouteBuildManagerDeps = {
  engines?: RouteEnginesProvider;
  session?: RouteBuildSessionDeps;
};

export type RouteBuildManagerHooks = {
  onSessionReady: (session: RouteBuildSession) => void;
};

export type RouteBuildRouteInput = {
  startLocationId: NodeId;
  endLocationId: NodeId;
  startCoordinates: [number, number];
  endCoordinates: [number, number];
  routeMode: RouteMode;
  metadata?: RouteFeature['metadata'];
  method?: RouteGenerationConfig['method'];
  methodOptions?: RouteGenerationConfig['options'];
};

export type RouteBuildRouteCandidate = Partial<RouteBuildRouteInput>;

const logRouteBuildWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[RouteBuildManager]', message, error);
};

export class RouteBuildManager {
  constructor(
    protected readonly deps?: RouteBuildManagerDeps,
    private readonly hooks?: RouteBuildManagerHooks
  ) {}

  private routeSpecificTasks = new Map<NodeId, RouteBuildTask[]>();
  private activeSessions = new Map<NodeId, RouteBuildSession>();

  async startRouteBuildSession(
    nodeId: NodeId,
    config: RouteBuildConfig,
    routes: RouteBuildRouteInput[]
  ): Promise<NodeId> {
    const existingSession = this.activeSessions.get(nodeId);
    if (existingSession) {
      if (existingSession.getState().status === 'failed') {
        throw new Error(`Route build session still has an active run for node ${String(nodeId)}`);
      }
      return nodeId;
    }

    const routeTasks: RouteBuildTask[] = [];
    const routeTaskData = routes.map((route) => createRouteTaskData(route, config));

    for (let i = 0; i < routeTaskData.length; i++) {
      const routeData = routeTaskData[i];
      if (!routeData) throw new Error(`Route ${String(i)} task data is missing`);
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'source',
        status: 'queued',
        progress: 0,
        version: 1,
        index: routeTasks.length,
        routeData,
      });
    }

    for (let i = 0; i < routeTaskData.length; i++) {
      const routeData = routeTaskData[i];
      if (!routeData) throw new Error(`Route ${String(i)} task data is missing`);
      routeTasks.push({
        taskId: crypto.randomUUID(),
        treeNodeId: nodeId,
        nodeId,
        stage: 'geometry',
        status: 'queued',
        progress: 0,
        version: 1,
        index: routeTasks.length,
        routeData,
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
    await putTasks(
      taskQueue,
      routeTasks.map((task) => toTaskQueueRecord(task))
    );

    const session = new RouteBuildSession(nodeId, config, routeTasks, {
      ...this.deps?.session,
      ...(this.deps?.engines === undefined ? {} : { engines: this.deps.engines }),
    });
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
    const percentage = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

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
      progress: percentage,
      completedRoutes,
      totalRoutes: sourceTasks.length,
      errors: failedTasks.map((task) => {
        if (!task.error) {
          throw new Error(`Failed route task ${task.taskId} is missing an error message`);
        }
        return task.error;
      }),
    };
  }
}

export const requireRouteBuildRouteInput = (
  candidate: RouteBuildRouteCandidate,
  index: number
): RouteBuildRouteInput => {
  const prefix = `Route ${String(index)}`;
  if (!candidate.startLocationId) throw new Error(`${prefix} is missing startLocationId`);
  if (!candidate.endLocationId) throw new Error(`${prefix} is missing endLocationId`);
  if (!candidate.startCoordinates) throw new Error(`${prefix} is missing startCoordinates`);
  if (!candidate.endCoordinates) throw new Error(`${prefix} is missing endCoordinates`);
  if (!candidate.routeMode) throw new Error(`${prefix} is missing routeMode`);
  return {
    startLocationId: candidate.startLocationId,
    endLocationId: candidate.endLocationId,
    startCoordinates: candidate.startCoordinates,
    endCoordinates: candidate.endCoordinates,
    routeMode: candidate.routeMode,
    ...(candidate.metadata === undefined ? {} : { metadata: candidate.metadata }),
    ...(candidate.method === undefined ? {} : { method: candidate.method }),
    ...(candidate.methodOptions === undefined ? {} : { methodOptions: candidate.methodOptions }),
  };
};

function createRouteTaskData(
  route: RouteBuildRouteInput,
  config: RouteBuildConfig
): NonNullable<RouteBuildTask['routeData']> {
  const method = route.method ?? config.routeGeneration.method;
  const generation = {
    method,
    ...(route.methodOptions === undefined ? {} : { options: route.methodOptions }),
  } satisfies RouteGenerationConfig;
  const identity = buildRouteSourceIdentity({
    routeMode: route.routeMode,
    start: {
      locationId: route.startLocationId,
      coordinates: route.startCoordinates,
    },
    end: {
      locationId: route.endLocationId,
      coordinates: route.endCoordinates,
    },
    generation,
    sourceConfig: config.sourceConfig,
    metadata: route.metadata,
  });
  return {
    startLocationId: identity.from.locationId,
    endLocationId: identity.to.locationId,
    startCoordinates: identity.from.coordinates,
    endCoordinates: identity.to.coordinates,
    routeMode: route.routeMode,
    method,
    sourceKey: identity.sourceKey,
    inputHash: identity.inputHash,
    bidirectional: identity.bidirectional,
    ...(route.methodOptions === undefined ? {} : { methodOptions: route.methodOptions }),
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
      ...(task.routeData
        ? {
            cacheKey: task.routeData.sourceKey,
            inputHash: task.routeData.inputHash,
          }
        : {}),
    },
  };
}
