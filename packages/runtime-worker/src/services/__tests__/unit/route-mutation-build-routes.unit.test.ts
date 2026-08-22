import type { NodeId } from '@hierarchidb/core-types';
import type {
  LocationGroupItem,
  LocationPointId,
  LocationQueryAPI,
} from '@hierarchidb/location-api';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import type { TreeNode, TreeQueryAPI } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadTabularTableRows: vi.fn(),
}));

vi.mock('../../utils/loadTabularTableRows.js', () => ({
  loadTabularTableRows: mocks.loadTabularTableRows,
}));

import { RouteMutationService } from '../../RouteMutationService.js';

const headers = [
  'Start',
  'End',
  'Name',
  'Distance',
  'Speed',
  'Border',
  'Overhead',
  'Loading',
  'Mode',
  'Quality',
  'Oneway',
  'Freight',
  'Country1',
  'Region1',
  'Country2',
  'Region2',
];

const routeNodeId = 'route-node' as NodeId;
const parentNodeId = 'parent-node' as NodeId;
const locationNodeA = 'location-a-node' as NodeId;
const locationNodeB = 'location-b-node' as NodeId;
const locationNodeC = 'location-c-node' as NodeId;

const locationGroupItem = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  admin0Code: string
): LocationGroupItem => ({
  id,
  data: {
    name,
    latitude,
    longitude,
    schemaVersion: 2,
    pointId: `point-${name.toLowerCase()}` as LocationPointId,
    type: 'airport',
    admin0Code,
  },
});

const treeNode = (id: NodeId, nodeType: string, name: string): TreeNode =>
  ({
    id,
    parentId: parentNodeId,
    nodeType,
    depth: 1,
    visible: true,
    metadata: { name },
  }) as TreeNode;

const createTreeQuery = (): Pick<TreeQueryAPI, 'getNode' | 'listChildren' | 'listDescendants'> => {
  const routeNode = treeNode(routeNodeId, 'route', 'Route');
  const locations = [
    treeNode(locationNodeC, 'location', 'C'),
    treeNode(locationNodeA, 'location', 'A'),
    treeNode(locationNodeB, 'location', 'B'),
  ];
  return {
    getNode: vi.fn(async (id: NodeId) => {
      if (id === routeNodeId) return routeNode;
      if (id === parentNodeId) return treeNode(parentNodeId, 'folder', 'Parent');
      return locations.find((node) => node.id === id) ?? null;
    }),
    listChildren: vi.fn(async () => [routeNode, ...locations]),
    listDescendants: vi.fn(async () => []),
  };
};

const createLocationQuery = (): Pick<LocationQueryAPI, 'listLocationGroups'> => ({
  listLocationGroups: vi.fn(async (nodeId: NodeId): Promise<LocationGroupItem[]> => {
    if (nodeId === locationNodeA) {
      return [locationGroupItem('feature-a', 'A', 35, 139, 'JP')];
    }
    if (nodeId === locationNodeB) {
      return [locationGroupItem('feature-b', 'B', 36, 140, 'JP')];
    }
    if (nodeId === locationNodeC) {
      return [locationGroupItem('feature-c', 'C', 37, 141, 'US')];
    }
    return [];
  }),
});

const createService = (): RouteMutationService =>
  new RouteMutationService(
    { open: vi.fn() } as never,
    createTreeQuery() as TreeQueryAPI,
    createLocationQuery() as LocationQueryAPI
  );

describe('RouteMutationService.resolveIdeGsmRouteBuildRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plans only selected IDE-GSM rows in deterministic order', async () => {
    mocks.loadTabularTableRows.mockResolvedValue({
      headers,
      rows: [
        {
          Start: 'C',
          End: 'A',
          Name: 'selected-or-road',
          Distance: '30',
          Speed: '50',
          Mode: '0',
          Country1: 'US',
          Country2: 'JP',
          Oneway: '1',
        },
        {
          Start: 'B',
          End: 'A',
          Name: 'selected-and-road',
          Distance: '20',
          Speed: '50',
          Mode: '0',
          Country1: 'JP',
          Country2: 'JP',
          Oneway: '0',
        },
        {
          Start: 'A',
          End: 'B',
          Name: 'unselected-waterway',
          Distance: '10',
          Speed: '50',
          Mode: '1',
          Country1: 'JP',
          Country2: 'JP',
        },
      ],
    });

    const routes = await createService().resolveIdeGsmRouteBuildRoutes({
      nodeId: routeNodeId,
      tabularSourceId: 'route-table',
      selectedArrayByCountries: {
        JP: [false, false, false, false, true, false, false, false, false, true],
      },
    });

    expect(routes).toEqual([
      {
        startLocationId: locationNodeB,
        endLocationId: locationNodeA,
        startCoordinates: [140, 36],
        endCoordinates: [139, 35],
        routeMode: ROUTE_MODES.ROAD,
        metadata: {
          oneway: 0,
        },
      },
      {
        startLocationId: locationNodeC,
        endLocationId: locationNodeA,
        startCoordinates: [141, 37],
        endCoordinates: [139, 35],
        routeMode: ROUTE_MODES.ROAD,
        metadata: {
          oneway: 1,
        },
      },
    ]);
  });

  it('fails with a reason when a selected source row cannot resolve its endpoint', async () => {
    mocks.loadTabularTableRows.mockResolvedValue({
      headers,
      rows: [
        {
          Start: 'A',
          End: 'Missing',
          Name: 'missing-endpoint',
          Distance: '10',
          Speed: '50',
          Mode: '0',
          Country1: 'JP',
          Country2: 'JP',
        },
      ],
    });

    await expect(
      createService().resolveIdeGsmRouteBuildRoutes({
        nodeId: routeNodeId,
        tabularSourceId: 'route-table',
        selectedArrayByCountries: {
          JP: [false, false, false, false, true, false, false, false, false, true],
        },
      })
    ).rejects.toThrow('End location not found');
  });
});
