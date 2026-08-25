import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { encodeFlatGeobufFromFeatureCollection, ephemeralDB } from '@hierarchidb/gis-sdk';
import { listTasksByStageAndStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import type { CountryMetadata } from '../../common/types/data-source.js';
import type { ShapeFeaturePayload } from '../../common/types/ShapeFeaturePayload.js';

const { mockFetchData, mockProcessData, mockPutFeatureMetadata, mockValidateBorderGeometry } =
  vi.hoisted(() => ({
    mockFetchData: vi.fn(),
    mockProcessData: vi.fn(),
    mockPutFeatureMetadata: vi.fn(),
    mockValidateBorderGeometry: vi.fn(),
  }));

vi.mock('~/services/datasources/DataSourceStrategyFactory', () => {
  class DataSourceStrategyFactory {
    create() {
      return {
        config: {
          processing: {
            filters: [],
            transformations: [],
          },
        },
        fetchData: mockFetchData,
        processData: mockProcessData,
      };
    }
  }
  return { DataSourceStrategyFactory };
});

vi.mock('~/services/vt/filterFetchCollectionByZoom.ts', () => ({
  filterFetchCollectionByZoom: (collection: {
    type: 'FeatureCollection';
    features: unknown[];
  }) => ({
    ...collection,
    features: [],
  }),
}));

vi.mock('~/services/build/ShapeBuildAPIClient', () => ({
  shapeMutationAPIImpl: {
    putFeatureMetadata: mockPutFeatureMetadata,
  },
}));

vi.mock('../../services/vt/validateShapeBorderGeometryPipeline.ts', () => ({
  validateShapeBorderGeometryPipeline: mockValidateBorderGeometry,
}));

import { runShapeSourceStage } from '../../services/vt/runShapeSourceStage';

const createDb = (): VtTaskQueueDb => new VtTaskQueueDb();

const METADATA: CountryMetadata = {
  countryCode: 'ID',
  countryName: 'Indonesia',
  continent: 'Asia',
  availableAdminLevels: [0],
  iso2: 'ID',
  iso3: 'IDN',
};

const FEATURE_PAYLOAD: ShapeFeaturePayload = {
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
  properties: {
    shapeName: 'Mock',
  },
};

describe('runShapeSourceStage message', () => {
  let db: VtTaskQueueDb | null = null;
  let nodeId: NodeId;

  beforeEach(async () => {
    if (!ephemeralDB.isOpen()) {
      await ephemeralDB.open();
    }
    nodeId = `shape-source-stage-message-node-${Date.now()}-${Math.random()}` as NodeId;
    mockFetchData.mockReset();
    mockProcessData.mockReset();
    mockPutFeatureMetadata.mockReset();
    mockValidateBorderGeometry.mockReset();
    mockFetchData.mockResolvedValue({ ok: true });
    mockProcessData.mockResolvedValue([FEATURE_PAYLOAD]);
    mockPutFeatureMetadata.mockResolvedValue(undefined);
    mockValidateBorderGeometry.mockResolvedValue({
      status: 'completed',
      dataset: {
        datasetId: 'dataset:test',
      },
      metrics: {
        arcCount: 0,
        ringCount: 0,
        polygonRelationCount: 0,
        reconstructedPolygonCount: 0,
        durationMs: 0,
      },
    });
  });

  afterEach(async () => {
    if (!db) return;
    if (!ephemeralDB.isOpen()) {
      await ephemeralDB.open();
    }
    await ephemeralDB.clearNodeData(nodeId);
    db = null;
  });

  it('uses reduction summary when source filter removes all features', async () => {
    db = createDb();

    await runShapeSourceStage({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig: DEFAULT_BUILD_CONFIG,
      taskQueue: db,
      metadata: [METADATA],
      downloadTaskPayloads: [
        {
          url: 'https://example.test/mock.geojson',
          countryCode: 'ID',
          adminLevel: 0,
          dataSource: 'geoboundaries',
        },
      ],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    const completed = await listTasksByStageAndStatus(db, nodeId, 'source', 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.message).toBe(
      'features: 1 -> 0 (-100.0%), polygons: 1 -> 0 (-100.0%), vertices: 5 -> 0 (-100.0%)'
    );
  });

  it('treats empty filtered source as border geometry no-op completed', async () => {
    db = createDb();

    await runShapeSourceStage({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig: {
        ...DEFAULT_BUILD_CONFIG,
        borderGeometryConfig: {
          enabled: true,
          simplifyTolerance: 0,
        },
      },
      taskQueue: db,
      metadata: [METADATA],
      downloadTaskPayloads: [
        {
          url: 'https://example.test/mock.geojson',
          countryCode: 'ID',
          adminLevel: 0,
          dataSource: 'geoboundaries',
        },
      ],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    const completed = await listTasksByStageAndStatus(db, nodeId, 'source', 'completed');
    expect(completed).toHaveLength(1);
    expect(mockValidateBorderGeometry).not.toHaveBeenCalled();
    expect(completed[0]?.metadata).toMatchObject({
      borderGeometry: {
        status: 'completed',
        reason: 'empty-feature-collection',
        arcCount: 0,
        ringCount: 0,
        polygonRelationCount: 0,
        reconstructedPolygonCount: 0,
        durationMs: 0,
      },
    });
  });

  it('re-fetches source data when existing filtered cache is marked rawCacheInvalidated', async () => {
    db = createDb();
    const sourceKey = 'ID:0';
    const cacheId = `${String(nodeId)}-shape-${sourceKey}`;

    // Phase 1: Write with timestamp: 0
    await ephemeralDB.sourceCache.put({
      id: cacheId,
      nodeId,
      domainType: 'shape',
      sourceKey,
      countryCode: 'ID',
      adminLevel: 0,
      data: new ArrayBuffer(0),
      format: 'flatgeobuf',
      compression: 'none',
      featureCount: 0,
      inputFeatureCount: 0,
      bbox: [0, 0, 0, 0],
      downloadTime: 0,
      size: 0,
      vertexCount: 0,
      polygonCount: 0,
      inputVertexCount: 0,
      inputPolygonCount: 0,
      metadata: {
        rawCacheInvalidated: true,
      },
      contentHash: 'seed-cache',
      timestamp: 0,
    });

    // Phase 2: Mark write complete
    await ephemeralDB.sourceCache.update(cacheId, { timestamp: Date.now() });

    await runShapeSourceStage({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig: DEFAULT_BUILD_CONFIG,
      taskQueue: db,
      metadata: [METADATA],
      downloadTaskPayloads: [
        {
          url: 'https://example.test/mock.geojson',
          countryCode: 'ID',
          adminLevel: 0,
          dataSource: 'geoboundaries',
        },
      ],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });

  it('runs border geometry validation when reusing source cache and the option is enabled', async () => {
    db = createDb();
    const sourceKey = 'ID:0';
    const cacheId = `${String(nodeId)}-shape-${sourceKey}`;
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'feature-1',
          properties: {
            __hdbFeatureId: 'feature-1',
            shapeName: 'Cached',
          },
          geometry: FEATURE_PAYLOAD.geometry,
        },
      ],
    } as const;
    const data = await encodeFlatGeobufFromFeatureCollection(featureCollection);

    await ephemeralDB.sourceCache.put({
      id: cacheId,
      nodeId,
      domainType: 'shape',
      sourceKey,
      countryCode: 'ID',
      adminLevel: 0,
      data,
      format: 'flatgeobuf',
      compression: 'none',
      featureCount: 1,
      inputFeatureCount: 1,
      bbox: [0, 0, 0, 0],
      downloadTime: 0,
      size: data.byteLength,
      vertexCount: 5,
      polygonCount: 1,
      inputVertexCount: 5,
      inputPolygonCount: 1,
      metadata: {
        status: 'completed',
      },
      contentHash: 'seed-cache',
      timestamp: Date.now(),
    });

    await runShapeSourceStage({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig: {
        ...DEFAULT_BUILD_CONFIG,
        borderGeometryConfig: {
          enabled: true,
          simplifyTolerance: 0,
        },
      },
      taskQueue: db,
      metadata: [METADATA],
      downloadTaskPayloads: [
        {
          url: 'https://example.test/mock.geojson',
          countryCode: 'ID',
          adminLevel: 0,
          dataSource: 'geoboundaries',
        },
      ],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    expect(mockFetchData).not.toHaveBeenCalled();
    expect(mockValidateBorderGeometry).toHaveBeenCalledTimes(1);
    expect(mockValidateBorderGeometry.mock.calls[0]?.[0]).toMatchObject({
      nodeId,
      sourceKey,
      outputArtifactIdPrefix: `${cacheId}:border-geometry`,
      simplifyTolerance: 0,
    });
    expect(mockValidateBorderGeometry.mock.calls[0]?.[0]?.featureCollection.features).toHaveLength(
      1
    );
  }, 10_000);

  it('treats empty reused source cache as border geometry no-op completed', async () => {
    db = createDb();
    const sourceKey = 'ID:0';
    const cacheId = `${String(nodeId)}-shape-${sourceKey}`;

    await ephemeralDB.sourceCache.put({
      id: cacheId,
      nodeId,
      domainType: 'shape',
      sourceKey,
      countryCode: 'ID',
      adminLevel: 0,
      data: new ArrayBuffer(0),
      format: 'flatgeobuf',
      compression: 'none',
      featureCount: 0,
      inputFeatureCount: 0,
      bbox: [0, 0, 0, 0],
      downloadTime: 0,
      size: 0,
      vertexCount: 0,
      polygonCount: 0,
      inputVertexCount: 0,
      inputPolygonCount: 0,
      metadata: {
        status: 'completed',
      },
      contentHash: 'seed-empty-cache',
      timestamp: Date.now(),
    });

    await runShapeSourceStage({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig: {
        ...DEFAULT_BUILD_CONFIG,
        borderGeometryConfig: {
          enabled: true,
          simplifyTolerance: 0,
        },
      },
      taskQueue: db,
      metadata: [METADATA],
      downloadTaskPayloads: [
        {
          url: 'https://example.test/mock.geojson',
          countryCode: 'ID',
          adminLevel: 0,
          dataSource: 'geoboundaries',
        },
      ],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    const completed = await listTasksByStageAndStatus(db, nodeId, 'source', 'completed');
    expect(completed).toHaveLength(1);
    expect(mockValidateBorderGeometry).not.toHaveBeenCalled();
    expect(completed[0]?.metadata).toMatchObject({
      borderGeometry: {
        status: 'completed',
        reason: 'empty-feature-collection',
        arcCount: 0,
        ringCount: 0,
        polygonRelationCount: 0,
        reconstructedPolygonCount: 0,
        durationMs: 0,
      },
    });
  });
});
