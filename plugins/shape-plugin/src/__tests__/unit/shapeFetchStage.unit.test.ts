import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeFeaturePayload } from '../../common/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import type { CountryMetadata } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { listTasksByStageAndStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';

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

import { runShapeFetchStage } from '../../services/vt/shapeFetchStage';

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

describe('runShapeFetchStage message', () => {
  let db: VtTaskQueueDb | null = null;
  let nodeId: NodeId;

  beforeEach(() => {
    nodeId = `shape-fetch-stage-message-node-${Date.now()}-${Math.random()}` as NodeId;
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
    db = null;
  });

  it('uses reduction summary when fetch filter removes all features', async () => {
    db = createDb();

    await runShapeFetchStage({
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

    const completed = await listTasksByStageAndStatus(db, nodeId, 'fetch', 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.message).toBe(
      'features: 1 -> 0 (-100.0%), polygons: 1 -> 0 (-100.0%), vertices: 5 -> 0 (-100.0%)',
    );
  });
});
