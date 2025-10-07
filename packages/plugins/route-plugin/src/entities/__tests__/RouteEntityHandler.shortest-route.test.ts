import { describe, expect, it } from 'vitest';
import type { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';
import { RouteEntityHandler } from '../RouteEntityHandler';
import type { RouteEntity } from '../RouteEntity';

type RouteFactoryOptions = {
  id: string;
  start: NodeId;
  end: NodeId;
  distance: number;
  overrides?: Partial<RouteEntity>;
};

function createRoute({ id, start, end, distance, overrides }: RouteFactoryOptions): RouteEntity {
  const now = Date.now();

  return {
    id: id as NodeId,
    nodeId: `${id}-node` as NodeId,
    name: id,
    category: { primary: 'road' },
    metadata: {},
    customFields: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
    startLocationId: start,
    endLocationId: end,
    waypointLocationIds: [],
    startPoint: { coordinates: [0, 0] },
    endPoint: { coordinates: [0, 0] },
    waypoints: [],
    lineGeometry: [[0, 0], [0, 0]],
    generationMethod: 'direct',
    distance,
    transportMode: 'road',
    processingStatus: 'completed',
    childRouteIds: [],
    ...overrides,
  } as RouteEntity;
}

async function seedRoutes(handler: RouteEntityHandler, routes: RouteEntity[]): Promise<void> {
  const table = (handler as any).table as Table<RouteEntity, NodeId>;
  await table.bulkAdd(routes);
}

async function disposeHandler(handler: RouteEntityHandler): Promise<void> {
  await ((handler as any).routeDB?.close?.() ?? Promise.resolve());
}

describe('RouteEntityHandler.getShortestRouteSetBetweenLocations', () => {
  it('returns a direct route when it is the only option', async () => {
    const handler = new RouteEntityHandler();
    const locationA = 'loc-a' as NodeId;
    const locationB = 'loc-b' as NodeId;

    try {
      await seedRoutes(handler, [
        createRoute({ id: 'route-ab', start: locationA, end: locationB, distance: 1200 }),
      ]);

      const result = await handler.getShortestRouteSetBetweenLocations(locationA, locationB);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('route-ab');
    } finally {
      await disposeHandler(handler);
    }
  });

  it('chooses the path with the smallest total distance', async () => {
    const handler = new RouteEntityHandler();
    const locationA = 'loc-a' as NodeId;
    const locationB = 'loc-b' as NodeId;
    const locationC = 'loc-c' as NodeId;

    try {
      await seedRoutes(handler, [
        createRoute({ id: 'route-ab', start: locationA, end: locationB, distance: 500 }),
        createRoute({ id: 'route-bc', start: locationB, end: locationC, distance: 500 }),
        createRoute({ id: 'route-ac-direct', start: locationA, end: locationC, distance: 2000 }),
      ]);

      const result = await handler.getShortestRouteSetBetweenLocations(locationA, locationC);
      expect(result.map(route => route.id)).toEqual(['route-ab', 'route-bc']);
    } finally {
      await disposeHandler(handler);
    }
  });

  it('returns an empty array when no connecting routes exist', async () => {
    const handler = new RouteEntityHandler();
    const locationA = 'loc-a' as NodeId;
    const locationC = 'loc-c' as NodeId;

    try {
      await seedRoutes(handler, [
        createRoute({ id: 'route-ab', start: locationA, end: 'loc-b' as NodeId, distance: 800 }),
      ]);

      const result = await handler.getShortestRouteSetBetweenLocations(locationA, locationC);
      expect(result).toEqual([]);
    } finally {
      await disposeHandler(handler);
    }
  });
});
