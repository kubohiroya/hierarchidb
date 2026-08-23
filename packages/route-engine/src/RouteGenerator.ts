/**
 * @file RouteGenerator.ts
 * @description Route generation service for different algorithms
 */

import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import {
  createRouteEngineRegistry,
  type RouteEnginesProvider,
  type RouteExternalEngineMethod,
} from './RouteEnginesProvider.js';
import {
  assertRouteEngineCanServeRequest,
  createRouteEngineCapability,
  isRouteGenerationMethod,
  RouteEngineUnavailableError,
  type RouteEngineCapability,
  type RouteEngineRequest,
} from './RouteEngineCapability.js';
import type { RouteGenerationResult } from './RouteGenerationResult.js';
import {
  requireRouteGenerationCoordinate,
  validateRouteGenerationResult,
} from './validateRouteGenerationResult.js';

type BuiltInRouteGenerationMethod = Extract<RouteGenerationConfig['method'], 'direct' | 'great_circle'>;

const BUILT_IN_CAPABILITIES = {
  direct: createRouteEngineCapability({
    engineId: 'route-engine:direct',
    engineVersion: '1',
    method: 'direct',
    networkRequirement: 'none',
    supportsWaypoints: true,
  }),
  great_circle: createRouteEngineCapability({
    engineId: 'route-engine:great-circle',
    engineVersion: '1',
    method: 'great_circle',
    networkRequirement: 'none',
    supportsWaypoints: true,
  }),
} as const satisfies Record<BuiltInRouteGenerationMethod, RouteEngineCapability>;

export class RouteGenerator {
  private readonly externalEngines;

  constructor(engines?: RouteEnginesProvider) {
    this.externalEngines = createRouteEngineRegistry(engines);
  }

  async generate(
    points: [number, number][],
    config: RouteGenerationConfig
  ): Promise<RouteGenerationResult> {
    const request = requireRouteEngineRequest(points, config);

    let result: RouteGenerationResult;
    switch (request.method) {
      case 'direct':
        assertRouteEngineCanServeRequest(BUILT_IN_CAPABILITIES.direct, request);
        result = this.generateDirectRoute(request.points);
        break;
      case 'great_circle':
        assertRouteEngineCanServeRequest(BUILT_IN_CAPABILITIES.great_circle, request);
        result = this.generateGreatCircleRoute(request.points, request.options);
        break;
      case 'osm_route':
      case 'searoute':
      case 'custom':
        result = await this.generateRegisteredRoute(request);
        break;
      default:
        throw new Error(`Unsupported route generation method: ${String(request.method)}`);
    }
    return validateRouteGenerationResult({ result, request });
  }

  private generateDirectRoute(points: readonly [number, number][]): RouteGenerationResult {
    const lineGeometry: [number, number][] = [...points];
    const distance = this.calculateTotalDistance(points);

    return {
      lineGeometry,
      distance,
    };
  }

  private generateGreatCircleRoute(
    points: readonly [number, number][],
    options?: unknown
  ): RouteGenerationResult {
    const numIntermediatePoints = requireGreatCirclePointCount(options);
    const lineGeometry: [number, number][] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) throw new Error(`Route segment ${String(i)} is incomplete`);
      const interpolated = this.interpolateGreatCircle(start, end, numIntermediatePoints);

      if (i === 0) {
        lineGeometry.push(...interpolated);
      } else {
        lineGeometry.push(...interpolated.slice(1));
      }
    }

    const distance = this.calculateGreatCircleDistance(points);

    return {
      lineGeometry,
      distance,
    };
  }

  private async generateRegisteredRoute(request: RouteEngineRequest): Promise<RouteGenerationResult> {
    const method = request.method as RouteExternalEngineMethod;
    const registered = this.externalEngines.get(method);
    if (!registered) {
      throw new RouteEngineUnavailableError(method);
    }
    assertRouteEngineCanServeRequest(registered.capability, request);
    const out = await registered.engine.route([...request.points], request.options);
    return {
      lineGeometry: out.line,
      distance: out.distance_m,
      ...(out.duration_s === undefined ? {} : { duration: out.duration_s }),
    };
  }

  private interpolateGreatCircle(
    start: [number, number],
    end: [number, number],
    numPoints: number
  ): [number, number][] {
    const points: [number, number][] = [];

    const lat1 = this.toRadians(start[1]);
    const lon1 = this.toRadians(start[0]);
    const lat2 = this.toRadians(end[1]);
    const lon2 = this.toRadians(end[0]);

    const d = Math.acos(
      Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    );

    for (let i = 0; i <= numPoints; i++) {
      const f = i / numPoints;
      const a = Math.sin((1 - f) * d) / Math.sin(d);
      const b = Math.sin(f * d) / Math.sin(d);

      const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
      const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
      const z = a * Math.sin(lat1) + b * Math.sin(lat2);

      const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lon = Math.atan2(y, x);

      points.push([this.toDegrees(lon), this.toDegrees(lat)]);
    }

    const lastIndex = points.length - 1;
    if (lastIndex < 0) throw new Error('great_circle interpolation produced no coordinates');
    points[0] = [start[0], start[1]];
    points[lastIndex] = [end[0], end[1]];

    return points;
  }

  private calculateTotalDistance(points: readonly [number, number][]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) throw new Error(`Route segment ${String(i)} is incomplete`);
      totalDistance += this.calculateDistance(start, end);
    }

    return totalDistance;
  }

  private calculateGreatCircleDistance(points: readonly [number, number][]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) throw new Error(`Route segment ${String(i)} is incomplete`);
      totalDistance += this.calculateDistance(start, end);
    }

    return totalDistance;
  }

  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const R = 6371000;

    const lat1 = this.toRadians(point1[1]);
    const lat2 = this.toRadians(point2[1]);
    const deltaLat = this.toRadians(point2[1] - point1[1]);
    const deltaLon = this.toRadians(point2[0] - point1[0]);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

const requireRouteEngineRequest = (
  points: [number, number][],
  config: RouteGenerationConfig
): RouteEngineRequest => {
  if (points.length < 2) {
    throw new Error('At least 2 points required for route generation');
  }
  const coordinates = points.map((point, index) =>
    requireRouteGenerationCoordinate(`Route generation point ${String(index)}`, point)
  );
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Route generation config must be an object');
  }
  if (!isRouteGenerationMethod(config.method)) {
    throw new Error(`Unsupported route generation method: ${String(config.method)}`);
  }
  return {
    method: config.method,
    points: coordinates,
    ...(config.options === undefined ? {} : { options: config.options }),
  };
};

const requireGreatCirclePointCount = (options: unknown): number => {
  if (options === undefined) return 50;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('great_circle options must be an object when provided');
  }
  const numPoints = (options as Record<string, unknown>).numPoints;
  if (numPoints === undefined) return 50;
  if (!Number.isInteger(numPoints) || (numPoints as number) <= 0) {
    throw new Error('great_circle options.numPoints must be a positive integer');
  }
  return numPoints as number;
};
