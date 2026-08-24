import { describe, expect, it, vi } from 'vitest';
import {
  createExportCsvText,
  createExportFileActionRunner,
  resolveExportOutputPath,
  resolveExportXlsxSheetName,
} from '../createExportFileActionRunner.js';
import type { StagedFolderActionConfig } from '../StagedFolderActionManifestTypes.js';

describe('createExportFileActionRunner', () => {
  it('writes CSV with deterministic columns and escaped cells', async () => {
    const writeFile = vi.fn(async () => {});
    const ensureDirectory = vi.fn(async () => {});
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows: async () => ({
        columns: ['name', 'lat', 'active'],
        rows: [
          { name: 'Tokyo, Japan', lat: 35.6812 },
          { name: 'Quote "Station"', lat: 34.9858, active: true },
        ],
      }),
      writeFile,
      ensureDirectory,
    });

    const result = await runner({
      action: {
        type: 'export-csv',
        entityType: 'location',
        source: { path: '.' },
        output: { path: 'exports/locations.csv' },
      },
      actionIndex: 0,
      config: createConfig(),
      stagingRootNodeId: 'stage-1',
      runId: 'run-1',
    });

    expect(ensureDirectory).toHaveBeenCalledWith('/tmp/staged-action/exports');
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/staged-action/exports/locations.csv',
      'name,lat,active\n"Tokyo, Japan",35.6812,\n"Quote ""Station""",34.9858,true'
    );
    expect(result).toEqual({
      type: 'export-csv',
      status: 'completed',
      outputPath: '/tmp/staged-action/exports/locations.csv',
      entityType: 'location',
      rowCount: 2,
    });
  });

  it('passes XLSX rows and the stable default sheet name to the writer port', async () => {
    const writeXlsx = vi.fn(async () => {});
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows: async () => ({
        columns: ['route_id', 'distance'],
        rows: [{ route_id: 'route-1', distance: 12.5 }],
      }),
      writeFile: vi.fn(async () => {}),
      writeXlsx,
    });

    const result = await runner({
      action: {
        type: 'export-xlsx',
        entityType: 'route',
        source: { path: '.' },
        output: { path: 'routes.xlsx' },
        columns: ['route_id', 'distance'],
      },
      actionIndex: 1,
      config: createConfig(),
      stagingRootNodeId: 'stage-1',
      runId: 'run-1',
    });

    expect(writeXlsx).toHaveBeenCalledWith({
      path: '/tmp/staged-action/routes.xlsx',
      sheetName: 'route',
      columns: ['route_id', 'distance'],
      rows: [{ route_id: 'route-1', distance: 12.5 }],
    });
    expect(result).toEqual({
      type: 'export-xlsx',
      status: 'completed',
      outputPath: '/tmp/staged-action/routes.xlsx',
      entityType: 'route',
      rowCount: 1,
      sheetName: 'route',
    });
  });

  it('fails fast for invalid row cell values', async () => {
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows: async () => ({
        columns: ['name'],
        rows: [{ name: ['Tokyo'] as unknown as string }],
      }),
      writeFile: vi.fn(async () => {}),
    });

    await expect(
      runner({
        action: {
          type: 'export-csv',
          entityType: 'location',
          source: { path: '.' },
          output: { path: 'locations.csv' },
        },
        actionIndex: 0,
        config: createConfig(),
        stagingRootNodeId: 'stage-1',
        runId: 'run-1',
      })
    ).rejects.toThrow(
      /export rows\[0\]\.name must be a string, finite number, boolean, null, or undefined/
    );
  });

  it('fails fast when XLSX is requested without a writer port', async () => {
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows: async () => ({
        columns: ['name'],
        rows: [],
      }),
      writeFile: vi.fn(async () => {}),
    });

    await expect(
      runner({
        action: {
          type: 'export-xlsx',
          entityType: 'location',
          source: { path: '.' },
          output: { path: 'locations.xlsx' },
          columns: ['name'],
        },
        actionIndex: 0,
        config: createConfig(),
        stagingRootNodeId: 'stage-1',
        runId: 'run-1',
      })
    ).rejects.toThrow(/export-xlsx writer is not configured/);
  });

  it('resolves relative paths from the configured output base path', () => {
    expect(
      resolveExportOutputPath({
        outputBasePath: '/tmp/staged-action',
        outputPath: 'exports/locations.csv',
      })
    ).toBe('/tmp/staged-action/exports/locations.csv');
  });

  it('rejects absolute output paths', () => {
    expect(() =>
      resolveExportOutputPath({
        outputBasePath: '/tmp/staged-action',
        outputPath: '/tmp/locations.csv',
      })
    ).toThrow(/outputPath must be relative to outputBasePath/);
  });

  it('rejects parent-directory output paths', () => {
    expect(() =>
      resolveExportOutputPath({
        outputBasePath: '/tmp/staged-action',
        outputPath: '../locations.csv',
      })
    ).toThrow(/outputPath must not contain empty, current-directory, or parent-directory segments/);
  });

  it('rejects unsupported requested columns outside the adapter canonical columns', async () => {
    const runner = createExportFileActionRunner({
      outputBasePath: '/tmp/staged-action',
      materializeRows: async () => ({
        columns: ['name'],
        rows: [{ name: 'Tokyo' }],
      }),
      writeFile: vi.fn(async () => {}),
    });

    await expect(
      runner({
        action: {
          type: 'export-csv',
          entityType: 'location',
          source: { path: '.' },
          output: { path: 'locations.csv' },
          columns: ['name', 'unknown'],
        },
        actionIndex: 0,
        config: createConfig(),
        stagingRootNodeId: 'stage-1',
        runId: 'run-1',
      })
    ).rejects.toThrow(/action.columns contains unsupported columns: unknown/);
  });

  it('rejects duplicate columns', () => {
    expect(() =>
      createExportCsvText({
        columns: ['name', 'name'],
        rows: [],
      })
    ).toThrow(/columns must not contain duplicate columns/);
  });

  it('rejects empty column sets', () => {
    expect(() =>
      createExportCsvText({
        columns: [],
        rows: [],
      })
    ).toThrow(/columns must contain at least one column/);
  });

  it('uses entityType as the default XLSX sheet name', () => {
    expect(
      resolveExportXlsxSheetName({
        type: 'export-xlsx',
        entityType: 'location',
        source: { path: '.' },
        output: { path: 'locations.xlsx' },
      })
    ).toBe('location');
  });
});

const createConfig = (): StagedFolderActionConfig => ({
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'retain',
  },
  overlay: {
    nodes: [],
  },
  actions: [],
});
