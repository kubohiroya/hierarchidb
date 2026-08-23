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
    label: 'payload.buildConfig',
    requireSourceExecutionFields: true,
    requireGeometryExecutionFields: true,
    requireTileExecutionFields: true,
  });
  requireRouteGeneration(config.routeGeneration);
  requireOptionalConfig(config.cleanupConfig, 'payload.buildConfig.cleanupConfig');
  requireRouteGeometryConfig(config.geometryConfig, config.routeGeometryConfig);
  requireOptionalConfig(config.locationResolution, 'payload.buildConfig.locationResolution');
  requireOptionalConfig(config.validation, 'payload.buildConfig.validation');
  requireOptionalConfig(config.laneCaps, 'payload.buildConfig.laneCaps');
  return value as RouteBuildConfig;
};

const requireRouteGeometryConfig = (geometryValue: unknown, routeValue: unknown): void => {
  const geometry = requireRecord(geometryValue, 'payload.buildConfig.geometryConfig');
  const route = requireRecord(routeValue, 'payload.buildConfig.routeGeometryConfig');
  const boundaries = requireStrictZoomBoundaries(
    geometry.zoomBandBoundaries,
    'payload.buildConfig.geometryConfig.zoomBandBoundaries'
  );
  if (geometry.enableFeatureFiltering !== true) {
    throw new Error(
      '[route canonical build API] payload.buildConfig.geometryConfig.enableFeatureFiltering must be true'
    );
  }
  requireEnum(
    geometry.geometryEngine,
    new Set(['turf']),
    'payload.buildConfig.geometryConfig.geometryEngine'
  );
  requireEnum(
    geometry.simplifyAlgorithm,
    new Set(['geojson']),
    'payload.buildConfig.geometryConfig.simplifyAlgorithm'
  );
  const bandCount = boundaries.length - 1;
  requireBandValues(
    route.minDistanceMetersByBand,
    bandCount,
    'payload.buildConfig.routeGeometryConfig.minDistanceMetersByBand'
  );
  requireBandValues(
    route.simplifyToleranceByBand,
    bandCount,
    'payload.buildConfig.routeGeometryConfig.simplifyToleranceByBand'
  );
};

const requireStrictZoomBoundaries = (value: unknown, label: string): number[] => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`[route canonical build API] ${label} must contain at least two values`);
  }
  const boundaries = value.map((candidate, index) => {
    if (!Number.isInteger(candidate) || (candidate as number) < 0 || (candidate as number) > 22) {
      throw new Error(
        `[route canonical build API] ${label}[${String(index)}] must be an integer in 0..22`
      );
    }
    return candidate as number;
  });
  for (let index = 1; index < boundaries.length; index += 1) {
    const previous = boundaries[index - 1];
    const current = boundaries[index];
    if (previous === undefined || current === undefined || current <= previous) {
      throw new Error(`[route canonical build API] ${label} must be strictly increasing`);
    }
  }
  return boundaries;
};

const requireBandValues = (value: unknown, bandCount: number, label: string): void => {
  if (!Array.isArray(value) || value.length !== bandCount) {
    throw new Error(
      `[route canonical build API] ${label} must contain exactly ${String(bandCount)} values`
    );
  }
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0) {
      throw new Error(
        `[route canonical build API] ${label}[${String(index)}] must be a non-negative finite number`
      );
    }
  }
};

const requireRouteGeneration = (value: unknown): void => {
  const config = requireRecord(value, 'payload.buildConfig.routeGeneration');
  requireEnum(
    config.method,
    ROUTE_GENERATION_METHODS,
    'payload.buildConfig.routeGeneration.method'
  );
  requireBoolean(config.parallel, 'payload.buildConfig.routeGeneration.parallel');
  requirePositiveInteger(config.maxConcurrent, 'payload.buildConfig.routeGeneration.maxConcurrent');
  requireBoolean(config.retryOnFailure, 'payload.buildConfig.routeGeneration.retryOnFailure');
  requireNonNegativeInteger(config.maxRetries, 'payload.buildConfig.routeGeneration.maxRetries');
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
