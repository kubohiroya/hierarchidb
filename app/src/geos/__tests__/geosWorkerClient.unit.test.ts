import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feature, LineString, Polygon } from 'geojson';
import { geometryArea, geometrySimplify } from '@hierarchidb/gis-sdk';

let geosWorkerClient: typeof import('../geosWorkerClient.ts').geosWorkerClient;
let setGeosWorkerEndpointFactoryForTests: typeof import('../geosWorkerClient.ts').setGeosWorkerEndpointFactoryForTests;
let exposeGeosWorker: typeof import('../geosWorker.entry.ts').exposeGeosWorker;

describe('geosWorkerClient (Comlink worker)', () => {
  const originalWorker = globalThis.Worker;
  let channel: MessageChannel | null = null;

  beforeAll(async () => {
    vi.unmock('comlink');
    vi.resetModules();
    const clientModule = await import('../geosWorkerClient.ts');
    geosWorkerClient = clientModule.geosWorkerClient;
    setGeosWorkerEndpointFactoryForTests = clientModule.setGeosWorkerEndpointFactoryForTests;
    const workerModule = await import('../geosWorker.entry.ts');
    exposeGeosWorker = workerModule.exposeGeosWorker;
  });

  beforeEach(() => {
    vi.useRealTimers();
    globalThis.Worker = class {} as unknown as typeof Worker;
    channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    exposeGeosWorker(channel.port2);
    setGeosWorkerEndpointFactoryForTests(() => {
      if (!channel) {
        throw new Error('MessageChannel is not initialized.');
      }
      return {
        endpoint: channel.port1,
        terminate: () => {
          channel?.port1.close();
          channel?.port2.close();
        },
      };
    });
  });

  afterEach(() => {
    geosWorkerClient.shutdown();
    setGeosWorkerEndpointFactoryForTests(null);
    channel = null;
    globalThis.Worker = originalWorker;
  });

  it('simplify reduces vertex count for a noisy line', async () => {
    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: Array.from({ length: 1000 }, (_, index) => {
          const x = index;
          const y = Math.sin(index * 0.1) * 0.5;
          return [x, y];
        }),
      },
    };

    const simplified = await geosWorkerClient.simplify(line, 0.5, { preserveTopology: true });
    const geometry = 'geometry' in simplified ? simplified.geometry : simplified;
    if (!geometry || geometry.type !== 'LineString') {
      throw new Error('Expected a LineString result');
    }
    const simplifiedLine = geometry as LineString;
    const lineGeometry = line.geometry;
    if (!lineGeometry) {
      throw new Error('Expected line geometry to be defined');
    }
    expect(simplifiedLine.coordinates.length).toBeLessThan(lineGeometry.coordinates.length);
  });

  it('area returns expected value for a square', async () => {
    const square: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ]],
      },
    };
    const area = await geosWorkerClient.area(square);
    expect(area).toBeCloseTo(100, 6);
  });

  it('bbox returns expected bounds', async () => {
    const polygon: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-5, -2],
          [10, -2],
          [10, 8],
          [-5, 8],
          [-5, -2],
        ]],
      },
    };
    const bbox = await geosWorkerClient.bbox(polygon);
    expect(bbox).toEqual([-5, -2, 10, 8]);
  });

  it('makeValid fixes a self-intersecting polygon', async () => {
    const bowtie: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [2, 2],
          [0, 2],
          [2, 0],
          [0, 0],
        ]],
      },
    };
    const validBefore = await geosWorkerClient.isValid(bowtie);
    expect(validBefore).toBe(false);
    const fixed = await geosWorkerClient.makeValid(bowtie);
    const validAfter = await geosWorkerClient.isValid(fixed);
    expect(validAfter).toBe(true);
  });

  it('logs turf vs geos-wasm timings', async () => {
    const square: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ]],
      },
    };
    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0.2],
          [2, -0.1],
          [3, 0.15],
          [4, -0.2],
          [5, 0],
        ],
      },
    };

    const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const measureSync = (label: string, fn: () => void): number => {
      const start = now();
      fn();
      const end = now();
      const elapsed = end - start;
      console.log(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
      return elapsed;
    };

    const measureAsync = async (label: string, fn: () => Promise<void>): Promise<number> => {
      const start = now();
      await fn();
      const end = now();
      const elapsed = end - start;
      console.log(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
      return elapsed;
    };

    const turfOnce = measureSync('turf init+1 area (no init)', () => {
      geometryArea(square, 'turf');
    });

    const turfHundred = measureSync('turf area x100', () => {
      for (let i = 0; i < 100; i += 1) {
        geometryArea(square, 'turf');
      }
    });

    geosWorkerClient.shutdown();
    const geosOnce = await measureAsync('geos-wasm(worker) init+1 area', async () => {
      await geosWorkerClient.area(square);
    });

    const geosHundred = await measureAsync('geos-wasm(worker) area x100', async () => {
      for (let i = 0; i < 100; i += 1) {
        await geosWorkerClient.area(square);
      }
    });

    const turfSimplifyOnce = measureSync('turf init+1 simplify (no init)', () => {
      geometrySimplify(line, 'turf', { tolerance: 0.5, preserveTopology: true });
    });

    const turfSimplifyHundred = measureSync('turf simplify x50', () => {
      for (let i = 0; i < 50; i += 1) {
        geometrySimplify(line, 'turf', { tolerance: 0.5, preserveTopology: true });
      }
    });

    geosWorkerClient.shutdown();
    const geosSimplifyOnce = await measureAsync('geos-wasm(worker) init+1 simplify', async () => {
      await geosWorkerClient.simplify(line, 0.5, { preserveTopology: true });
    });

    const geosSimplifyHundred = await measureAsync('geos-wasm(worker) simplify x50', async () => {
      await geosWorkerClient.simplifyRepeated(line, 0.5, 50, { preserveTopology: true });
    });

    expect(turfOnce).toBeGreaterThanOrEqual(0);
    expect(turfHundred).toBeGreaterThanOrEqual(0);
    expect(geosOnce).toBeGreaterThanOrEqual(0);
    expect(geosHundred).toBeGreaterThanOrEqual(0);
    expect(turfSimplifyOnce).toBeGreaterThanOrEqual(0);
    expect(turfSimplifyHundred).toBeGreaterThanOrEqual(0);
    expect(geosSimplifyOnce).toBeGreaterThanOrEqual(0);
    expect(geosSimplifyHundred).toBeGreaterThanOrEqual(0);
  }, 600000);
});
