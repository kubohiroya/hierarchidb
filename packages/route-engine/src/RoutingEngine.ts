import type { RouteEngineCapability } from './RouteEngineCapability.js';

export interface RoutingEngine {
  readonly capability?: RouteEngineCapability;
  getCapability?(): RouteEngineCapability;
  route(
    points: [number, number][],
    options?: unknown
  ): Promise<{
    line: [number, number][];
    distance_m: number;
    duration_s?: number;
  }>;
}
