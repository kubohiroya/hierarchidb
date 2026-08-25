/**
 * @file RouteBuildManager.ts
 * @description Route build processing manager extending Build infrastructure
 */

import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import {
  ROUTE_MODES,
  type RouteBuildConfig,
  type RouteBuildRouteInput,
  type RouteGenerationConfig,
  type RouteGenerationMethod,
  type RouteGenerationOptions,
  type RouteMethodSetting,
  type RouteMode,
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
  const materializedGeneration = materializeSourcePlannedRouteGeneration(route, config);
  const generation = {
    method: materializedGeneration.method,
    routeMode: route.routeMode,
    ...(materializedGeneration.options === undefined
      ? {}
      : { options: materializedGeneration.options }),
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
    method: materializedGeneration.method,
    sourceKey: identity.sourceKey,
    inputHash: identity.inputHash,
    bidirectional: identity.bidirectional,
    ...(materializedGeneration.options === undefined
      ? {}
      : { methodOptions: materializedGeneration.options }),
  };
}

export function materializeSourcePlannedRouteGeneration(
  route: Pick<RouteBuildRouteInput, 'routeMode' | 'method' | 'methodOptions'>,
  config: Pick<RouteBuildConfig, 'routeMethodSettings' | 'geometryConfig'>
): { method: RouteGenerationMethod; options?: RouteGenerationOptions } {
  const setting = resolveRouteMethodSetting(route.routeMode, config);
  const method = materializeSourcePlannedRouteGenerationMethod(route, setting.method);
  const options = resolveRouteMethodOptions(route, setting, config);
  return {
    method,
    ...(options === undefined ? {} : { options }),
  };
}

export function materializeSourcePlannedRouteGenerationMethod(
  route: Pick<RouteBuildRouteInput, 'routeMode' | 'method'>,
  configuredMethod: RouteGenerationMethod
): RouteGenerationMethod {
  switch (route.routeMode) {
    case ROUTE_MODES.AIRWAY: {
      if (route.method !== undefined && route.method !== 'great_circle') {
        throw new Error('routeMode airway requires generation method great_circle');
      }
      return 'great_circle';
    }
    case ROUTE_MODES.WATERWAY: {
      if (route.method !== undefined && route.method !== 'searoute') {
        throw new Error('routeMode waterway requires generation method searoute');
      }
      return 'searoute';
    }
    case ROUTE_MODES.RAILWAY:
    case ROUTE_MODES.H_RAILWAY:
    case ROUTE_MODES.ROAD:
    case ROUTE_MODES.HIGHWAY: {
      const method = route.method ?? configuredMethod;
      if (method !== 'direct' && method !== 'osm_route' && method !== 'custom') {
        throw new Error(
          `routeMode ${route.routeMode} does not support generation method ${method}`
        );
      }
      return method;
    }
    default:
      throw new Error(
        `[route source planning] routeMode is unsupported for generation method materialization: ${String(route.routeMode)}`
      );
  }
}

const resolveRouteMethodSetting = (
  routeMode: RouteMode,
  config: Pick<RouteBuildConfig, 'routeMethodSettings'>
): RouteMethodSetting => {
  const override = config.routeMethodSettings.overrides?.[routeMode];
  const setting = override ?? config.routeMethodSettings.defaults[routeMode];
  if (setting === undefined) {
    throw new Error(`[route source planning] routeMode ${routeMode} has no method setting`);
  }
  return setting;
};

const resolveRouteMethodOptions = (
  route: Pick<RouteBuildRouteInput, 'routeMode' | 'methodOptions'>,
  setting: RouteMethodSetting,
  config: Pick<RouteBuildConfig, 'geometryConfig'>
): RouteGenerationOptions | undefined => {
  if (route.methodOptions !== undefined) return route.methodOptions;
  if (setting.method !== 'great_circle') return setting.options;
  const greatCircle = setting.greatCircle;
  if (greatCircle === undefined) {
    throw new Error('routeMode airway requires great_circle detail settings');
  }
  const bandCount = config.geometryConfig.zoomBandBoundaries.length - 1;
  const numPoints = resolveGreatCircleNumPoints(
    greatCircle.numPoints,
    greatCircle.numPointsByZoomBand,
    bandCount
  );
  return {
    ...(setting.options ?? {}),
    numPoints,
  };
};

const resolveGreatCircleNumPoints = (
  defaultNumPoints: number,
  byZoomBand: number[] | undefined,
  bandCount: number
): number => {
  if (!Number.isInteger(defaultNumPoints) || defaultNumPoints <= 0) {
    throw new Error('great_circle detail numPoints must be a positive integer');
  }
  if (byZoomBand === undefined) return defaultNumPoints;
  if (byZoomBand.length !== bandCount) {
    throw new Error('great_circle detail numPointsByZoomBand length must match route zoom band count');
  }
  let maximum = 0;
  for (const [index, value] of byZoomBand.entries()) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `great_circle detail numPointsByZoomBand[${String(index)}] must be a positive integer`
      );
    }
    maximum = Math.max(maximum, value);
  }
  return maximum;
};
