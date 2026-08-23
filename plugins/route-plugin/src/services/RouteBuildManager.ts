/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import type {
  RouteBuildConfig,
  RouteBuildRouteInput,
  RouteGenerationConfig,
} from '@hierarchidb/route-api';
import type { RouteEnginesProvider } from '@hierarchidb/route-engine';
import { initializeRouteDB } from '@hierarchidb/route-store';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { deleteTasksByNode, putTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import {
  RouteBuildSession,
  type RouteBuildSessionDeps,
  type RouteBuildTask,
  toRouteTaskQueueRecord,
} from './RouteBuildSession.js';
import { buildRouteSourceIdentity } from './routeSourceIdentity.js';

export type RouteBuildManagerDeps = {
  engines?: RouteEnginesProvider;
  session?: RouteBuildSessionDeps;
};

export class RouteBuildManager {
  constructor(protected readonly deps?: RouteBuildManagerDeps) {}

  async createRouteBuildSession(
    nodeId: NodeId,
    config: RouteBuildConfig,
    routes: RouteBuildRouteInput[]
  ): Promise<RouteBuildSession> {
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

    if (this.deps?.session?.ephemeralStore === undefined) {
      initializeEphemeralDB(getDBName(getBuildDatabasePrefix(), 'ephemeral'));
      initializeRouteDB(getDBName(getBuildDatabasePrefix(), 'route'));
    }
    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await putTasks(
      taskQueue,
      routeTasks.map((task) => toRouteTaskQueueRecord(task))
    );

    const session = new RouteBuildSession(nodeId, config, routeTasks, {
      ...this.deps?.session,
      ...(this.deps?.engines === undefined ? {} : { engines: this.deps.engines }),
    });
    await session.initialize();
    return session;
  }
}

function createRouteTaskData(
  route: RouteBuildRouteInput,
  config: RouteBuildConfig
): NonNullable<RouteBuildTask['routeData']> {
  const method = route.method ?? config.routeGeneration.method;
  const generation = {
    method,
    routeMode: route.routeMode,
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
