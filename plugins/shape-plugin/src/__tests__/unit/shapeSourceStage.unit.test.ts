import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeFeaturePayload } from '../../common/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import type { CountryMetadata } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { listTasksByStageAndStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { ephemeralDB } from '@hierarchidb/gis-sdk';

const { mockFetchData, mockProcessData, mockPutFeatureMetadata } = vi.hoisted(() => ({
  mockFetchData: vi.fn(),
  mockProcessData: vi.fn(),
  mockPutFeatureMetadata: vi.fn(),
}));

vi.mock('../../services/datasources/DataSourceStrategyFactory.js', () => {
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

vi.mock('../../services/vt/fetchGeometryFilters.ts', () => ({
  filterFetchCollectionByZoom: (collection: { type: 'FeatureCollection'; features: unknown[] }) => ({
    ...collection,
    features: [],
  }),
}));

vi.mock('../../services/build/ShapeBuildAPIClient.ts', () => ({
  shapeMutationAPIImpl: {
    putFeatureMetadata: mockPutFeatureMetadata,
  },
}));

import { runShapeSourceStage } from '../../services/vt/shapeSourceStage';

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
    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
  },
  properties: {
    shapeName: 'Mock',
  },
};

describe('runShapeSourceStage message', () => {
  let db: VtTaskQueueDb | null = null;
  let nodeId: NodeId;

  beforeEach(() => {
    nodeId = `shape-source-stage-message-node-${Date.now()}-${Math.random()}` as NodeId;
    mockFetchData.mockReset();
    mockProcessData.mockReset();
    mockPutFeatureMetadata.mockReset();
    mockFetchData.mockResolvedValue({ ok: true });
    mockProcessData.mockResolvedValue([FEATURE_PAYLOAD]);
    mockPutFeatureMetadata.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (!db) return;
    await db.tasks.clear();
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
      downloadTaskPayloads: [{
        url: 'https://example.test/mock.geojson',
        countryCode: 'ID',
        adminLevel: 0,
        dataSource: 'geoboundaries',
      }],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    const completed = await listTasksByStageAndStatus(db, nodeId, 'source', 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.message).toBe(
      'features: 1 -> 0 (-100.0%), polygons: 1 -> 0 (-100.0%), vertices: 5 -> 0 (-100.0%)',
    );
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
      downloadTaskPayloads: [{
        url: 'https://example.test/mock.geojson',
        countryCode: 'ID',
        adminLevel: 0,
        dataSource: 'geoboundaries',
      }],
      resumeExistingTasks: false,
      failureHandling: 'continue',
    });

    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });
});
