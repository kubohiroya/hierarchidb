import {
  type RouteEnginesProvider,
  RouteGenerator,
  SearouteEngine,
} from '@hierarchidb/route-engine';
import { describe, expect, it } from 'vitest';

describe('RouteGenerator engine delegation', () => {
  it('delegates osm_route to provided engine and maps distance/duration', async () => {
    const points: [number, number][] = [
      [139.7, 35.6],
      [135.5, 34.7],
    ];
    const fakeEngine: NonNullable<RouteEnginesProvider['osrm']> = {
      async route() {
        return {
          line: [
            [139.7, 35.6],
            [137.0, 35.2],
            [135.5, 34.7],
          ],
          distance_m: 480000,
          duration_s: 18000,
        };
      },
    };
    const gen = new RouteGenerator({ osrm: fakeEngine });
    const res = await gen.generate(points, { method: 'osm_route', options: { osmProfile: 'car' } });
    expect(res.distance).toBe(480000);
    expect(res.duration).toBe(18000);
    expect(res.lineGeometry.length).toBeGreaterThan(2);
  });

  it('fails when the selected external engine is missing', async () => {
    const gen = new RouteGenerator();

    await expect(
      gen.generate(
        [
          [139.7, 35.6],
          [135.5, 34.7],
        ],
        { method: 'osm_route' }
      )
    ).rejects.toThrow('OSRM engine is required');
    await expect(
      gen.generate(
        [
          [139.7, 35.6],
          [135.5, 34.7],
        ],
        { method: 'searoute' }
      )
    ).rejects.toThrow('Searoute engine is required');
    await expect(
      gen.generate(
        [
          [139.7, 35.6],
          [135.5, 34.7],
        ],
        { method: 'custom' }
      )
    ).rejects.toThrow('Custom route engine is required');
  });

  it('rejects an invalid selected-engine response', async () => {
    const engine: NonNullable<RouteEnginesProvider['custom']> = {
      async route() {
        return {
          line: [[139.7, 35.6]],
          distance_m: Number.NaN,
        };
      },
    };
    const gen = new RouteGenerator({ custom: engine });

    await expect(
      gen.generate(
        [
          [139.7, 35.6],
          [135.5, 34.7],
        ],
        { method: 'custom' }
      )
    ).rejects.toThrow('lineGeometry must contain at least two coordinates');
  });

  it('rejects more than one searoute endpoint pair', async () => {
    const engine = new SearouteEngine();

    await expect(
      engine.route([
        [139.7, 35.6],
        [137, 35.2],
        [135.5, 34.7],
      ])
    ).rejects.toThrow('searoute requires exactly two coordinates');
  });
});
