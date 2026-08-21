import type { NodeId } from '@hierarchidb/core-types';
import { buildStableJsonSignature } from '@hierarchidb/gis-sdk';
import {
  ROUTE_MODES,
  type RouteBuildConfig,
  type RouteGenerationConfig,
  type RouteMode,
} from '@hierarchidb/route-api';

export type RouteSourceEndpoint = {
  locationId: NodeId;
  coordinates: [number, number];
};

export type RouteSourceIdentityInput = {
  routeMode: RouteMode;
  start: RouteSourceEndpoint;
  end: RouteSourceEndpoint;
  generation: RouteGenerationConfig;
  sourceConfig: RouteBuildConfig['sourceConfig'];
  metadata?: Record<string, unknown>;
};

export type RouteSourceIdentity = {
  sourceKey: string;
  inputHash: string;
  bidirectional: boolean;
  from: RouteSourceEndpoint;
  to: RouteSourceEndpoint;
};

const ROUTE_MODE_VALUES = new Set<RouteMode>(Object.values(ROUTE_MODES));
const ROUTE_GENERATION_METHODS = new Set<RouteGenerationConfig['method']>([
  'direct',
  'great_circle',
  'osm_route',
  'searoute',
  'custom',
]);

export const buildRouteSourceIdentity = (
  input: RouteSourceIdentityInput
): RouteSourceIdentity => {
  const routeMode = requireRouteMode(input.routeMode);
  const start = requireEndpoint('start', input.start);
  const end = requireEndpoint('end', input.end);
  const generation = requireGenerationConfig(input.generation);
  const sourceConfig = requireSourceConfig(input.sourceConfig);
  const bidirectional = resolveBidirectional(input.metadata);
  const [from, to] = bidirectional && compareEndpoints(start, end) > 0
    ? [end, start]
    : [start, end];
  const sourceKey = `${routeMode}:${String(from.locationId)}:${String(to.locationId)}`;
  const inputHash = buildStableJsonSignature({
    pipelineVersion: 'route-source-v1',
    routeMode,
    bidirectional,
    from: toSignatureEndpoint(from),
    to: toSignatureEndpoint(to),
    generation: {
      method: generation.method,
      options: generation.options ?? null,
    },
    sourceConfig,
  });

  if (inputHash.length === 0) {
    return contractViolation('inputHash', 'must be a non-empty stable signature');
  }

  return { sourceKey, inputHash, bidirectional, from, to };
};

const requireRouteMode = (value: unknown): RouteMode => {
  if (!ROUTE_MODE_VALUES.has(value as RouteMode)) {
    return contractViolation('routeMode', `is unsupported: ${String(value)}`);
  }
  return value as RouteMode;
};

const requireEndpoint = (label: 'start' | 'end', value: unknown): RouteSourceEndpoint => {
  if (!isRecord(value)) {
    return contractViolation(label, 'must be an endpoint object');
  }
  const locationId = requireLocationId(`${label}.locationId`, value.locationId);
  const coordinates = requireCoordinate(`${label}.coordinates`, value.coordinates);
  return { locationId, coordinates };
};

const requireLocationId = (label: string, value: unknown): NodeId => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return contractViolation(label, 'must be a non-empty string without surrounding whitespace');
  }
  if (value.includes(':')) {
    return contractViolation(label, 'must not contain the source-key delimiter');
  }
  return value as NodeId;
};

const requireCoordinate = (label: string, value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    return contractViolation(label, 'must be a longitude/latitude pair');
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number'
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || typeof latitude !== 'number'
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
  ) {
    return contractViolation(label, 'contains invalid coordinates');
  }
  return [longitude, latitude];
};

const requireGenerationConfig = (value: unknown): RouteGenerationConfig => {
  if (!isRecord(value)) {
    return contractViolation('generation', 'must be an object');
  }
  if (!ROUTE_GENERATION_METHODS.has(value.method as RouteGenerationConfig['method'])) {
    return contractViolation('generation.method', `is unsupported: ${String(value.method)}`);
  }
  if (value.options !== undefined && !isRecord(value.options)) {
    return contractViolation('generation.options', 'must be an object when provided');
  }
  return {
    method: value.method as RouteGenerationConfig['method'],
    ...(value.options === undefined ? {} : { options: value.options }),
  };
};

const requireSourceConfig = (value: unknown): RouteBuildConfig['sourceConfig'] => {
  if (!isRecord(value)) {
    return contractViolation('sourceConfig', 'must be an object');
  }
  return value as unknown as RouteBuildConfig['sourceConfig'];
};

const resolveBidirectional = (metadata: unknown): boolean => {
  if (metadata === undefined) return false;
  if (!isRecord(metadata)) {
    return contractViolation('metadata', 'must be an object when provided');
  }
  const bidirectional = readOptionalBoolean(metadata, 'bidirectional');
  const oneway = readOptionalBoolean(metadata, 'oneway');
  if (bidirectional !== undefined && oneway !== undefined && bidirectional === oneway) {
    return contractViolation(
      'metadata directionality',
      'must not contain conflicting bidirectional and oneway values'
    );
  }
  return bidirectional === true || oneway === false;
};

const readOptionalBoolean = (
  metadata: Record<string, unknown>,
  key: 'bidirectional' | 'oneway'
): boolean | undefined => {
  if (!Object.hasOwn(metadata, key)) return undefined;
  const value = metadata[key];
  if (typeof value !== 'boolean') {
    return contractViolation(`metadata.${key}`, 'must be boolean when provided');
  }
  return value;
};

const compareEndpoints = (left: RouteSourceEndpoint, right: RouteSourceEndpoint): number => {
  const longitudeDelta = left.coordinates[0] - right.coordinates[0];
  if (longitudeDelta !== 0) return longitudeDelta;
  const latitudeDelta = left.coordinates[1] - right.coordinates[1];
  if (latitudeDelta !== 0) return latitudeDelta;
  return String(left.locationId).localeCompare(String(right.locationId));
};

const toSignatureEndpoint = (endpoint: RouteSourceEndpoint) => ({
  locationId: String(endpoint.locationId),
  longitude: endpoint.coordinates[0],
  latitude: endpoint.coordinates[1],
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const contractViolation = (field: string, expectation: string): never => {
  throw new Error(`[route-source-identity] ${field} ${expectation}`);
};
