import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature } from '@hierarchidb/route-api';
import { createExportFileActionRunner } from '@hierarchidb/staged-folder-action/export-file-host';
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

  it('fails fast when route oneway metadata is not boolean', async () => {
    const materializeRows = createRouteExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'route-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ routeMode: 'airway' })),
      listRouteFeatures: vi.fn(async () => [
        createRoute({
          metadata: { oneway: 'true' } as unknown as RouteFeature['metadata'],
          featureId: 'route-invalid-oneway',
        }),
      ]),
    });

    await expect(materializeRows(createInput())).rejects.toThrow(
      /\[route export\] metadata\.oneway must be a boolean when present/
    );
  });

  it('exports Step2 local-file compatible CSV and XLSX with canonical route columns', async () => {
    const materializeRows = createRouteExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'route-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ routeMode: 'airway' })),
      listRouteFeatures: vi.fn(async () => [createRoute({ featureId: 'route-a' })]),
    });
    const writeFile = vi.fn(async () => {});
    const writeXlsx = vi.fn(async () => {});
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows,
      writeFile,
      writeXlsx,
    });

    await runner({
      ...createInput(),
      action: {
        type: 'export-csv',
        entityType: 'route',
        source: { path: 'routes/current' },
        output: { path: 'exports/routes.csv' },
      },
    });
    await runner(createInput());

    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/staged-action/exports/routes.csv',
      expect.stringMatching(new RegExp(`^${ROUTE_EXPORT_COLUMNS.join(',')}\\n`))
    );
    expect(writeXlsx).toHaveBeenCalledWith({
      path: '/tmp/staged-action/exports/routes.xlsx',
      sheetName: 'route',
      columns: ROUTE_EXPORT_COLUMNS,
      rows: [
        expect.objectContaining({
          featureId: 'route-a',
          oneway: true,
        }),
      ],
    });
  });

  it('keeps shared export host unsupported-column contract for route columns', async () => {
    const materializeRows = createRouteExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'route-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ routeMode: 'airway' })),
      listRouteFeatures: vi.fn(async () => [createRoute({ featureId: 'route-a' })]),
    });
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows,
      writeFile: vi.fn(async () => {}),
    });

    await expect(
      runner({
        ...createInput(),
        action: {
          ...createInput().action,
          columns: ['featureId', 'unknown'],
        },
      })
    ).rejects.toThrow(/action.columns contains unsupported columns: unknown/);
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
