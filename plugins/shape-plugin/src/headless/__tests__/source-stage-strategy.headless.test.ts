// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildProcessConfig } from '../../services/build/types';
import type { SourceTaskPayload } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/index';
//import { getShapeDbApiClient } from '../services/build/ShapeBuildApiClient.js';
import { encodeFlatGeoJson } from '../../services/build/strategies/flatgeobufUtils';
import { GadmSourceStageStrategy } from '../../services/build/strategies/GadmSourceStageStrategy';
import { GeoBoundariesSourceStageStrategy } from '../../services/build/strategies/GeoBoundariesSourceStageStrategy';
import { NaturalEarthDownloadStrategy } from '../../services/build/strategies/NaturalEarthDownloadStrategy';
import type { Feature, FeatureCollection } from 'geojson';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { metadataLoader } from '../../services/metadata/MetadataLoader';
import {
  buildRawDataDataSourceCacheKey,
  deleteRawDataDataSourceBuffersForNode,
  storeRawDataDataSourceBufferForNode,
} from '../../services/utils/chunkStore';

const createConfig = (dataSource: string): BuildProcessConfig => ({
  dataSource: dataSource as BuildProcessConfig['dataSource'],
  sourceConfig: {
    ...DEFAULT_BUILD_CONFIG.sourceConfig,
    maxConcurrent: 1,
  },
  geometryConfig: {
    ...DEFAULT_BUILD_CONFIG.geometryConfig,
    maxConcurrent: 1,
    featureAreaThreshold: 0,
    minVertexCountForAreaFilter: 0,
    aspectRatioThreshold: 0,
    areaThreshold: 0,
  },
  vectorTiles: {
    ...DEFAULT_BUILD_CONFIG.tileEmitConfig,
    maxConcurrent: 1,
  },
});

const createFetchTaskPayload = (overrides: Partial<SourceTaskPayload>[]): SourceTaskPayload[] => (
  overrides.map((item, index) => ({
    url: `https://example.com/${index}`,
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    dataSource: 'gadm',
    ...item,
  }))
);

describe('Source stage strategies', () => {
  const nodeId = 'node-1' as NodeId;

  beforeEach(async () => {
    await ephemeralDB.clearAll();
    await deleteRawDataDataSourceBuffersForNode(nodeId);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await ephemeralDB.clearAll();
    await deleteRawDataDataSourceBuffersForNode(nodeId);
  });

  it('GADM strategy keeps 1:1 mapping between source tasks and outputs', async () => {
    const strategy = new GadmSourceStageStrategy();
    const sourceTaskPayloads = createFetchTaskPayload([
      { countryCode: 'JP', adminLevel: 0, dataSource: 'gadm' },
      { countryCode: 'ID', adminLevel: 1, dataSource: 'gadm' },
    ]);
    const { tasks, inputsByTaskId } = await strategy.buildSourceTasks({
      nodeId,
      sourceTaskPayloads,
      config: createConfig('gadm'),
      options: {},
    });

    expect(tasks).toHaveLength(2);
    const postprocess = await strategy.buildPostprocessOutputs({
      nodeId,
      sourceTaskPayloads,
      config: createConfig('gadm'),
      options: {},
      sourceTasks: tasks,
      sourceTaskInputsById: inputsByTaskId,
    });
    expect(postprocess.outputs).toHaveLength(2);
    expect(postprocess.outputs[0]?.inputBufferId).toBe(
      buildRawDataDataSourceCacheKey({
        dataSource: 'gadm',
        countryCode: 'JP',
        adminLevel: 0,
        url: sourceTaskPayloads[0]?.url,
      }),
    );
    expect(postprocess.outputs[1]?.inputBufferId).toBe(
      buildRawDataDataSourceCacheKey({
        dataSource: 'gadm',
        countryCode: 'ID',
        adminLevel: 1,
        url: sourceTaskPayloads[1]?.url,
      }),
    );
  });

  it('GeoBoundaries strategy keeps 1:1 mapping between source tasks and outputs', async () => {
    const strategy = new GeoBoundariesSourceStageStrategy();
    const sourceTaskPayloads = createFetchTaskPayload([
      { countryCode: 'JP', adminLevel: 0, dataSource: 'geoboundaries' },
      { countryCode: 'ID', adminLevel: 1, dataSource: 'geoboundaries' },
    ]);
    const { tasks, inputsByTaskId } = await strategy.buildSourceTasks({
      nodeId,
      sourceTaskPayloads,
      config: createConfig('geoboundaries'),
      options: {},
    });

    expect(tasks).toHaveLength(2);
    const postprocess = await strategy.buildPostprocessOutputs({
      nodeId,
      sourceTaskPayloads,
      config: createConfig('geoboundaries'),
      options: {},
      sourceTasks: tasks,
      sourceTaskInputsById: inputsByTaskId,
    });
    expect(postprocess.outputs).toHaveLength(2);
    expect(postprocess.outputs[0]?.inputBufferId).toBe(
      buildRawDataDataSourceCacheKey({
        dataSource: 'geoboundaries',
        countryCode: 'JP',
        adminLevel: 0,
        url: sourceTaskPayloads[0]?.url,
      }),
    );
    expect(postprocess.outputs[1]?.inputBufferId).toBe(
      buildRawDataDataSourceCacheKey({
        dataSource: 'geoboundaries',
        countryCode: 'ID',
        adminLevel: 1,
        url: sourceTaskPayloads[1]?.url,
      }),
    );
  });

  it('NaturalEarth strategy groups source tasks by level and splits outputs by country', async () => {
    const strategy = new NaturalEarthDownloadStrategy();
    const sourceTaskPayloads = createFetchTaskPayload([
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 0, dataSource: 'naturalearth' },
      { countryCode: 'JP', countryName: 'Japan', adminLevel: 1, dataSource: 'naturalearth' },
      { countryCode: 'ID', countryName: 'Indonesia', adminLevel: 1, dataSource: 'naturalearth' },
    ]);
    const { tasks, inputsByTaskId } = await strategy.buildSourceTasks({
      nodeId,
      sourceTaskPayloads,
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
    const [taskAdm0, taskAdm1] = tasks;
    const sourceKeyAdm0 = buildRawDataDataSourceCacheKey({
      dataSource: 'naturalearth',
      adminLevel: taskAdm0?.adminLevel ?? 0,
      url: taskAdm0?.url ?? '',
    });
    const sourceKeyAdm1 = buildRawDataDataSourceCacheKey({
      dataSource: 'naturalearth',
      adminLevel: taskAdm1?.adminLevel ?? 1,
      url: taskAdm1?.url ?? '',
    });
    await storeRawDataDataSourceBufferForNode({
      nodeId,
      cacheKey: sourceKeyAdm0,
      buffer: encoded,
    });
    await storeRawDataDataSourceBufferForNode({
      nodeId,
      cacheKey: sourceKeyAdm1,
      buffer: encoded,
    });
    const getCountriesMetadataSpy = vi.spyOn(metadataLoader, 'getCountriesMetadata').mockResolvedValue([
      {
        countryCode: 'JP',
        countryName: 'Japan',
        continent: 'Asia',
        availableAdminLevels: [0, 1],
        iso2: 'JP',
        iso3: 'JPN',
      },
      {
        countryCode: 'ID',
        countryName: 'Indonesia',
        continent: 'Asia',
        availableAdminLevels: [0, 1],
        iso2: 'ID',
        iso3: 'IDN',
      },
    ]);

    const postprocess = await strategy.buildPostprocessOutputs({
      nodeId,
      sourceTaskPayloads,
      config: createConfig('naturalearth'),
      options: {},
      sourceTasks: tasks,
      sourceTaskInputsById: inputsByTaskId,
    });
    expect(postprocess.outputs.length).toBeGreaterThanOrEqual(4);
    const outputIds = new Set(postprocess.outputs.map((output) => output.inputBufferId));
    const [taskAdm0ForVerify, taskAdm1ForVerify] = tasks;
    expect(taskAdm0ForVerify).toBeDefined();
    expect(taskAdm1ForVerify).toBeDefined();
    expect(getCountriesMetadataSpy).toHaveBeenCalledTimes(1);
    expect(
      outputIds.has(
        buildRawDataDataSourceCacheKey({
          dataSource: 'naturalearth',
          countryCode: 'JP',
          adminLevel: 0,
          url: taskAdm0ForVerify?.url,
        }),
      ),
    ).toBe(true);
    expect(
      outputIds.has(
        buildRawDataDataSourceCacheKey({
          dataSource: 'naturalearth',
          countryCode: 'ID',
          adminLevel: 0,
          url: taskAdm0ForVerify?.url,
        }),
      ),
    ).toBe(true);
    expect(
      outputIds.has(
        buildRawDataDataSourceCacheKey({
          dataSource: 'naturalearth',
          countryCode: 'JP',
          adminLevel: 1,
          url: taskAdm1ForVerify?.url,
        }),
      ),
    ).toBe(true);
    expect(
      outputIds.has(
        buildRawDataDataSourceCacheKey({
          dataSource: 'naturalearth',
          countryCode: 'ID',
          adminLevel: 1,
          url: taskAdm1ForVerify?.url,
        }),
      ),
    ).toBe(true);
  }, 30_000);
});
