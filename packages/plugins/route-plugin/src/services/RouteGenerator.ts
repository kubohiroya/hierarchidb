/**
 * @file RouteGenerator.ts
 * @description Route generation service for different algorithms
 */

import type { RouteGenerationConfig } from '../entities/RouteEntity.js';

/**
 * Route generation result
 */
export interface RouteGenerationResult {
  lineGeometry: [number, number][];
  distance?: number;  // meters
  duration?: number;  // seconds
}

/**
 * Route generator service
 */
export interface RouteEnginesProvider {
  osrm?: {
    route: (points: [number, number][], options?: any) => Promise<{
      line: [number, number][],
      distance_m: number,
      duration_s?: number
    }>
  };
  searoute?: {
    route: (points: [number, number][], options?: any) => Promise<{
      line: [number, number][],
      distance_m: number,
      duration_s?: number
    }>
  };
}

export class RouteGenerator {
  constructor(private engines?: RouteEnginesProvider) {
  }

  /**
   * Generate route based on configuration
   */
  async generate(
    points: [number, number][],
    config: RouteGenerationConfig,
  ): Promise<RouteGenerationResult> {
    if (points.length < 2) {
      throw new Error('At least 2 points required for route generation');
    }

    switch (config.method) {
      case 'direct':
        return this.generateDirectRoute(points);

      case 'great_circle':
        return this.generateGreatCircleRoute(points, config.options);

      case 'osm_route':
        return this.generateOSMRoute(points, config.options);

      case 'searoute':
        return this.generateSeaRoute(points, config.options);

      case 'custom':
        return this.generateCustomRoute(points, config.options);

      default:
        return this.generateDirectRoute(points);
    }
  }

  /**
   * Generate direct (straight line) route
   */
  private generateDirectRoute(points: [number, number][]): RouteGenerationResult {
    const lineGeometry: [number, number][] = [...points];
    const distance = this.calculateTotalDistance(points);

    return {
      lineGeometry,
      distance,
    };
  }

  /**
   * Generate great circle route (for aviation)
   */
  private generateGreatCircleRoute(
    points: [number, number][],
    options?: any,
  ): RouteGenerationResult {
    const numIntermediatePoints = options?.numPoints || 50;
    const lineGeometry: [number, number][] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]!;
      const end = points[i + 1]!;
      const interpolated = this.interpolateGreatCircle(
        start,
        end,
        numIntermediatePoints,
      );

      if (i === 0) {
        lineGeometry.push(...interpolated);
      } else {
        // Skip first point to avoid duplication
        lineGeometry.push(...interpolated.slice(1));
      }
    }

    const distance = this.calculateGreatCircleDistance(points);

    return {
      lineGeometry,
      distance,
    };
  }

  /**
   * Generate OSM-based route (requires external service)
   */
  private async generateOSMRoute(
    points: [number, number][],
    _options?: any,
  ): Promise<RouteGenerationResult> {
    if (!this.engines?.osrm) {
      console.warn('OSRM engine not provided, using direct route');
      return this.generateDirectRoute(points);
    }
    const out = await this.engines.osrm.route(points, _options);
    return { lineGeometry: out.line, distance: out.distance_m, duration: out.duration_s };
  }

  /**
   * Generate sea route (requires external service)
   */
  private async generateSeaRoute(
    points: [number, number][],
    options?: any,
  ): Promise<RouteGenerationResult> {
    if (!this.engines?.searoute) {
      console.warn('SeaRoute engine not provided, using great circle');
      return this.generateGreatCircleRoute(points, options);
    }
    const out = await this.engines.searoute.route(points, options);
    return { lineGeometry: out.line, distance: out.distance_m, duration: out.duration_s };
  }

  /**
   * Generate custom route
   */
  private generateCustomRoute(
    points: [number, number][],
    _options?: any,
  ): RouteGenerationResult {
    // Custom algorithm implementation
    // For now, return direct route
    return this.generateDirectRoute(points);
  }

  /**
   * Interpolate points along great circle
   */
  private interpolateGreatCircle(
    start: [number, number],
    end: [number, number],
    numPoints: number,
  ): [number, number][] {
    const points: [number, number][] = [];

    const lat1 = this.toRadians(start[1]);
    const lon1 = this.toRadians(start[0]);
    const lat2 = this.toRadians(end[1]);
    const lon2 = this.toRadians(end[0]);

    const d = Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1),
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

      points.push([
        this.toDegrees(lon),
        this.toDegrees(lat),
      ]);
    }

    return points;
  }

  /**
   * Calculate total distance along points
   */
  private calculateTotalDistance(points: [number, number][]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.calculateDistance(points[i]!, points[i + 1]!);
    }

    return totalDistance;
  }

  /**
   * Calculate great circle distance
   */
  private calculateGreatCircleDistance(points: [number, number][]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.calculateDistance(points[i]!, points[i + 1]!);
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    point1: [number, number],
    point2: [number, number],
  ): number {
    const R = 6371000; // Earth radius in meters

    const lat1 = this.toRadians(point1[1]);
    const lat2 = this.toRadians(point2[1]);
    const deltaLat = this.toRadians(point2[1]! - point1[1]!);
    const deltaLon = this.toRadians(point2[0]! - point1[0]!);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}
