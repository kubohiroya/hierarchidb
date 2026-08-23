import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  LocationFeature,
  LocationFeatureId,
  LocationPointId,
} from '@hierarchidb/location-api';
import {
  buildLocationVectorTileId,
  clearLocationDatabases,
  closeLocationDB,
  getLocationDB,
  initializeLocationDB,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
  type LocationVectorTileRecord,
} from '@hierarchidb/location-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocationMutationService } from '../../LocationMutationService.js';
import { LocationQueryService } from '../../LocationQueryService.js';

const dbName = 'test-location-vector-tile-service';
const nodeId = 'location-node' as NodeId;
const otherNodeId = 'other-location-node' as NodeId;

const bufferFrom = (values: number[]): ArrayBuffer => Uint8Array.from(values).buffer;

const createTile = (
  targetNodeId: NodeId,
  values: number[],
  overrides: Partial<LocationVectorTileRecord> = {}
): LocationVectorTileRecord => {
  const z = 3;
  const x = 4;
  const y = 5;
  const data = bufferFrom(values);
  return {
    tileId: buildLocationVectorTileId(targetNodeId, z, x, y),
    nodeId: targetNodeId,
    z,
    x,
    y,
    data,
    size: data.byteLength,
    contentType: LOCATION_VECTOR_TILE_CONTENT_TYPE,
    timestamp: 1,
    ...overrides,
  };
};

const createFeature = (): LocationFeature => ({
  nodeId,
  id: 'feature-a' as LocationFeatureId,
  type: 'airport',
  data: {
    schemaVersion: 2,
    pointId: 'point-a' as LocationPointId,
    name: 'Airport A',
    latitude: 35,
    longitude: 139,
    type: 'airport',
    renderRank: 1,
    importance: 0.9,
    iconKey: 'flight_takeoff',
    labelClass: 'major',
    minZoom: 3,
  },
});

describe('location vector tile runtime services', () => {
  beforeEach(async () => {
    await closeLocationDB();
    initializeLocationDB(dbName);
    const db = getLocationDB();
    await db.open?.();
    await db.features.clear();
    await db.vectorTiles.clear();
  });

  afterEach(async () => {
    await closeLocationDB();
    await clearLocationDatabases(dbName);
  });

  it('returns tile bytes, null for missing tiles, and rejects corrupt records', async () => {
    const db = getLocationDB();
    const query = new LocationQueryService();
    await db.storeVectorTile(createTile(nodeId, [1, 2, 3, 4]));

    const tile = await query.getVectorTile(nodeId, 3, 4, 5);
    expect(Array.from(new Uint8Array(tile ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4]);

    await expect(query.getVectorTile(nodeId, 3, 4, 6)).resolves.toBeNull();

    await db.vectorTiles.put(createTile(otherNodeId, [9], { size: 2 }));
    await expect(query.getVectorTile(otherNodeId, 3, 4, 5)).rejects.toThrow(
      'location-vector-tile-size-mismatch'
    );
  });

  it('resolves point metadata by pointId from the Location SSOT feature table', async () => {
    const db = getLocationDB();
    const query = new LocationQueryService();
    await db.features.put(createFeature());

    await expect(query.getPoint(nodeId, 'point-a')).resolves.toMatchObject({
      nodeId,
      id: 'feature-a',
      data: {
        pointId: 'point-a',
        name: 'Airport A',
      },
    });
    await expect(query.getPoint(nodeId, 'missing-point')).resolves.toBeNull();
    await expect(query.getPoint(nodeId, '')).rejects.toThrow('location-point-id-invalid');
  });

  it('clears vector tiles independently and keeps artifact cleanup scoped to features', async () => {
    const db = getLocationDB();
    const mutation = new LocationMutationService();
    await db.features.put(createFeature());
    await db.storeVectorTile(createTile(nodeId, [1, 2]));
    await db.storeVectorTile(createTile(otherNodeId, [3, 4]));

    await mutation.clearLocationVectorTiles(nodeId);

    await expect(db.features.where('nodeId').equals(nodeId).count()).resolves.toBe(1);
    await expect(db.vectorTiles.where('nodeId').equals(nodeId).count()).resolves.toBe(0);
    await expect(db.vectorTiles.where('nodeId').equals(otherNodeId).count()).resolves.toBe(1);

    await db.storeVectorTile(createTile(nodeId, [5, 6]));
    await mutation.clearLocationArtifacts(nodeId);

    await expect(db.features.where('nodeId').equals(nodeId).count()).resolves.toBe(0);
    await expect(db.vectorTiles.where('nodeId').equals(nodeId).count()).resolves.toBe(1);
    await expect(db.vectorTiles.where('nodeId').equals(otherNodeId).count()).resolves.toBe(1);
  });
});
