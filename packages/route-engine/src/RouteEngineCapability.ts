import type { RouteGenerationMethod, RouteMode } from '@hierarchidb/route-store';

export type RouteEngineNetworkRequirement = 'none' | 'optional' | 'required';

export type RouteEngineCapability = {
  engineId: string;
  engineVersion: string;
  method: RouteGenerationMethod;
  acceptedRouteModes?: readonly RouteMode[];
  networkRequirement: RouteEngineNetworkRequirement;
  supportsWaypoints: boolean;
};

export type RouteEngineRequest = {
  method: RouteGenerationMethod;
  points: readonly [number, number][];
  options?: unknown;
  routeMode?: RouteMode;
};

export class RouteEngineUnavailableError extends Error {
  constructor(method: RouteGenerationMethod, message?: string) {
    super(message ?? `Route engine for method ${method} is unavailable`);
    this.name = 'RouteEngineUnavailableError';
  }
}

export class RouteEngineCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteEngineCapabilityError';
  }
}

export class RouteEngineInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteEngineInvalidResponseError';
  }
}

const ROUTE_GENERATION_METHODS: readonly RouteGenerationMethod[] = [
  'direct',
  'great_circle',
  'osm_route',
  'searoute',
  'custom',
];

export const isRouteGenerationMethod = (value: unknown): value is RouteGenerationMethod =>
  typeof value === 'string' && ROUTE_GENERATION_METHODS.includes(value as RouteGenerationMethod);

export const requireRouteEngineCapability = (
  value: unknown,
  expectedMethod?: RouteGenerationMethod
): RouteEngineCapability => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RouteEngineCapabilityError('Route engine capability must be an object');
  }
  const candidate = value as Record<string, unknown>;
  const engineId = requireNonEmptyString('engineId', candidate.engineId);
  const engineVersion = requireNonEmptyString('engineVersion', candidate.engineVersion);
  if (!isRouteGenerationMethod(candidate.method)) {
    throw new RouteEngineCapabilityError(
      `Route engine capability method is unsupported: ${String(candidate.method)}`
    );
  }
  const method = candidate.method;
  if (expectedMethod !== undefined && method !== expectedMethod) {
    throw new RouteEngineCapabilityError(
      `Route engine capability method mismatch. expected=${expectedMethod}, actual=${method}`
    );
  }
  const acceptedRouteModes =
    candidate.acceptedRouteModes === undefined
      ? undefined
      : requireAcceptedRouteModes(candidate.acceptedRouteModes);
  const networkRequirement = requireNetworkRequirement(candidate.networkRequirement);
  if (typeof candidate.supportsWaypoints !== 'boolean') {
    throw new RouteEngineCapabilityError(
      'Route engine capability supportsWaypoints must be boolean'
    );
  }

  return {
    engineId,
    engineVersion,
    method,
    ...(acceptedRouteModes === undefined ? {} : { acceptedRouteModes }),
    networkRequirement,
    supportsWaypoints: candidate.supportsWaypoints,
  };
};

export const assertRouteEngineCanServeRequest = (
  capability: RouteEngineCapability,
  request: RouteEngineRequest
): void => {
  if (capability.method !== request.method) {
    throw new RouteEngineCapabilityError(
      `Route engine ${capability.engineId} cannot serve method ${request.method}`
    );
  }
  if (
    request.routeMode !== undefined &&
    capability.acceptedRouteModes !== undefined &&
    !capability.acceptedRouteModes.includes(request.routeMode)
  ) {
    throw new RouteEngineCapabilityError(
      `Route engine ${capability.engineId} does not support routeMode ${request.routeMode}`
    );
  }
  if (!capability.supportsWaypoints && request.points.length !== 2) {
    throw new RouteEngineCapabilityError(
      `Route engine ${capability.engineId} requires exactly two endpoint coordinates`
    );
  }
};

export const createRouteEngineCapability = (
  capability: RouteEngineCapability
): RouteEngineCapability => requireRouteEngineCapability(capability, capability.method);

const requireNonEmptyString = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new RouteEngineCapabilityError(
      `Route engine capability ${field} must be a non-empty string without surrounding whitespace`
    );
  }
  return value;
};

const requireNetworkRequirement = (value: unknown): RouteEngineNetworkRequirement => {
  if (value === 'none' || value === 'optional' || value === 'required') return value;
  throw new RouteEngineCapabilityError(
    `Route engine capability networkRequirement is unsupported: ${String(value)}`
  );
};

const requireAcceptedRouteModes = (value: unknown): readonly RouteMode[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RouteEngineCapabilityError(
      'Route engine capability acceptedRouteModes must be a non-empty array when provided'
    );
  }
  const modes = value.map((routeMode, index) => {
    if (typeof routeMode !== 'string' || routeMode.length === 0 || routeMode !== routeMode.trim()) {
      throw new RouteEngineCapabilityError(
        `Route engine capability acceptedRouteModes[${String(index)}] must be a non-empty string`
      );
    }
    return routeMode as RouteMode;
  });
  return Object.freeze([...new Set(modes)]);
};
