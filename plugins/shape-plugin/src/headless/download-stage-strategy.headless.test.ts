// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../services/batch/types.js';
import type { FetchTaskPayload } from '../common/types/index.js';
//import { getShapeDbApiClient } from '../services/batch/ShapeBuildApiClient.js';
import { encodeFlatGeoJson } from '../services/batch/strategies/flatgeobuf.js';
import { GadmFetchStageStrategy } from '../services/batch/strategies/GadmFetchStageStrategy.js';
import { NaturalEarthDownloadStrategy } from '../services/batch/strategies/NaturalEarthDownloadStrategy.js';
import type { Feature, FeatureCollection } from 'geojson';
import {ephemeralShapeDB} from '@hierarchidb/shape-store';

const createConfig = (dataSource: string): BatchProcessConfig => ({
  dataSource: dataSource as BatchProcessConfig['dataSource'],
  download: { concurrentDownloads: 1 },
  extract1: {
    concurrentProcesses: 1,
    enableFeatureFiltering: true,
    featureAreaThreshold: 0,
    minVertexCountForAreaFilter: 0,
    aspectRatioThreshold: 0,
    featureFilterMethod: 'hybrid',
  },
  extract2: {
    concurrentProcesses: 1,
    quantize: 1,
    extract: 0.1,
    tolerance: 0.1,
    enablePerFeatureExtraction: true,
  },
  vectorTiles: {
    concurrentProcesses: 1,
  },
});

const createDownloadTaskPayload = (overrides: Partial<FetchTaskPayload>[]): FetchTaskPayload[] => (
  overrides.map((item, index) => ({
    url: `https://example.com/${index}`,
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    dataSource: 'gadm',
    ...item,
  }))
);

describe('Download stage strategies', () => {
  const nodeId = 'node-1' as NodeId;

  beforeEach(async () => {
    await ephemeralShapeDB.clearAll();
  });

  afterEach(async () => {
    await ephemeralShapeDB.clearAll();
  });

  it('GADM strategy keeps 1:1 mapping between download tasks and outputs', async () => {
    const strategy = new GadmFetchStageStrategy();
    const downloadTaskPayloads = createDownloadTaskPayload([
      { countryCode: 'JP', adminLevel: 0, dataSource: 'gadm' },
      { countryCode: 'ID', adminLevel: 1, dataSource: 'gadm' },
    ]);
    const { tasks, inputsByTaskId } = await strategy.buildFetchTasks({
      nodeId,
      fetchTaskPayloads: downloadTaskPayloads,
      config: createConfig('gadm'),
      options: {},
    });

    expect(tasks).toHaveLength(2);
    const postprocess = await strategy.buildPostprocessOutputs({
      nodeId,
      fetchTaskPayloads: downloadTaskPayloads,
      config: createConfig('gadm'),
      options: {},
      fetchTask: tasks,
      fetchTaskInputsById: inputsByTaskId,
    });
    expect(postprocess.outputs).toHaveLength(2);
    expect(postprocess.outputs[0]?.inputBufferId).toBe(`${nodeId}-download-0`);
    expect(postprocess.outputs[1]?.inputBufferId).toBe(`${nodeId}-download-1`);
  });

  it.skip('NaturalEarth strategy groups download tasks by level and splits outputs by country', async () => {
    const strategy = new NaturalEarthDownloadStrategy();
    const downloadTaskPayloads = createDownloadTaskPayload([
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 1, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 1, dataSource: 'naturalearth' },
    ]);
    const { tasks, inputsByTaskId } = await strategy.buildFetchTasks({
      nodeId,
      fetchTaskPayloads: downloadTaskPayloads,
      config: createConfig('naturalearth'),
      options: {},
    });
    expect(tasks).toHaveLength(2);

    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [139.7, 35.6] }, properties: { ISO_A2: 'JP' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [106.8, -6.2] }, properties: { ISO_A2: 'ID' } },
    ] satisfies Feature[];
    const collection = { type: 'FeatureCollection', features } satisfies FeatureCollection;
    const encoded = await encodeFlatGeoJson(collection);
    const bufferId0 = `${nodeId}-download-0`;
    const bufferId1 = `${nodeId}-download-1`;
    await ephemeralShapeDB.fetchBuffers.put({
      id: bufferId0,
      nodeId,
      data: encoded,
      featureCount: features.length,
      bbox: [0, 0, 1, 1],
      downloadTime: Date.now(),
      size: encoded.byteLength,
      timestamp: Date.now(),
    });
    ephemeralShapeDB.fetchBuffers.put({
      id: bufferId1,
      nodeId,
      data: encoded,
      featureCount: features.length,
      bbox: [0, 0, 1, 1],
      downloadTime: Date.now(),
      size: encoded.byteLength,
      timestamp: Date.now(),
    });

    const postprocess = await strategy.buildPostprocessOutputs({
      nodeId,
      fetchTaskPayloads: downloadTaskPayloads,
      config: createConfig('naturalearth'),
      options: {},
      fetchTask: tasks,
      fetchTaskInputsById: inputsByTaskId,
    });
    expect(postprocess.outputs.length).toBeGreaterThanOrEqual(4);
    const outputIds = new Set(postprocess.outputs.map((output) => output.inputBufferId));
    expect(outputIds.has(`${nodeId}-download-jp-adm0`)).toBe(true);
    expect(outputIds.has(`${nodeId}-download-id-adm0`)).toBe(true);
    expect(outputIds.has(`${nodeId}-download-jp-adm1`)).toBe(true);
    expect(outputIds.has(`${nodeId}-download-id-adm1`)).toBe(true);
  }, 30_000);
});
