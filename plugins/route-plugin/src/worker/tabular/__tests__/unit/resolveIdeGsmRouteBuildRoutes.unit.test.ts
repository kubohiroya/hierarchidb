import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES, type RouteCanonicalBuildInputResolverPorts } from '@hierarchidb/route-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveIdeGsmRouteBuildRoutes } from '../../resolveIdeGsmRouteBuildRoutes.js';

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
const locationNodeA = 'location-a-node' as NodeId;
const locationNodeB = 'location-b-node' as NodeId;
const locationNodeC = 'location-c-node' as NodeId;

const createPorts = (
  rows: Array<Record<string, unknown>>
): RouteCanonicalBuildInputResolverPorts => ({
  loadIdeGsmRouteRows: vi.fn(async () => ({ headers, rows })),
  resolveIdeGsmLocationNodeIds: vi.fn(async () => [locationNodeA, locationNodeB, locationNodeC]),
  buildIdeGsmLocationIndex: vi.fn(
    async () =>
      new Map([
        [
          'A',
          {
            locationFeatureId: 'feature-a',
            locationNodeId: locationNodeA,
            name: 'A',
            latitude: 35,
            longitude: 139,
            pointId: 'point-a',
            admin0Code: 'JP',
          },
        ],
        [
          'B',
          {
            locationFeatureId: 'feature-b',
            locationNodeId: locationNodeB,
            name: 'B',
            latitude: 36,
            longitude: 140,
            pointId: 'point-b',
            admin0Code: 'JP',
          },
        ],
        [
          'C',
          {
            locationFeatureId: 'feature-c',
            locationNodeId: locationNodeC,
            name: 'C',
            latitude: 37,
            longitude: 141,
            pointId: 'point-c',
            admin0Code: 'US',
          },
        ],
      ])
  ),
});

describe('resolveIdeGsmRouteBuildRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plans only selected IDE-GSM rows in deterministic order', async () => {
    const ports = createPorts([
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
    ]);

    const routes = await resolveIdeGsmRouteBuildRoutes({
      nodeId: routeNodeId,
      tabularSourceId: 'route-table',
      selectedArrayByCountries: {
        JP: [false, false, false, false, true, false, false, false, false, true],
      },
      ports,
    });

    expect(routes).toEqual([
      {
        startLocationId: locationNodeB,
        endLocationId: locationNodeA,
        startCoordinates: [140, 36],
        endCoordinates: [139, 35],
        routeMode: ROUTE_MODES.ROAD,
        metadata: {
          oneway: false,
        },
      },
      {
        startLocationId: locationNodeC,
        endLocationId: locationNodeA,
        startCoordinates: [141, 37],
        endCoordinates: [139, 35],
        routeMode: ROUTE_MODES.ROAD,
        metadata: {
          oneway: true,
        },
      },
    ]);
  });

  it('fails when IDE-GSM oneway metadata is not a 0/1 directionality value', async () => {
    await expect(
      resolveIdeGsmRouteBuildRoutes({
        nodeId: routeNodeId,
        tabularSourceId: 'route-table',
        selectedArrayByCountries: {
          JP: [false, false, false, false, true, false, false, false, false, true],
        },
        ports: createPorts([
          {
            Start: 'A',
            End: 'B',
            Name: 'invalid-oneway',
            Distance: '10',
            Speed: '50',
            Mode: '0',
            Country1: 'JP',
            Country2: 'JP',
            Oneway: '2',
          },
        ]),
      })
    ).rejects.toThrow('invalid metadata.oneway');
  });

  it('fails with a reason when a selected source row cannot resolve its endpoint', async () => {
    await expect(
      resolveIdeGsmRouteBuildRoutes({
        nodeId: routeNodeId,
        tabularSourceId: 'route-table',
        selectedArrayByCountries: {
          JP: [false, false, false, false, true, false, false, false, false, true],
        },
        ports: createPorts([
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
        ]),
      })
    ).rejects.toThrow('End location not found');
  });
});
