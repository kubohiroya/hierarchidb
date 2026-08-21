import type { CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { createLiveCanonicalPluginBuildSubscriptions } from '@hierarchidb/build-runtime-services';
import type { LocationBuildConfig } from '~/common/entities/LocationEntity.js';
import { LocationBuildManager } from '~/services/LocationBuildManager.js';

const manager = new LocationBuildManager();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[location canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireBuildConfig = (value: unknown): LocationBuildConfig => {
  const config = requireRecord(value, 'draftData.buildConfig');
  if (!Array.isArray(config.searchConfigs)) {
    throw new Error(
      '[location canonical build API] draftData.buildConfig.searchConfigs must be an array'
    );
  }
  requireRecord(config.processingOptions, 'draftData.buildConfig.processingOptions');
  return value as LocationBuildConfig;
};

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[location canonical build API] draftData.buildConfig is required');
    }
    const buildConfig = requireBuildConfig(draft.buildConfig);
    await manager.startLocationBuildSession(nodeId, buildConfig);
    return manager.getBuildSessionStatus(nodeId);
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
      `[location canonical build API] cannot cancel session from status ${status.status}`
    );
  },
  getBuildTasks: async (nodeId) => {
    throw new Error(
      `[location canonical build API] authoritative task query is unavailable for node ${String(nodeId)}`
    );
  },
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
