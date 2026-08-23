import type { LocationBuildConfig, LocationDataSource } from '~/common/entities/LocationEntity.js';
import { createLocationSourcePlan } from '~/services/source/createLocationSourcePlan.js';
import {
  type LocationSourcePlan,
  type PreparedLocationBuild,
} from '~/services/source/LocationSourcePlan.js';

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[location canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireDataSource = (value: unknown): LocationDataSource => {
  if (typeof value !== 'string') {
    throw new Error(
      `[location canonical build API] payload.dataSource must be a string, received ${String(value)}`
    );
  }
  return value as LocationDataSource;
};

const requireConcurrentDownloads = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(
      `[location canonical build API] payload.concurrentDownloads must be a positive integer, received ${String(value)}`
    );
  }
  return value as number;
};

export const requireLocationBuildConfig = (payload: unknown): PreparedLocationBuild => {
  const record = requireRecord(payload, 'payload');
  const dataSource = requireDataSource(record.dataSource);
  const concurrent = requireConcurrentDownloads(record.concurrentDownloads);
  const selectedArrayByCountries = requireRecord(
    record.selectedArrayByCountries,
    'payload.selectedArrayByCountries'
  ) as Record<string, readonly boolean[]>;
  const sourcePlan = createLocationSourcePlan({
    dataSource,
    selectedArrayByCountries,
  });
  return {
    config: createBuildConfig(sourcePlan, concurrent),
    sourcePlan,
  };
};

const createBuildConfig = (
  sourcePlan: LocationSourcePlan,
  concurrent: number
): LocationBuildConfig => ({
  searchConfigs: sourcePlan.searchConfigs.map((searchConfig) => ({
    ...searchConfig,
    types: searchConfig.types ? [...searchConfig.types] : undefined,
  })),
  concurrentDownloads: concurrent,
  processingOptions: { concurrent },
});
