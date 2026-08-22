import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type {
  LocationFeatureId,
  LocationGroupItem,
  LocationPointId,
} from '@hierarchidb/location-api';
import {
  clearLocationDatabases,
  closeLocationDB,
  getLocationDB,
  initializeLocationDB,
} from '@hierarchidb/location-store';
import type { RouteLineString } from '@hierarchidb/route-api';
import {
  clearRouteDatabases,
  closeRouteDB,
  getRouteDB,
  initializeRouteDB,
} from '@hierarchidb/route-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocationMutationService } from '../../LocationMutationService';

const locationDbName = 'test-location-route-cascade';
const routeDbName = 'test-route-cascade';
const locationNodeId = 'location-node' as NodeId;
const routeNodeId = 'route-node' as NodeId;
const routeId = 'route-feature' as NodeId;
const featureId = 'location-feature' as LocationFeatureId;

const locationItem = (
  overrides: Partial<NonNullable<LocationGroupItem['data']>> = {}
): LocationGroupItem => ({
  id: featureId,
  data: {
    schemaVersion: 2,
    pointId: 'point-a' as LocationPointId,
    name: 'Location A',
    latitude: 35,
    longitude: 139,
    type: 'airport',
    admin0: 'Japan',
    admin0Code: 'JP',
    admin1: 'Tokyo',
    admin1Code: '13',
    ...overrides,
  },
});

const routeLine = (overrides: Partial<RouteLineString> = {}): RouteLineString => ({
  id: routeId,
  nodeId: routeNodeId,
  type: 'route',
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  featureId: 'route-feature-id',
  name: 'Route A',
  routeMode: 'road',
  startLocationId: locationNodeId,
  endLocationId: 'other-location-node' as NodeId,
  startPoint: {
    locationId: locationNodeId,
    locationFeatureId: featureId,
    latitude: 35,
    longitude: 139,
    name: 'Location A',
    locationName: 'Location A',
    admin0Name: 'Japan',
    admin0Code: 'JP',
    admin1Name: 'Tokyo',
    admin1Code: '13',
  },
  endPoint: {
    locationId: 'other-location-node' as NodeId,
    locationFeatureId: 'other-feature' as LocationFeatureId,
    latitude: 36,
    longitude: 140,
  },
  ...overrides,
});

const seedRouteArtifacts = async (targetNodeId: NodeId = routeNodeId): Promise<void> => {
  const routeDb = getRouteDB();
  await routeDb.vectorTiles.put({
    tileId: `${String(targetNodeId)}:tile`,
    nodeId: targetNodeId,
    z: 1,
    x: 1,
    y: 1,
    data: new ArrayBuffer(4),
    size: 4,
    contentType: 'application/vnd.mapbox-vector-tile',
    timestamp: 1,
  });
  await routeDb.tileIndex.put({
    id: `${String(targetNodeId)}:legacy-index`,
    nodeId: targetNodeId,
    z: 1,
    x: 1,
    y: 1,
    lineIds: [String(routeId)],
    updatedAt: 1,
  });
  await ephemeralDB.sourceCache.put({
    id: `${String(targetNodeId)}:source`,
    nodeId: targetNodeId,
    domainType: 'route',
    sourceKey: 'road:location-node:other-location-node',
    data: new ArrayBuffer(4),
    format: 'geojson',
    featureCount: 1,
    bbox: [139, 35, 140, 36],
    downloadTime: 1,
    size: 4,
    timestamp: 1,
  });
  await ephemeralDB.geometryCache.put({
    id: `${String(targetNodeId)}:geometry`,
    nodeId: targetNodeId,
    domainType: 'route',
    bandIndex: 0,
    sourceKey: 'road:location-node:other-location-node',
    data: new ArrayBuffer(4),
    featureCount: 1,
    vertexCount: 2,
    polygonCount: 0,
    extractionRatio: 1,
    tolerance: 0,
    timestamp: 1,
  });
  await ephemeralDB.tileEmitBufferRelations.put({
    id: `${String(targetNodeId)}:relation`,
    nodeId: targetNodeId,
    domainType: 'route',
    bandIndex: 0,
    tileId: `${String(targetNodeId)}:tile`,
    bufferId: `${String(targetNodeId)}:geometry`,
    createdAt: 1,
  });
  await ephemeralDB.buildTasks.put({
    taskId: `${String(targetNodeId)}:task`,
    nodeId: targetNodeId,
    version: 1,
    domainType: 'route',
    status: 'completed',
    index: 0,
    stage: 'source',
    progress: 100,
  });
};

const expectRouteArtifactsCleared = async (): Promise<void> => {
  const routeDb = getRouteDB();
  await expect(routeDb.vectorTiles.where('nodeId').equals(routeNodeId).count()).resolves.toBe(0);
  await expect(routeDb.tileIndex.where('nodeId').equals(routeNodeId).count()).resolves.toBe(0);
  await expect(ephemeralDB.sourceCache.where('nodeId').equals(routeNodeId).count()).resolves.toBe(
    0
  );
  await expect(
    ephemeralDB.sourceCacheMeta.where('nodeId').equals(routeNodeId).count()
  ).resolves.toBe(0);
  await expect(ephemeralDB.geometryCache.where('nodeId').equals(routeNodeId).count()).resolves.toBe(
    0
  );
  await expect(
    ephemeralDB.geometryCacheMeta.where('nodeId').equals(routeNodeId).count()
  ).resolves.toBe(0);
  await expect(
    ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(routeNodeId).count()
  ).resolves.toBe(0);
  await expect(ephemeralDB.buildTasks.where('nodeId').equals(routeNodeId).count()).resolves.toBe(0);
};

describe('LocationMutationService route cascade and rebuild reservation', () => {
  beforeEach(async () => {
    await closeLocationDB();
    await closeRouteDB();
    initializeLocationDB(locationDbName);
    initializeRouteDB(routeDbName);
    const locationDb = getLocationDB();
    const routeDb = getRouteDB();
    await locationDb.open?.();
    await routeDb.open?.();
    await ephemeralDB.open?.();
    await locationDb.features.clear();
    await routeDb.features.clear();
    await routeDb.vectorTiles.clear();
    await routeDb.tileIndex.clear();
    await ephemeralDB.clearNodeData(routeNodeId);
  });

  afterEach(async () => {
    await ephemeralDB.clearNodeData(routeNodeId);
    await closeLocationDB();
    await clearLocationDatabases(locationDbName);
    await closeRouteDB();
    await clearRouteDatabases(routeDbName);
  });

  it('marks impacted routes and reserves one route-node rebuild after structural location updates', async () => {
    const locationDb = getLocationDB();
    const routeDb = getRouteDB();
    const service = new LocationMutationService();
    await locationDb.features.put({
      nodeId: locationNodeId,
      id: featureId,
      type: 'airport',
      data: locationItem().data,
      updatedAt: 1,
    });
    await routeDb.features.put(routeLine());
    await seedRouteArtifacts();

    await service.upsertLocationGroups(locationNodeId, [locationItem({ latitude: 35.5 })]);

    const route = await routeDb.features.get(routeId);
    expect(route?.rebuildRequired).toBe(true);
    expect(route?.rebuildRequiredAt).toEqual(expect.any(Number));
    await expectRouteArtifactsCleared();
    await expect(ephemeralDB.buildSessionConfigs.get(routeNodeId)).resolves.toMatchObject({
      nodeId: routeNodeId,
      domainType: 'route',
    });
    await expect(ephemeralDB.buildSessionStatuses.get(routeNodeId)).resolves.toMatchObject({
      nodeId: routeNodeId,
      status: 'idle',
      stopReason: 'unknown',
    });
  });

  it('does not overwrite an already running route session while invalidating structural artifacts', async () => {
    const locationDb = getLocationDB();
    const routeDb = getRouteDB();
    const service = new LocationMutationService();
    await locationDb.features.put({
      nodeId: locationNodeId,
      id: featureId,
      type: 'airport',
      data: locationItem().data,
      updatedAt: 1,
    });
    await routeDb.features.put(routeLine());
    await seedRouteArtifacts();
    await ephemeralDB.buildSessionStatuses.put({
      nodeId: routeNodeId,
      status: 'running',
      stopReason: undefined,
    });

    await service.upsertLocationGroups(locationNodeId, [locationItem({ admin0Code: 'US' })]);

    const route = await routeDb.features.get(routeId);
    expect(route?.rebuildRequired).toBe(true);
    await expectRouteArtifactsCleared();
    await expect(ephemeralDB.buildSessionStatuses.get(routeNodeId)).resolves.toMatchObject({
      nodeId: routeNodeId,
      status: 'running',
    });
    await expect(ephemeralDB.buildSessionConfigs.get(routeNodeId)).resolves.toBeUndefined();
  });

  it('syncs metadata-only location updates without deleting artifacts or reserving rebuilds', async () => {
    const locationDb = getLocationDB();
    const routeDb = getRouteDB();
    const service = new LocationMutationService();
    await locationDb.features.put({
      nodeId: locationNodeId,
      id: featureId,
      type: 'airport',
      data: locationItem().data,
      updatedAt: 1,
    });
    await routeDb.features.put(routeLine());
    await seedRouteArtifacts();

    await service.upsertLocationGroups(locationNodeId, [
      locationItem({ name: 'Location A Renamed', admin1: 'Tokyo-to' }),
    ]);

    const route = await routeDb.features.get(routeId);
    expect(route?.rebuildRequired).toBeUndefined();
    expect(route?.startPoint.name).toBe('Location A Renamed');
    expect(route?.startPoint.locationName).toBe('Location A Renamed');
    expect(route?.startPoint.admin1Name).toBe('Tokyo-to');
    await expect(routeDb.vectorTiles.where('nodeId').equals(routeNodeId).count()).resolves.toBe(1);
    await expect(ephemeralDB.sourceCache.where('nodeId').equals(routeNodeId).count()).resolves.toBe(
      1
    );
    await expect(ephemeralDB.buildSessionStatuses.get(routeNodeId)).resolves.toBeUndefined();
  });

  it('cascades route feature and artifact deletion before deleting location rows', async () => {
    const locationDb = getLocationDB();
    const routeDb = getRouteDB();
    const service = new LocationMutationService();
    await locationDb.features.put({
      nodeId: locationNodeId,
      id: featureId,
      type: 'airport',
      data: locationItem().data,
      updatedAt: 1,
    });
    await routeDb.features.put(routeLine());
    await seedRouteArtifacts();

    await service.deleteLocationGroups(locationNodeId, [String(featureId)]);

    await expect(
      locationDb.features.get([locationNodeId, String(featureId)])
    ).resolves.toBeUndefined();
    await expect(routeDb.features.get(routeId)).resolves.toBeUndefined();
    await expectRouteArtifactsCleared();
  });
});
