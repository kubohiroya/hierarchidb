import type { CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { createLiveCanonicalPluginBuildSubscriptions } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import {
  ROUTE_MODES,
  type RouteBuildRouteInput,
  type RouteBuildStartInput,
  type RouteMode,
} from '@hierarchidb/route-api';
import { RouteBuildSessionOrchestrator } from '~/services/RouteBuildSessionOrchestrator.js';
import { getBuildTasks } from './getBuildTasks.js';
import { requireRouteBuildConfig } from './requireRouteBuildConfig.js';

const manager = new RouteBuildSessionOrchestrator();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();
const ROUTE_MODE_VALUES = new Set<RouteMode>(Object.values(ROUTE_MODES));

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[route canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireNodeId = (value: unknown, label: string): NodeId => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[route canonical build API] ${label} must be a non-empty string`);
  }
  return value as NodeId;
};

const requireCoordinate = (value: unknown, label: string): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`[route canonical build API] ${label} must be a longitude/latitude pair`);
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(`[route canonical build API] ${label} contains invalid coordinates`);
  }
  return [longitude, latitude];
};

const requireRouteMode = (value: unknown, label: string): RouteMode => {
  if (!ROUTE_MODE_VALUES.has(value as RouteMode)) {
    throw new Error(`[route canonical build API] ${label} is unsupported: ${String(value)}`);
  }
  return value as RouteMode;
};

const requireDirectRouteInput = (draft: Record<string, unknown>): RouteBuildRouteInput => {
  const startLocationId = requireNodeId(draft.startLocationId, 'draftData.startLocationId');
  const endLocationId = requireNodeId(draft.endLocationId, 'draftData.endLocationId');
  if (!Array.isArray(draft.lineGeometry) || draft.lineGeometry.length < 2) {
    throw new Error(
      '[route canonical build API] draftData.lineGeometry must contain at least two coordinates'
    );
  }
  const startCoordinates = requireCoordinate(draft.lineGeometry[0], 'draftData.lineGeometry[0]');
  const endCoordinates = requireCoordinate(
    draft.lineGeometry[draft.lineGeometry.length - 1],
    `draftData.lineGeometry[${String(draft.lineGeometry.length - 1)}]`
  );
  return {
    startLocationId,
    endLocationId,
    startCoordinates,
    endCoordinates,
    routeMode: requireRouteMode(draft.routeMode, 'draftData.routeMode'),
  };
};

const hasDirectRouteInput = (draft: Record<string, unknown>): boolean =>
  Object.hasOwn(draft, 'startLocationId') ||
  Object.hasOwn(draft, 'endLocationId') ||
  Object.hasOwn(draft, 'lineGeometry') ||
  Object.hasOwn(draft, 'routeMode');

const hasSelectionDrivenInput = (draft: Record<string, unknown>): boolean =>
  Object.hasOwn(draft, 'tabularSourceId') || Object.hasOwn(draft, 'selectedArrayByCountries');

const requireRouteBuildStartInput = (draft: Record<string, unknown>): RouteBuildStartInput => {
  const startInput = requireRecord(draft.routeBuildInput, 'draftData.routeBuildInput');
  const kind = startInput.kind;
  if (kind === 'direct-route') {
    if (hasSelectionDrivenInput(draft)) {
      throw new Error(
        '[route canonical build API] direct-route input must not include selection-driven fields'
      );
    }
    return { kind };
  }
  if (kind === 'selection-driven') {
    if (hasDirectRouteInput(draft)) {
      throw new Error(
        '[route canonical build API] selection-driven input must not include direct-route fields'
      );
    }
    if (!Array.isArray(startInput.routes) || startInput.routes.length === 0) {
      throw new Error(
        '[route canonical build API] draftData.routeBuildInput.routes must contain at least one resolved route'
      );
    }
    return {
      kind,
      routes: startInput.routes.map((route, index) => requireResolvedRouteInput(route, index)),
    };
  }
  throw new Error(
    `[route canonical build API] draftData.routeBuildInput.kind is unsupported: ${String(kind)}`
  );
};

const requireResolvedRouteInput = (value: unknown, index: number): RouteBuildRouteInput => {
  const route = requireRecord(value, `draftData.routeBuildInput.routes[${String(index)}]`);
  return {
    startLocationId: requireNodeId(
      route.startLocationId,
      `draftData.routeBuildInput.routes[${String(index)}].startLocationId`
    ),
    endLocationId: requireNodeId(
      route.endLocationId,
      `draftData.routeBuildInput.routes[${String(index)}].endLocationId`
    ),
    startCoordinates: requireCoordinate(
      route.startCoordinates,
      `draftData.routeBuildInput.routes[${String(index)}].startCoordinates`
    ),
    endCoordinates: requireCoordinate(
      route.endCoordinates,
      `draftData.routeBuildInput.routes[${String(index)}].endCoordinates`
    ),
    routeMode: requireRouteMode(
      route.routeMode,
      `draftData.routeBuildInput.routes[${String(index)}].routeMode`
    ),
    ...(route.metadata === undefined
      ? {}
      : {
          metadata: requireRouteMetadata(
            route.metadata,
            `draftData.routeBuildInput.routes[${String(index)}].metadata`
          ),
        }),
  };
};

const requireRouteMetadata = (
  value: unknown,
  label: string
): NonNullable<RouteBuildRouteInput['metadata']> => {
  const record = requireRecord(value, label);
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new Error(`[route canonical build API] ${label}.${key} must be a primitive value`);
    }
  }
  return record as NonNullable<RouteBuildRouteInput['metadata']>;
};

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[route canonical build API] draftData.buildConfig is required');
    }
    const buildConfig = requireRouteBuildConfig(draft.buildConfig);
    const startInput = requireRouteBuildStartInput(draft);
    const routes =
      startInput.kind === 'direct-route' ? [requireDirectRouteInput(draft)] : startInput.routes;
    await manager.prepareSession(nodeId, buildConfig, { routes });
    return manager.startBuildSession(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId, reason) => manager.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) => manager.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks,
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
