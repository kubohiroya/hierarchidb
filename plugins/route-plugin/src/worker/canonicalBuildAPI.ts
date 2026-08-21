import type { CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { createLiveCanonicalPluginBuildSubscriptions } from '@hierarchidb/build-runtime-services';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import type { RouteBuildRouteInput } from '~/services/RouteBuildManager.js';
import { RouteBuildSessionOrchestrator } from '~/services/RouteBuildSessionOrchestrator.js';
import { getBuildTasks } from './getBuildTasks.js';

const manager = new RouteBuildSessionOrchestrator();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[route canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireBuildConfig = (value: unknown): RouteBuildConfig => {
  const config = requireRecord(value, 'draftData.buildConfig');
  for (const field of ['sourceConfig', 'geometryConfig', 'tileEmitConfig', 'routeGeneration']) {
    requireRecord(config[field], `draftData.buildConfig.${field}`);
  }
  return value as RouteBuildConfig;
};

const requireRoutes = (value: unknown): RouteBuildRouteInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('[route canonical build API] draftData.routes must be a non-empty array');
  }
  return value as RouteBuildRouteInput[];
};

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[route canonical build API] draftData.buildConfig is required');
    }
    const buildConfig = requireBuildConfig(draft.buildConfig);
    const routes = requireRoutes(draft.routes);
    await manager.prepareSession(nodeId, buildConfig, { routes });
    return manager.startBuildSession(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId) => manager.pauseBuildSession(nodeId),
  cancelQueuedBuildSession: async (nodeId) => {
    const status = await manager.getBuildSessionStatus(nodeId);
    if (status.status === 'running') {
      await manager.pauseBuildSession(nodeId);
      return;
    }
    throw new Error(
      `[route canonical build API] cannot cancel session from status ${status.status}`
    );
  },
  getBuildTasks,
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
