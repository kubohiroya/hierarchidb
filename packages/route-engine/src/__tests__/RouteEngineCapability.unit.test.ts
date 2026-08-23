import { describe, expect, it } from 'vitest';
import {
  createRouteEngineRegistry,
  RouteEngineCapabilityError,
  type RouteEnginesProvider,
  RouteGenerator,
  type RoutingEngine,
} from '../index.js';

const points: [number, number][] = [
  [139.7, 35.6],
  [135.5, 34.7],
];

describe('route engine capability registry', () => {
  it('rejects a registered engine without an explicit capability', () => {
    const engine: RoutingEngine = {
      async route() {
        return { line: points, distance_m: 1 };
      },
    };

    expect(() => createRouteEngineRegistry({ osrm: engine })).toThrow(RouteEngineCapabilityError);
  });

  it('rejects a provider key whose capability declares another method', () => {
    const engine: RoutingEngine = {
      capability: {
        engineId: 'wrong',
        engineVersion: '1',
        method: 'searoute',
        networkRequirement: 'required',
        supportsWaypoints: false,
      },
      async route() {
        return { line: points, distance_m: 1 };
      },
    };

    expect(() => createRouteEngineRegistry({ osrm: engine })).toThrow(
      'Route engine capability method mismatch'
    );
  });

  it('fails fast when a selected external method has no registered engine', async () => {
    const generator = new RouteGenerator();

    await expect(generator.generate(points, { method: 'osm_route' })).rejects.toThrow(
      'Route engine for method osm_route is unavailable'
    );
  });

  it('generates great-circle geometry that preserves exact request endpoints', async () => {
    const generator = new RouteGenerator();

    const result = await generator.generate(points, { method: 'great_circle' });

    expect(result.lineGeometry[0]).toEqual(points[0]);
    expect(result.lineGeometry[result.lineGeometry.length - 1]).toEqual(points[1]);
    expect(result.lineGeometry.length).toBeGreaterThan(2);
    expect(result.distance).toBeGreaterThan(0);
  });

  it('dispatches to a registered engine only after capability validation', async () => {
    const engine: NonNullable<RouteEnginesProvider['osrm']> = {
      capability: {
        engineId: 'osrm-fixture',
        engineVersion: '1',
        method: 'osm_route',
        acceptedRouteModes: ['road'],
        networkRequirement: 'required',
        supportsWaypoints: true,
      },
      async route(receivedPoints) {
        const start = receivedPoints[0];
        const end = receivedPoints[1];
        if (!start || !end) throw new Error('fixture points are required');
        return {
          line: [start, [137, 35.2], end],
          distance_m: 480000,
          duration_s: 18000,
        };
      },
    };
    const generator = new RouteGenerator({ osrm: engine });

    const result = await generator.generate(points, {
      method: 'osm_route',
      options: { profile: 'car' },
    });

    expect(result.lineGeometry).toHaveLength(3);
    expect(result.distance).toBe(480000);
    expect(result.duration).toBe(18000);
  });

  it('rejects route modes outside the selected engine capability', async () => {
    const engine: NonNullable<RouteEnginesProvider['osrm']> = {
      capability: {
        engineId: 'osrm-fixture',
        engineVersion: '1',
        method: 'osm_route',
        acceptedRouteModes: ['road'],
        networkRequirement: 'required',
        supportsWaypoints: true,
      },
      async route() {
        return {
          line: points,
          distance_m: 1,
        };
      },
    };
    const generator = new RouteGenerator({ osrm: engine });

    await expect(
      generator.generate(points, { method: 'osm_route', routeMode: 'waterway' })
    ).rejects.toThrow('does not support routeMode waterway');
  });
});
