import { describe, expect, it } from 'vitest';
import { OsrmEngine } from '../../../services/engines/OsrmEngine.js';
import type { NetworkPortLike } from '../../../services/engines/types.js';

class FakeNetworkPort implements NetworkPortLike {
  readonly urls: string[] = [];

  async get(url: string) {
    this.urls.push(url);
    const body = JSON.stringify({
      routes: [
        {
          distance: 12,
          duration: 3,
          geometry: {
            coordinates: [
              [139.7, 35.6],
              [135.5, 34.7],
            ],
          },
        },
      ],
    });
    return {
      ok: true,
      status: 200,
      async arrayBuffer() {
        return new TextEncoder().encode(body).buffer;
      },
    };
  }
}

describe('OsrmEngine', () => {
  it('requires explicit OSRM route options instead of filling defaults', async () => {
    const engine = new OsrmEngine(new FakeNetworkPort());

    await expect(
      engine.route([
        [139.7, 35.6],
        [135.5, 34.7],
      ])
    ).rejects.toThrow('OSRM options must be an object');
    await expect(
      engine.route(
        [
          [139.7, 35.6],
          [135.5, 34.7],
        ],
        {
          baseUrl: 'https://osrm.example',
          geometries: 'geojson',
          overview: 'full',
        }
      )
    ).rejects.toThrow('OSRM profile must be one of');
  });

  it('uses the explicit profile, geometry, and overview options', async () => {
    const port = new FakeNetworkPort();
    const engine = new OsrmEngine(port);

    const result = await engine.route(
      [
        [139.7, 35.6],
        [135.5, 34.7],
      ],
      {
        baseUrl: 'https://osrm.example/',
        profile: 'car',
        geometries: 'geojson',
        overview: 'full',
      }
    );

    expect(result.distance_m).toBe(12);
    expect(port.urls[0]).toBe(
      'https://osrm.example/route/v1/car/139.7,35.6;135.5,34.7?geometries=geojson&overview=full'
    );
  });
});
