import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES, type RouteCanonicalBuildInputResolverPorts } from '@hierarchidb/route-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRouteCanonicalBuildInput } from './resolveRouteCanonicalBuildInput.js';

const nodeId = 'route-node' as NodeId;

const createPorts = (): RouteCanonicalBuildInputResolverPorts => ({
  loadIdeGsmRouteRows: vi.fn(async () => ({
    headers: [
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
    ],
    rows: [
      {
        Start: 'A',
        End: 'B',
        Name: 'selected-road',
        Distance: '10',
        Speed: '50',
        Mode: '0',
        Country1: 'JP',
        Country2: 'JP',
      },
    ],
  })),
  resolveIdeGsmLocationNodeIds: vi.fn(async () => ['location-a' as NodeId, 'location-b' as NodeId]),
  buildIdeGsmLocationIndex: vi.fn(
    async () =>
      new Map([
        [
          'A',
          {
            locationFeatureId: 'feature-a' as never,
            locationNodeId: 'location-a' as NodeId,
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
            locationFeatureId: 'feature-b' as never,
            locationNodeId: 'location-b' as NodeId,
            name: 'B',
            latitude: 36,
            longitude: 140,
            pointId: 'point-b',
            admin0Code: 'JP',
          },
        ],
      ])
  ),
});

describe('resolveRouteCanonicalBuildInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects direct and selection fields in the same external payload', async () => {
    await expect(
      resolveRouteCanonicalBuildInput(
        nodeId,
        {
          routeBuildInput: { kind: 'selection-driven' },
          routeMode: 'road',
          tabularSourceId: 'route-table',
          selectedArrayByCountries: {
            JP: [false, false, false, false, true, false, false, false, false, true],
          },
        },
        createPorts()
      )
    ).rejects.toMatchObject({ code: 'ROUTE_INPUT_MIXED_DIRECT_AND_SELECTION' });
  });

  it('rejects missing direct or selection input', async () => {
    await expect(resolveRouteCanonicalBuildInput(nodeId, {}, createPorts())).rejects.toMatchObject({
      code: 'ROUTE_INPUT_MISSING_KIND',
    });
  });

  it('rejects internal resolved selection routes at the external boundary', async () => {
    await expect(
      resolveRouteCanonicalBuildInput(
        nodeId,
        {
          routeBuildInput: {
            kind: 'selection-driven',
            routes: [],
          },
        },
        createPorts()
      )
    ).rejects.toMatchObject({ code: 'ROUTE_INPUT_INVALID_SELECTION' });
  });

  it('rejects precomputed lineGeometry on direct-route external payloads', async () => {
    await expect(
      resolveRouteCanonicalBuildInput(
        nodeId,
        {
          routeBuildInput: { kind: 'direct-route' },
          startLocationId: 'location-a',
          endLocationId: 'location-b',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          lineGeometry: [
            [139, 35],
            [140, 36],
          ],
          routeMode: ROUTE_MODES.ROAD,
        },
        createPorts()
      )
    ).rejects.toMatchObject({ code: 'ROUTE_INPUT_INVALID_DIRECT_ROUTE' });
  });

  it('resolves direct-route external payloads from endpoint IDs and coordinates', async () => {
    await expect(
      resolveRouteCanonicalBuildInput(
        nodeId,
        {
          routeBuildInput: { kind: 'direct-route' },
          startLocationId: 'location-a',
          endLocationId: 'location-b',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          routeMode: ROUTE_MODES.WATERWAY,
        },
        createPorts()
      )
    ).resolves.toEqual({
      kind: 'direct-route',
      routes: [
        {
          startLocationId: 'location-a',
          endLocationId: 'location-b',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          routeMode: ROUTE_MODES.WATERWAY,
        },
      ],
    });
  });

  it('resolves selection-driven external payloads to completed internal input', async () => {
    await expect(
      resolveRouteCanonicalBuildInput(
        nodeId,
        {
          routeBuildInput: { kind: 'selection-driven' },
          tabularSourceId: 'route-table',
          selectedArrayByCountries: {
            JP: [false, false, false, false, true, false, false, false, false, true],
          },
        },
        createPorts()
      )
    ).resolves.toMatchObject({
      kind: 'selection-driven',
      routes: [
        {
          startLocationId: 'location-a',
          endLocationId: 'location-b',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          routeMode: 'road',
        },
      ],
    });
  });
});
