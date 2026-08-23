import {
  type CanonicalPluginBuildAPI,
  type CanonicalPluginBuildStartRequest,
  isLegacyCanonicalPluginBuildStartRequest,
  type LegacyCanonicalPluginBuildStartRequest,
} from '@hierarchidb/build-api';
import {
  createCanonicalBuildRuntimeAdapter,
  createLiveCanonicalPluginBuildSubscriptions,
} from '@hierarchidb/build-runtime-services';
import { LocationBuildManager } from '~/services/LocationBuildManager.js';
import { PLUGIN_NODE_TYPE } from '../plugin-manifest.js';
import { requireLocationBuildConfig } from './requireLocationBuildConfig.js';

const manager = new LocationBuildManager();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();

export const canonicalBuildRuntimeAdapter = createCanonicalBuildRuntimeAdapter({
  nodeType: PLUGIN_NODE_TYPE,
  inventory: manager,
});

const resolveStartPayload = (
  request: CanonicalPluginBuildStartRequest | LegacyCanonicalPluginBuildStartRequest
): unknown =>
  isLegacyCanonicalPluginBuildStartRequest(request) ? request.draftData : request.input.payload;

export const canonicalBuildAPI = {
  startBuildSession: async (request) => {
    const { nodeId } = request;
    const prepared = requireLocationBuildConfig(resolveStartPayload(request));
    await manager.startLocationBuildSession(nodeId, prepared.config, prepared.sourcePlan);
    return manager.getBuildSessionStatus(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId, reason) => manager.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) => manager.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks: (nodeId) => manager.getBuildTasks(nodeId),
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
