/**
 * @file RouteGenerator.ts
 * @description Route generation service for different algorithms
 */

import type { RouteGenerationConfig } from '@hierarchidb/route-store';
import type { RouteEnginesProvider } from './RouteEnginesProvider.js';
import type { RouteGenerationResult } from './RouteGenerationResult.js';

export class RouteGenerator {
  constructor(private engines?: RouteEnginesProvider) {}

  async generate(
    points: [number, number][],
    config: RouteGenerationConfig
  ): Promise<RouteGenerationResult> {
    if (points.length < 2) {
      throw new Error('At least 2 points required for route generation');
    }
    points.forEach((point, index) => {
      requireCoordinate(point, index);
    });

    let result: RouteGenerationResult;
    switch (config.method) {
      case 'direct':
        result = this.generateDirectRoute(points);
        break;
      case 'great_circle':
        result = this.generateGreatCircleRoute(points, config.options);
        break;
      case 'osm_route':
        result = await this.generateOSMRoute(points, config.options);
        break;
      case 'searoute':
        result = await this.generateSeaRoute(points, config.options);
        break;
      case 'custom':
        result = await this.generateCustomRoute(points, config.options);
        break;
      default:
        throw new Error(`Unsupported route generation method: ${String(config.method)}`);
    }
    return requireGenerationResult(result);
  }

  private generateDirectRoute(points: [number, number][]): RouteGenerationResult {
    const lineGeometry: [number, number][] = [...points];
    const distance = this.calculateTotalDistance(points);

    return {
      lineGeometry,
      distance,
    };
  }

  private generateGreatCircleRoute(
    points: [number, number][],
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

  private async generateOSMRoute(
    points: [number, number][],
    options?: unknown
  ): Promise<RouteGenerationResult> {
    if (!this.engines?.osrm) {
      throw new Error('OSRM engine is required for osm_route generation');
    }
    const out = await this.engines.osrm.route(points, options);
    return { lineGeometry: out.line, distance: out.distance_m, duration: out.duration_s };
  }

  private async generateSeaRoute(
    points: [number, number][],
    options?: unknown
  ): Promise<RouteGenerationResult> {
    if (!this.engines?.searoute) {
      throw new Error('Searoute engine is required for searoute generation');
    }
    const out = await this.engines.searoute.route(points, options);
    return { lineGeometry: out.line, distance: out.distance_m, duration: out.duration_s };
  }

  private async generateCustomRoute(
    points: [number, number][],
    options?: unknown
  ): Promise<RouteGenerationResult> {
    if (!this.engines?.custom) {
      throw new Error('Custom route engine is required for custom generation');
    }
    const out = await this.engines.custom.route(points, options);
    return { lineGeometry: out.line, distance: out.distance_m, duration: out.duration_s };
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

    return points;
  }

  private calculateTotalDistance(points: [number, number][]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (!start || !end) throw new Error(`Route segment ${String(i)} is incomplete`);
      totalDistance += this.calculateDistance(start, end);
    }

    return totalDistance;
  }

  private calculateGreatCircleDistance(points: [number, number][]): number {
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

const requireCoordinate = (point: unknown, index: number): [number, number] => {
  if (!Array.isArray(point) || point.length !== 2) {
    throw new Error(`Route generation point ${String(index)} must be a longitude/latitude pair`);
  }
  const [longitude, latitude] = point;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(`Route generation point ${String(index)} contains invalid coordinates`);
  }
  return [longitude, latitude];
};

const requireGenerationResult = (value: unknown): RouteGenerationResult => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Route engine result must be an object');
  }
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.lineGeometry) || candidate.lineGeometry.length < 2) {
    throw new Error('Route engine result lineGeometry must contain at least two coordinates');
  }
  const lineGeometry = candidate.lineGeometry.map((coordinate, index) =>
    requireCoordinate(coordinate, index));
  const distance = requireFiniteNonNegative('distance', candidate.distance);
  const duration = candidate.duration === undefined
    ? undefined
    : requireFiniteNonNegative('duration', candidate.duration);
  return {
    lineGeometry,
    distance,
    ...(duration === undefined ? {} : { duration }),
  };
};

const requireFiniteNonNegative = (label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Route engine result ${label} must be a finite non-negative number`);
  }
  return value;
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
