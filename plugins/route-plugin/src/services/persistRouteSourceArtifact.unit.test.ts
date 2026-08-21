// @vitest-environment node

import type { NodeId } from '@hierarchidb/core-types';
import { EphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';
import { persistRouteSourceArtifact } from './persistRouteSourceArtifact.js';
import { buildRouteSourceIdentity } from './routeSourceIdentity.js';

describe('persistRouteSourceArtifact', () => {
  let store: EphemeralDB;
  const nodeId = 'route-artifact-node' as NodeId;
  const identity = buildRouteSourceIdentity({
    routeMode: ROUTE_MODES.ROAD,
    start: { locationId: 'location-a' as NodeId, coordinates: [139, 35] },
    end: { locationId: 'location-b' as NodeId, coordinates: [140, 36] },
    generation: { method: 'direct' },
    sourceConfig: DEFAULT_ROUTE_BUILD_CONFIG.sourceConfig,
  });

  beforeEach(async () => {
    store = new EphemeralDB('test-route-source-artifact');
    await store.open();
  });

  afterEach(async () => {
    store.close();
    await store.delete();
  });

  it('persists one readable GeoJSON LineString with complete cache metadata', async () => {
    const output = await persistRouteSourceArtifact({
      nodeId,
      routeMode: ROUTE_MODES.ROAD,
      generationMethod: 'direct',
      identity,
      generationResult: {
        lineGeometry: [[139, 35], [139.5, 35.5], [140, 36]],
        distance: 150_000,
        duration: 3_600,
      },
      generationTimeMs: 5,
      store,
    });

    const [record, meta] = await Promise.all([
      store.sourceCache.get(output.sourceCacheId),
      store.sourceCacheMeta.get(output.sourceCacheId),
    ]);
    expect(record).toMatchObject({
      domainType: 'route',
      sourceKey: identity.sourceKey,
      format: 'geojson',
      compression: 'none',
      featureCount: 1,
      vertexCount: 3,
      contentHash: output.contentHash,
      metadata: { inputHash: identity.inputHash },
    });
    expect(meta).toMatchObject({
      domainType: 'route',
      format: 'geojson',
      contentHash: output.contentHash,
      metadata: { inputHash: identity.inputHash },
    });
    if (!record) throw new Error('Route source artifact was not persisted');
    const decoded = JSON.parse(new TextDecoder().decode(record.data)) as {
      features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
    };
    expect(decoded.features).toHaveLength(1);
    expect(decoded.features?.[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [[139, 35], [139.5, 35.5], [140, 36]],
    });
  });

  it('rejects an invalid generator result without persisting an artifact', async () => {
    await expect(persistRouteSourceArtifact({
      nodeId,
      routeMode: ROUTE_MODES.ROAD,
      generationMethod: 'direct',
      identity,
      generationResult: {
        lineGeometry: [],
        distance: 0,
      },
      generationTimeMs: 1,
      store,
    })).rejects.toThrow('lineGeometry must contain at least two coordinates');

    await expect(store.sourceCache.count()).resolves.toBe(0);
    await expect(store.sourceCacheMeta.count()).resolves.toBe(0);
  });
});
