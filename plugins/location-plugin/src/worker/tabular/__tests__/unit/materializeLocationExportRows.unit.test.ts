import type { NodeId } from '@hierarchidb/core-types';
import type { LocationPointId } from '@hierarchidb/location-api';
import { createExportFileActionRunner } from '@hierarchidb/staged-folder-action/export-file-host';
import { describe, expect, it, vi } from 'vitest';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import {
  createLocationExportRowsMaterializer,
  LOCATION_EXPORT_COLUMNS,
} from '../../materializeLocationExportRows.js';

describe('createLocationExportRowsMaterializer', () => {
  it('materializes effective staged location points with canonical columns', async () => {
    const ports = {
      resolveSourceNodeId: vi.fn(async () => 'location-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ dataSource: 'custom' })),
      listLocationPoints: vi.fn(async () => [
        createPoint({ pointId: 'point-b', name: 'Beta', admin0Code: 'US' }),
        createPoint({ pointId: 'point-a', name: 'Alpha', admin0Code: 'JP' }),
      ]),
    };
    const materializeRows = createLocationExportRowsMaterializer(ports);

    const result = await materializeRows(createInput());

    expect(ports.resolveSourceNodeId).toHaveBeenCalledWith('stage-root', 'locations/current');
    expect(ports.resolveEffectiveData).toHaveBeenCalledWith('location-node');
    expect(ports.listLocationPoints).toHaveBeenCalledWith('location-node');
    expect(result.columns).toEqual(LOCATION_EXPORT_COLUMNS);
    expect(result.rows).toEqual([
      {
        pointId: 'point-a',
        name: 'Alpha',
        type: 'airport',
        latitude: 35,
        longitude: 139,
        admin0Code: 'JP',
        admin0: 'Japan',
        admin1: 'Tokyo',
        admin2: undefined,
        renderRank: 1,
        importance: 0.9,
        iconKey: 'flight_takeoff',
        labelClass: 'major',
        minZoom: 3,
      },
      {
        pointId: 'point-b',
        name: 'Beta',
        type: 'airport',
        latitude: 35,
        longitude: 139,
        admin0Code: 'US',
        admin0: 'Japan',
        admin1: 'Tokyo',
        admin2: undefined,
        renderRank: 1,
        importance: 0.9,
        iconKey: 'flight_takeoff',
        labelClass: 'major',
        minZoom: 3,
      },
    ]);
  });

  it('fails fast when location point coordinates are invalid', async () => {
    const materializeRows = createLocationExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'location-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ dataSource: 'custom' })),
      listLocationPoints: vi.fn(async () => [
        createPoint({ latitude: Number.NaN, pointId: 'point-invalid' }),
      ]),
    });

    await expect(materializeRows(createInput())).rejects.toThrow(
      /\[location export\] latitude must be a finite number/
    );
  });

  it('keeps shared export host unsupported-column and unsafe-output contracts', async () => {
    const materializeRows = createLocationExportRowsMaterializer({
      resolveSourceNodeId: vi.fn(async () => 'location-node' as NodeId),
      resolveEffectiveData: vi.fn(async () => ({ dataSource: 'custom' })),
      listLocationPoints: vi.fn(async () => [createPoint({ pointId: 'point-a' })]),
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
          columns: ['name', 'unknown'],
        },
      })
    ).rejects.toThrow(/action.columns contains unsupported columns: unknown/);
    await expect(
      runner({
        ...createInput(),
        action: {
          ...createInput().action,
          output: { path: '../locations.csv' },
        },
      })
    ).rejects.toThrow(
      /outputPath must not contain empty, current-directory, or parent-directory segments/
    );
  });
});

const createInput = () => ({
  action: {
    type: 'export-csv' as const,
    entityType: 'location' as const,
    source: { path: 'locations/current' },
    output: { path: 'exports/locations.csv' },
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

const createPoint = (override: Partial<LocationPointProperties> = {}): LocationPointProperties => ({
  schemaVersion: 2,
  pointId: 'point-1' as LocationPointId,
  name: 'Alpha',
  latitude: 35,
  longitude: 139,
  type: 'airport',
  renderRank: 1,
  importance: 0.9,
  iconKey: 'flight_takeoff',
  labelClass: 'major',
  minZoom: 3,
  admin0Code: 'JP',
  admin0: 'Japan',
  admin1: 'Tokyo',
  ...override,
});
