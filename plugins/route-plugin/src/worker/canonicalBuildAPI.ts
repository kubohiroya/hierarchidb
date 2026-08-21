import type { CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { createLiveCanonicalPluginBuildSubscriptions } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildRouteInput } from '~/services/RouteBuildManager.js';
import { RouteBuildSessionOrchestrator } from '~/services/RouteBuildSessionOrchestrator.js';
import { getBuildTasks } from './getBuildTasks.js';
import { requireRouteBuildConfig } from './requireRouteBuildConfig.js';

const manager = new RouteBuildSessionOrchestrator();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();

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
  };
};

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[route canonical build API] draftData.buildConfig is required');
    }
    const buildConfig = requireRouteBuildConfig(draft.buildConfig);
    const routes = [requireDirectRouteInput(draft)];
    await manager.prepareSession(nodeId, buildConfig, { routes });
    return manager.startBuildSession(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId, reason) => manager.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) => manager.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks,
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
