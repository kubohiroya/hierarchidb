import type { RouteGenerationMethod } from '@hierarchidb/route-store';
import {
  RouteEngineCapabilityError,
  requireRouteEngineCapability,
  type RouteEngineCapability,
} from './RouteEngineCapability.js';
import type { RoutingEngine } from './RoutingEngine.js';

export type RouteExternalEngineMethod = Extract<
  RouteGenerationMethod,
  'osm_route' | 'searoute' | 'custom'
>;

export type RouteEngineProviderKey = 'osrm' | 'searoute' | 'custom';

export type RouteEnginesProvider = Partial<Record<RouteEngineProviderKey, RoutingEngine>>;

export type RegisteredRouteEngine = {
  method: RouteExternalEngineMethod;
  engine: RoutingEngine;
  capability: RouteEngineCapability;
};

const PROVIDER_METHOD_BY_KEY = {
  osrm: 'osm_route',
  searoute: 'searoute',
  custom: 'custom',
} as const satisfies Record<RouteEngineProviderKey, RouteExternalEngineMethod>;

export const createRouteEngineRegistry = (
  provider?: RouteEnginesProvider
): ReadonlyMap<RouteExternalEngineMethod, RegisteredRouteEngine> => {
  const registry = new Map<RouteExternalEngineMethod, RegisteredRouteEngine>();
  if (!provider) return registry;

  for (const key of Object.keys(PROVIDER_METHOD_BY_KEY) as RouteEngineProviderKey[]) {
    const engine = provider[key];
    if (engine === undefined) continue;
    const method = PROVIDER_METHOD_BY_KEY[key];
    if (registry.has(method)) {
      throw new Error(`Route engine method ${method} is registered more than once`);
    }
    const capability = resolveCapability(key, engine);
    registry.set(method, { method, engine, capability });
  }

  return registry;
};

const resolveCapability = (
  key: RouteEngineProviderKey,
  engine: RoutingEngine
): RouteEngineCapability => {
  const method = PROVIDER_METHOD_BY_KEY[key];
  const declared = engine.getCapability?.() ?? engine.capability;
  if (declared !== undefined) {
    return requireRouteEngineCapability(declared, method);
  }
  throw new RouteEngineCapabilityError(
    `Route engine provider ${key} must declare a capability`
  );
};
