import { describe, expect, it } from 'vitest';
import { RouteGenerator } from '../../src/services/RouteGenerator.js';

describe('RouteGenerator engine delegation', () => {
  it('delegates osm_route to provided engine and maps distance/duration', async () => {
    const points: [number, number][] = [[139.7, 35.6], [135.5, 34.7]];
    const fakeEngine = {
      route: async (_pts: any, _opts: any) => ({
        line: [[139.7, 35.6], [137.0, 35.2], [135.5, 34.7]],
        distance_m: 480000,
        duration_s: 18000,
      }),
    };
    const gen = new RouteGenerator({ osrm: fakeEngine as any });
    const res = await gen.generate(points, { method: 'osm_route', options: { osmProfile: 'car' } });
    expect(res.distance).toBe(480000);
    expect(res.duration).toBe(18000);
    expect(res.lineGeometry.length).toBeGreaterThan(2);
  });
});

