// @vitest-environment node

import type { NodeId } from '@hierarchidb/core-types';
import { EphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { collectLineStringTileIds } from '@hierarchidb/vt-orchestrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';
import { persistRouteGeometryArtifacts } from './persistRouteGeometryArtifacts.js';
import { persistRouteSourceArtifact } from './persistRouteSourceArtifact.js';
import { buildRouteSourceIdentity } from './routeSourceIdentity.js';

describe('persistRouteGeometryArtifacts', () => {
  let store: EphemeralDB;
  const nodeId = 'route-geometry-node' as NodeId;

  beforeEach(async () => {
    store = new EphemeralDB('test-route-geometry-artifacts');
    await store.open();
  });

  afterEach(async () => {
    store.close();
    await store.delete();
  });

  it('persists endpoint-preserving band artifacts and their direct tile transpose index', async () => {
    const source = await createSourceArtifact({
      coordinates: [
        [-100, 40],
        [-45, 30],
        [10, 20],
      ],
      distanceMeters: 150_000,
    });
    const output = await persistRouteGeometryArtifacts({
      ...source.params,
      sourceCacheId: source.sourceCacheId,
      geometryConfig: {
        ...DEFAULT_ROUTE_BUILD_CONFIG.geometryConfig,
        zoomBandBoundaries: [1, 2, 3],
      },
      routeGeometryConfig: {
        minDistanceMetersByBand: [0, 200_000],
        simplifyToleranceByBand: [0, 0.1],
      },
      store,
    });

    expect(output.artifacts).toEqual([
      expect.objectContaining({
        bandIndex: 0,
        zMin: 1,
        zMax: 1,
        zBase: 1,
        featureCount: 1,
        vertexCount: 2,
        filtered: false,
      }),
      expect.objectContaining({
        bandIndex: 1,
        zMin: 2,
        zMax: 3,
        zBase: 2,
        featureCount: 0,
        vertexCount: 0,
        tileCount: 0,
        filtered: true,
      }),
    ]);

    const records = await store.geometryCache.where('nodeId').equals(nodeId).sortBy('bandIndex');
    const metas = await store.geometryCacheMeta.where('nodeId').equals(nodeId).sortBy('bandIndex');
    const relations = await store.tileEmitBufferRelations.where('nodeId').equals(nodeId).toArray();
    expect(records).toHaveLength(2);
    expect(metas).toHaveLength(2);
    expect((metas[0] as { tolerance?: number } | undefined)?.tolerance).toBe(0);
    expect(records[0]?.metadata).toMatchObject({
      sourceCacheId: source.sourceCacheId,
      sourceInputHash: source.identity.inputHash,
      endpointPreserved: true,
      filtered: false,
    });
    expect(records[1]?.metadata).toMatchObject({
      endpointPreserved: false,
      filtered: true,
    });

    const decodedIncluded = decodeFeatureCollection(records[0]?.data);
    expect(decodedIncluded.features[0]?.geometry.coordinates).toEqual([
      [-100, 40],
      [10, 20],
    ]);
    const decodedFiltered = decodeFeatureCollection(records[1]?.data);
    expect(decodedFiltered.features).toEqual([]);

    const expectedTileIds = collectLineStringTileIds(
      [
        [-100, 40],
        [-45, 30],
        [10, 20],
      ],
      1
    )
      .map(String)
      .sort();
    expect(relations.map((relation) => relation.tileId).sort()).toEqual(expectedTileIds);
    expect(output.relationCount).toBe(expectedTileIds.length);
  });

  it('rejects a source lineage mismatch without writing geometry artifacts', async () => {
    const source = await createSourceArtifact({
      coordinates: [
        [139, 35],
        [140, 36],
      ],
      distanceMeters: 150_000,
    });

    await expect(
      persistRouteGeometryArtifacts({
        ...source.params,
        expected: {
          ...source.params.expected,
          sourceInputHash: 'wrong-input-hash',
        },
        sourceCacheId: source.sourceCacheId,
        geometryConfig: DEFAULT_ROUTE_BUILD_CONFIG.geometryConfig,
        routeGeometryConfig: DEFAULT_ROUTE_BUILD_CONFIG.routeGeometryConfig,
        store,
      })
    ).rejects.toThrow('sourceCache record does not satisfy the geometry input contract');

    await expect(store.geometryCache.count()).resolves.toBe(0);
    await expect(store.tileEmitBufferRelations.count()).resolves.toBe(0);
  });

  it('rejects mismatched zoom-band config instead of repeating the final value', async () => {
    const source = await createSourceArtifact({
      coordinates: [
        [139, 35],
        [140, 36],
      ],
      distanceMeters: 150_000,
    });

    await expect(
      persistRouteGeometryArtifacts({
        ...source.params,
        sourceCacheId: source.sourceCacheId,
        geometryConfig: {
          ...DEFAULT_ROUTE_BUILD_CONFIG.geometryConfig,
          zoomBandBoundaries: [1, 2, 3],
        },
        routeGeometryConfig: {
          minDistanceMetersByBand: [0],
          simplifyToleranceByBand: [0, 0.1],
        },
        store,
      })
    ).rejects.toThrow('minDistanceMetersByBand must contain exactly 2 values');

    await expect(store.geometryCache.count()).resolves.toBe(0);
  });

  it('rejects an included route outside the Web Mercator latitude range', async () => {
    const source = await createSourceArtifact({
      coordinates: [
        [0, 80],
        [1, 90],
      ],
      distanceMeters: 150_000,
    });

    await expect(
      persistRouteGeometryArtifacts({
        ...source.params,
        sourceCacheId: source.sourceCacheId,
        geometryConfig: DEFAULT_ROUTE_BUILD_CONFIG.geometryConfig,
        routeGeometryConfig: DEFAULT_ROUTE_BUILD_CONFIG.routeGeometryConfig,
        store,
      })
    ).rejects.toThrow('must be within Web Mercator latitude range');

    await expect(store.geometryCache.count()).resolves.toBe(0);
  });

  const createSourceArtifact = async (input: {
    coordinates: [number, number][];
    distanceMeters: number;
  }) => {
    const startCoordinates = input.coordinates[0];
    const endCoordinates = input.coordinates[input.coordinates.length - 1];
    if (!startCoordinates || !endCoordinates) throw new Error('Test coordinates are required');
    const identity = buildRouteSourceIdentity({
      routeMode: ROUTE_MODES.ROAD,
      start: { locationId: 'location-a' as NodeId, coordinates: startCoordinates },
      end: { locationId: 'location-b' as NodeId, coordinates: endCoordinates },
      generation: { method: 'direct' },
      sourceConfig: DEFAULT_ROUTE_BUILD_CONFIG.sourceConfig,
    });
    const artifact = await persistRouteSourceArtifact({
      nodeId,
      routeMode: ROUTE_MODES.ROAD,
      generationMethod: 'direct',
      identity,
      generationResult: {
        lineGeometry: input.coordinates,
        distance: input.distanceMeters,
      },
      generationTimeMs: 1,
      store,
    });
    return {
      identity,
      sourceCacheId: artifact.sourceCacheId,
      params: {
        nodeId,
        expected: {
          sourceKey: identity.sourceKey,
          sourceInputHash: identity.inputHash,
          routeMode: ROUTE_MODES.ROAD,
          startLocationId: identity.from.locationId,
          endLocationId: identity.to.locationId,
          startCoordinates: identity.from.coordinates,
          endCoordinates: identity.to.coordinates,
        },
      },
    };
  };
});

const decodeFeatureCollection = (
  data: ArrayBuffer | undefined
): {
  features: Array<{
    geometry: { coordinates: [number, number][] };
  }>;
} => {
  if (!data) throw new Error('Geometry artifact data is required');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(data))) as {
    features: Array<{
      geometry: { coordinates: [number, number][] };
    }>;
  };
};
