import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature } from '@hierarchidb/route-api';
import { describe, expect, it, vi } from 'vitest';
import {
  createRouteExportRowsMaterializer,
  ROUTE_EXPORT_COLUMNS,
} from '../../materializeRouteExportRows.js';

describe('createRouteExportRowsMaterializer', () => {
  it('materializes effective staged route features with canonical columns', async () => {
    const ports = {
      resolveSourceNodeId: vi.fn(async () => 'route-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ routeMode: 'airway' })),
      listRouteFeatures: vi.fn(async () => [
        createRoute({ featureId: 'route-b', name: 'Beta', routeMode: 'waterway' }),
        createRoute({ featureId: 'route-a', name: 'Alpha', routeMode: 'airway' }),
      ]),
    };
    const materializeRows = createRouteExportRowsMaterializer(ports);

    const result = await materializeRows(createInput());

    expect(ports.resolveSourceNodeId).toHaveBeenCalledWith('stage-root', 'routes/current');
    expect(ports.resolveEffectiveData).toHaveBeenCalledWith('route-node');
    expect(ports.listRouteFeatures).toHaveBeenCalledWith('route-node');
    expect(result.columns).toEqual(ROUTE_EXPORT_COLUMNS);
    expect(result.rows).toEqual([
      {
        featureId: 'route-a',
        name: 'Alpha',
        routeMode: 'airway',
        startLocationId: 'start-1',
        endLocationId: 'end-1',
        startLatitude: 35,
        startLongitude: 139,
        endLatitude: 36,
        endLongitude: 140,
        distance: 1200,
        speed: 80,
        oneway: true,
      },
      {
        featureId: 'route-b',
        name: 'Beta',
        routeMode: 'waterway',
        startLocationId: 'start-1',
        endLocationId: 'end-1',
        startLatitude: 35,
        startLongitude: 139,
        endLatitude: 36,
        endLongitude: 140,
        distance: 1200,
        speed: 80,
        oneway: true,
      },
    ]);
  });

  it('fails fast when route feature cells would contain invalid numbers', async () => {
    const materializeRows = createRouteExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'route-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ routeMode: 'airway' })),
      listRouteFeatures: vi.fn(async () => [
        createRoute({ distance: Number.POSITIVE_INFINITY, featureId: 'route-invalid' }),
      ]),
    });

    await expect(materializeRows(createInput())).rejects.toThrow(
      /\[route export\] distance must be a finite number/
    );
  });
});

const createInput = () => ({
  action: {
    type: 'export-xlsx' as const,
    entityType: 'route' as const,
    source: { path: 'routes/current' },
    output: { path: 'exports/routes.xlsx' },
  },
  actionIndex: 0,
  config: {
    version: 1 as const,
    staging: { mode: 'temporary-copy' as const, cleanup: 'retain' as const },
    overlay: { nodes: [] },
    actions: [],
  },
  stagingRootNodeId: 'stage-root' as NodeId,
  runId: 'run-1' as NodeId,
});

const createRoute = (override: Partial<RouteFeature> = {}): RouteFeature =>
  ({
    id: override.featureId ?? 'route-1',
    nodeId: 'route-node',
    featureId: 'route-1',
    name: 'Alpha',
    routeMode: 'airway',
    startLocationId: 'start-1',
    endLocationId: 'end-1',
    startPoint: { latitude: 35, longitude: 139 },
    endPoint: { latitude: 36, longitude: 140 },
    distance: 1200,
    speed: 80,
    metadata: { oneway: true },
    updatedAt: 100,
    ...override,
  }) as RouteFeature;
