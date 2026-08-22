import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeatureId } from '@hierarchidb/location-api';
import type { RouteLineString, RouteMode } from '@hierarchidb/route-api';
import {
  clearRouteDatabases,
  closeRouteDB,
  countRouteReferencesToLocations,
  getRouteDB,
  initializeRouteDB,
} from '@hierarchidb/route-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocationMutationService } from '../../LocationMutationService';

const asNodeId = (value: string): NodeId => value as NodeId;
const asLocationFeatureId = (value: string): LocationFeatureId => value as LocationFeatureId;

type RouteLineStringFixture = {
  id?: string;
  nodeId?: string;
  featureId?: string;
  name?: string;
  routeMode?: RouteMode;
  startLocationId?: string;
  endLocationId?: string;
  startPoint?: {
    latitude: number;
    longitude: number;
    locationId?: string;
    locationFeatureId?: string;
  };
  endPoint?: {
    latitude: number;
    longitude: number;
    locationId?: string;
    locationFeatureId?: string;
  };
};

const createRouteLineString = (overrides: RouteLineStringFixture = {}): RouteLineString => {
  const {
    id = 'route-default',
    nodeId = 'route-node-default',
    featureId,
    name,
    routeMode,
    startLocationId,
    endLocationId,
    startPoint,
    endPoint,
    ...rest
  } = overrides;
  const startLocation: NonNullable<RouteLineStringFixture['startPoint']> = startPoint ?? {
    latitude: 0,
    longitude: 0,
  };
  const endLocation: NonNullable<RouteLineStringFixture['endPoint']> = endPoint ?? {
    latitude: 1,
    longitude: 1,
  };
  const routeStartPoint = {
    latitude: startLocation.latitude ?? 0,
    longitude: startLocation.longitude ?? 0,
    ...(startLocation.locationId !== undefined && {
      locationId: asNodeId(startLocation.locationId),
    }),
    ...(startLocation.locationFeatureId !== undefined && {
      locationFeatureId: asLocationFeatureId(startLocation.locationFeatureId),
    }),
  };
  const routeEndPoint = {
    latitude: endLocation.latitude ?? 1,
    longitude: endLocation.longitude ?? 1,
    ...(endLocation.locationId !== undefined && { locationId: asNodeId(endLocation.locationId) }),
    ...(endLocation.locationFeatureId !== undefined && {
      locationFeatureId: asLocationFeatureId(endLocation.locationFeatureId),
    }),
  };
  return {
    id: asNodeId(id),
    nodeId: asNodeId(nodeId),
    featureId: featureId ?? `feature-${id}`,
    name: name ?? `route-${id}`,
    routeMode: routeMode ?? 'road',
    startPoint: routeStartPoint,
    endPoint: routeEndPoint,
    ...(startLocationId ? { startLocationId: asNodeId(startLocationId) } : {}),
    ...(endLocationId ? { endLocationId: asNodeId(endLocationId) } : {}),
    ...rest,
  } as RouteLineString;
};

describe('route location reference indexing and legacy fallback', () => {
  beforeEach(async () => {
    const db = initializeRouteDB('test-route');
    await db.open?.();
    await db.features.clear();
    await db.vectorTiles.clear();
    await db.tileIndex.clear();
  });

  afterEach(async () => {
    await closeRouteDB();
    await clearRouteDatabases('test-route');
    await closeRouteDB();
  });

  it('counts legacy route references in addition to indexed references without duplicates', async () => {
    const db = getRouteDB();
    const locationId = asNodeId('location-1');
    const routes: RouteLineString[] = [
      createRouteLineString({
        id: 'indexed-start',
        startLocationId: locationId,
        startPoint: { latitude: 10, longitude: 20 },
      }),
      createRouteLineString({
        id: 'indexed-end',
        endLocationId: locationId,
        endPoint: { latitude: 30, longitude: 40 },
      }),
      createRouteLineString({
        id: 'indexed-both',
        startLocationId: locationId,
        endLocationId: locationId,
        startPoint: { latitude: 50, longitude: 60 },
        endPoint: { latitude: 70, longitude: 80 },
      }),
      createRouteLineString({
        id: 'legacy-start',
        startPoint: {
          latitude: 11,
          longitude: 21,
          locationId,
        },
      }),
      createRouteLineString({
        id: 'unrelated',
        startLocationId: asNodeId('other-location'),
        startPoint: { latitude: 13, longitude: 23 },
      }),
    ];
    await db.features.bulkPut(routes);

    const count = await countRouteReferencesToLocations([locationId]);
    expect(count).toBe(4);
  });

  it('finds impacted route IDs by location id and feature ids across indexed and legacy rows', async () => {
    const db = getRouteDB();
    const service = new LocationMutationService();
    const locationNodeId = asNodeId('location-legacy');
    const routes: RouteLineString[] = [
      createRouteLineString({
        id: 'modern-matched',
        startLocationId: locationNodeId,
        startPoint: {
          latitude: 10,
          longitude: 20,
          locationFeatureId: asLocationFeatureId('feature-1'),
        },
      }),
      createRouteLineString({
        id: 'legacy-matched',
        startPoint: {
          latitude: 11,
          longitude: 21,
          locationId: locationNodeId,
          locationFeatureId: asLocationFeatureId('feature-2'),
        },
      }),
      createRouteLineString({
        id: 'legacy-end-matched',
        endPoint: {
          latitude: 31,
          longitude: 41,
          locationId: locationNodeId,
          locationFeatureId: asLocationFeatureId('feature-3'),
        },
      }),
      createRouteLineString({
        id: 'modern-unmatched-feature',
        startLocationId: locationNodeId,
        startPoint: {
          latitude: 15,
          longitude: 25,
          locationFeatureId: asLocationFeatureId('feature-unmatched'),
        },
      }),
      createRouteLineString({
        id: 'legacy-unmatched-feature',
        startPoint: {
          latitude: 16,
          longitude: 26,
          locationId: locationNodeId,
          locationFeatureId: asLocationFeatureId('feature-unmatched'),
        },
      }),
      createRouteLineString({
        id: 'different-location',
        startPoint: {
          latitude: 17,
          longitude: 27,
          locationId: asNodeId('other-location'),
          locationFeatureId: asLocationFeatureId('feature-2'),
        },
      }),
    ];
    await db.features.bulkPut(routes);

    const findRouteIdsReferencingLocationFeatures = Reflect.get(
      service as object,
      'findRouteIdsReferencingLocationFeatures'
    );
    if (typeof findRouteIdsReferencingLocationFeatures !== 'function') {
      throw new Error('findRouteIdsReferencingLocationFeatures is unavailable');
    }

    const matched = await (
      findRouteIdsReferencingLocationFeatures as (
        routeDb: ReturnType<typeof getRouteDB>,
        locationNodeId: NodeId,
        locationFeatureIds: string[]
      ) => Promise<NodeId[]>
    )(db, locationNodeId, ['feature-1', 'feature-2', 'feature-3']);
    expect(new Set(matched)).toEqual(
      new Set([
        asNodeId('modern-matched'),
        asNodeId('legacy-matched'),
        asNodeId('legacy-end-matched'),
      ])
    );
  });
});
