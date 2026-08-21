import { requireCanonicalStageBuildConfig } from '@hierarchidb/build-runtime-services';
import type { RouteBuildConfig, RouteGenerationMethod } from '@hierarchidb/route-api';

const ROUTE_GENERATION_METHODS = new Set<RouteGenerationMethod>([
  'direct',
  'osm_route',
  'great_circle',
  'searoute',
  'custom',
]);

export const requireRouteBuildConfig = (value: unknown): RouteBuildConfig => {
  const config = requireCanonicalStageBuildConfig(value, {
    errorPrefix: 'route canonical build API',
    label: 'draftData.buildConfig',
    requireSourceExecutionFields: true,
    requireGeometryExecutionFields: true,
    requireTileExecutionFields: true,
  });
  requireRouteGeneration(config.routeGeneration);
  requireOptionalConfig(config.cleanupConfig, 'draftData.buildConfig.cleanupConfig');
  requireOptionalConfig(config.routeGeometryConfig, 'draftData.buildConfig.routeGeometryConfig');
  requireOptionalConfig(config.locationResolution, 'draftData.buildConfig.locationResolution');
  requireOptionalConfig(config.validation, 'draftData.buildConfig.validation');
  requireOptionalConfig(config.laneCaps, 'draftData.buildConfig.laneCaps');
  return value as RouteBuildConfig;
};

const requireRouteGeneration = (value: unknown): void => {
  const config = requireRecord(value, 'draftData.buildConfig.routeGeneration');
  requireEnum(
    config.method,
    ROUTE_GENERATION_METHODS,
    'draftData.buildConfig.routeGeneration.method'
  );
  requireBoolean(config.parallel, 'draftData.buildConfig.routeGeneration.parallel');
  requirePositiveInteger(
    config.maxConcurrent,
    'draftData.buildConfig.routeGeneration.maxConcurrent'
  );
  requireBoolean(config.retryOnFailure, 'draftData.buildConfig.routeGeneration.retryOnFailure');
  requireNonNegativeInteger(config.maxRetries, 'draftData.buildConfig.routeGeneration.maxRetries');
};

const requireOptionalConfig = (value: unknown, label: string): void => {
  if (value !== undefined) requireRecord(value, label);
};

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[route canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireBoolean = (value: unknown, label: string): void => {
  if (typeof value !== 'boolean') {
    throw new Error(`[route canonical build API] ${label} must be boolean`);
  }
};

const requirePositiveInteger = (value: unknown, label: string): void => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`[route canonical build API] ${label} must be a positive integer`);
  }
};

const requireNonNegativeInteger = (value: unknown, label: string): void => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`[route canonical build API] ${label} must be a non-negative integer`);
  }
};

const requireEnum = (value: unknown, allowed: ReadonlySet<unknown>, label: string): void => {
  if (!allowed.has(value)) {
    throw new Error(`[route canonical build API] ${label} is not supported: ${String(value)}`);
  }
};
