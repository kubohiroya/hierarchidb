// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../services/batch/types.js';
import type { UrlMetadata } from '../common/types/index.js';
import { getEphemeralShapeDB, closeEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import { encodeFlatGeoJson } from '../services/batch/strategies/flatgeobuf.js';
import { GadmDownloadStrategy } from '../services/batch/strategies/GadmDownloadStrategy.js';
import { NaturalEarthDownloadStrategy } from '../services/batch/strategies/NaturalEarthDownloadStrategy.js';

const createConfig = (dataSource: string): BatchProcessConfig => ({
  dataSource: dataSource as BatchProcessConfig['dataSource'],
  download: { concurrentDownloads: 1 },
  simplify1: {
    concurrentProcesses: 1,
    enableFeatureFiltering: true,
    featureAreaThreshold: 0,
    minVertexCountForAreaFilter: 0,
    aspectRatioThreshold: 0,
    featureFilterMethod: 'hybrid',
  },
  simplify2: {
    concurrentProcesses: 1,
    quantize: 1,
    simplify: 0.1,
    tolerance: 0.1,
    enablePerFeatureSimplification: true,
  },
  vectorTiles: {
    concurrentProcesses: 1,
    minZoom: 0,
    maxZoom: 1,
  },
});

const createUrlMetadata = (overrides: Partial<UrlMetadata>[]): UrlMetadata[] => (
  overrides.map((item, index) => ({
    url: `https://example.com/${index}`,
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    continent: 'Asia',
    dataSource: 'gadm',
    ...item,
  }))
);

describe('Download stage strategies', () => {
  const sessionId = 'session-1';
  const nodeId = 'node-1' as NodeId;
  let db: ReturnType<typeof getEphemeralShapeDB>;

  beforeEach(async () => {
    db = getEphemeralShapeDB();
    await db.clearAll();
  });

  afterEach(async () => {
    await db.clearAll();
    await closeEphemeralShapeDB();
  });

  it('GADM strategy keeps 1:1 mapping between download tasks and outputs', async () => {
    const strategy = new GadmDownloadStrategy();
    const urlMetadata = createUrlMetadata([
      { countryCode: 'JP', adminLevel: 0, dataSource: 'gadm' },
      { countryCode: 'ID', adminLevel: 1, dataSource: 'gadm' },
    ]);
    const tasks = await strategy.buildDownloadTasks({
      sessionId,
      nodeId,
      urlMetadata,
      config: createConfig('gadm'),
      options: {},
    });

    expect(tasks).toHaveLength(2);
    const postprocess = await strategy.postprocessDownloadOutputs({
      sessionId,
      nodeId,
      urlMetadata,
      config: createConfig('gadm'),
      options: {},
      downloadTasks: tasks,
    });
    expect(postprocess.outputs).toHaveLength(2);
    expect(postprocess.outputs[0]?.inputBufferId).toBe(`${sessionId}-download-0`);
    expect(postprocess.outputs[1]?.inputBufferId).toBe(`${sessionId}-download-1`);
  });

  it('NaturalEarth strategy groups download tasks by level and splits outputs by country', async () => {
    const strategy = new NaturalEarthDownloadStrategy();
    const urlMetadata = createUrlMetadata([
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 1, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 1, dataSource: 'naturalearth' },
    ]);
    const tasks = await strategy.buildDownloadTasks({
      sessionId,
      nodeId,
      urlMetadata,
      config: createConfig('naturalearth'),
      options: {},
    });
    expect(tasks).toHaveLength(2);

    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139.7, 35.6] }, properties: { ISO_A2: 'JP' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [106.8, -6.2] }, properties: { ISO_A2: 'ID' } },
    ];
    const collection = { type: 'FeatureCollection', features } as const;
    const encoded = await encodeFlatGeoJson(collection);
    await db.rawBuffers.put({
      id: `${sessionId}-download-0`,
      sessionId,
      nodeId,
      data: encoded,
      featureCount: features.length,
      bbox: [0, 0, 1, 1],
      downloadTime: Date.now(),
      size: encoded.byteLength,
      timestamp: Date.now(),
    });
    await db.rawBuffers.put({
      id: `${sessionId}-download-1`,
      sessionId,
      nodeId,
      data: encoded,
      featureCount: features.length,
      bbox: [0, 0, 1, 1],
      downloadTime: Date.now(),
      size: encoded.byteLength,
      timestamp: Date.now(),
    });

    const postprocess = await strategy.postprocessDownloadOutputs({
      sessionId,
      nodeId,
      urlMetadata,
      config: createConfig('naturalearth'),
      options: {},
      downloadTasks: tasks,
    });
    expect(postprocess.outputs.length).toBeGreaterThanOrEqual(4);
    const outputIds = new Set(postprocess.outputs.map((output) => output.inputBufferId));
    expect(outputIds.has(`${sessionId}-download-jp-adm0`)).toBe(true);
    expect(outputIds.has(`${sessionId}-download-id-adm0`)).toBe(true);
    expect(outputIds.has(`${sessionId}-download-jp-adm1`)).toBe(true);
    expect(outputIds.has(`${sessionId}-download-id-adm1`)).toBe(true);
  });
});
