import type { CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { createLiveCanonicalPluginBuildSubscriptions } from '@hierarchidb/build-runtime-services';
import type {
  LocationBuildConfig,
  LocationDataSource,
  LocationType,
} from '~/common/entities/LocationEntity.js';
import { LocationBuildManager } from '~/services/LocationBuildManager.js';

const manager = new LocationBuildManager();
const subscriptions = createLiveCanonicalPluginBuildSubscriptions();

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[location canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const LOCATION_TYPES = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
] as const satisfies readonly LocationType[];

const WORKER_BUILD_DATA_SOURCES = new Set<LocationDataSource>([
  'openstreetmap',
  'overpass',
  'ourairports',
  'openflights',
  'world-port-index',
]);

const requireDataSource = (value: unknown): LocationDataSource => {
  if (typeof value !== 'string' || !WORKER_BUILD_DATA_SOURCES.has(value as LocationDataSource)) {
    throw new Error(
      `[location canonical build API] draftData.dataSource is not supported by the Worker build session: ${String(value)}`
    );
  }
  return value as LocationDataSource;
};

const requireConcurrentDownloads = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(
      `[location canonical build API] draftData.concurrentDownloads must be a positive integer, received ${String(value)}`
    );
  }
  return value as number;
};

const createBuildConfig = (draft: Record<string, unknown>): LocationBuildConfig => {
  const dataSource = requireDataSource(draft.dataSource);
  const concurrent = requireConcurrentDownloads(draft.concurrentDownloads);
  const selection = requireRecord(
    draft.selectedArrayByCountries,
    'draftData.selectedArrayByCountries'
  );
  const searchConfigs = Object.entries(selection)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([rawCountryCode, rawRow]) => {
      if (!/^[A-Z]{2}$/.test(rawCountryCode)) {
        throw new Error(
          `[location canonical build API] selected country code must be an uppercase ISO 3166-1 alpha-2 code: ${rawCountryCode}`
        );
      }
      const countryCode = rawCountryCode;
      if (!Array.isArray(rawRow) || rawRow.length !== LOCATION_TYPES.length) {
        throw new Error(
          `[location canonical build API] selection row for ${countryCode} must contain ${String(LOCATION_TYPES.length)} booleans`
        );
      }
      if (!rawRow.every((selected) => typeof selected === 'boolean')) {
        throw new Error(
          `[location canonical build API] selection row for ${countryCode} must contain only booleans`
        );
      }
      const types = LOCATION_TYPES.filter((_type, index) => rawRow[index] === true);
      return types.length === 0 ? [] : [{ dataSource, countryCode, types }];
    });
  if (searchConfigs.length === 0) {
    throw new Error(
      '[location canonical build API] draftData.selectedArrayByCountries must select at least one location type'
    );
  }
  return {
    searchConfigs,
    concurrentDownloads: concurrent,
    processingOptions: { concurrent },
  };
};

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    const buildConfig = createBuildConfig(draft);
    await manager.startLocationBuildSession(nodeId, buildConfig);
    return manager.getBuildSessionStatus(nodeId);
  },
  getBuildSessionStatus: (nodeId) => manager.getBuildSessionStatus(nodeId),
  pauseBuildSession: (nodeId, reason) => manager.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) => manager.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks: (nodeId) => manager.getBuildTasks(nodeId),
  ...subscriptions,
} satisfies CanonicalPluginBuildAPI;
