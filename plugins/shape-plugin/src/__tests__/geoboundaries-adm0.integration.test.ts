/* @vitest-environment node */

/**
 * GeoBoundaries ADM0 feature split inspection (network integration).
 */

import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Geometry } from 'geojson';
import { GeoBoundariesStrategy } from '../services/datasources/GeoBoundariesStrategy.js';

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const summarizeFeatureCollection = (collection: FeatureCollection) => {
  let vertexCount = 0;
  let polygonCount = 0;
  let maxVerticesPerFeature = 0;
  let maxPolygonsPerFeature = 0;
  let multiPolygonFeatures = 0;
  const geometryTypes = new Map<string, number>();
  for (const feature of collection.features) {
    const geometry = feature?.geometry ?? null;
    if (!geometry) continue;
    const vertices = countVerticesFromGeometry(geometry);
    const polygons = countPolygonsFromGeometry(geometry);
    vertexCount += vertices;
    polygonCount += polygons;
    maxVerticesPerFeature = Math.max(maxVerticesPerFeature, vertices);
    maxPolygonsPerFeature = Math.max(maxPolygonsPerFeature, polygons);
    if (geometry.type === 'MultiPolygon') {
      multiPolygonFeatures += 1;
    }
    geometryTypes.set(geometry.type, (geometryTypes.get(geometry.type) ?? 0) + 1);
  }
  return {
    featureCount: collection.features.length,
    vertexCount,
    polygonCount,
    maxVerticesPerFeature,
    maxPolygonsPerFeature,
    multiPolygonFeatures,
    geometryTypes: Object.fromEntries(geometryTypes),
  };
};

const runNetworkTests = process.env.HDB_NETWORK_TESTS === '1';
const describeNetwork = runNetworkTests ? describe : describe.skip;

describeNetwork('GeoBoundaries ADM0 integration', () => {
  it('reports feature splits for selected countries', async () => {
    const strategy = new GeoBoundariesStrategy();
    const targets = [
      { country: 'CAN', adminLevel: 0 },
      { country: 'GRL', adminLevel: 0 },
      { country: 'USA', adminLevel: 0 },
    ];

    for (const target of targets) {
      const rawData = await strategy.fetchData({
        nodeId: 'test-node',
        country: target.country,
        adminLevel: target.adminLevel,
        cacheKeyMode: 'url',
      });
      const collection = rawData.geojson;
      expect(collection).toBeDefined();
      if (!collection) continue;
      const stats = summarizeFeatureCollection(collection);
      process.stdout.write(`[GeoBoundaries ADM0] ${target.country} ${JSON.stringify(stats)}\n`);

      expect(stats.featureCount).toBeGreaterThan(0);
    }
  }, 60000);
});
