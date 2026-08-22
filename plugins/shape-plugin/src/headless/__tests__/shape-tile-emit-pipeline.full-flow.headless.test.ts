// @vitest-environment node
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import type { SourceTaskPayload } from '../../common/types/index';

const nodeId = 'shape-full-flow-test-node' as NodeId;

// Enable this integration test with HDB_NETWORK_TESTS=1 to require real network access.
const shouldRunNetworkTests = process.env.HDB_NETWORK_TESTS === '1';
const describeNetwork = shouldRunNetworkTests ? describe : describe.skip;

const DATABASE_PREFIX = `test-shape-full-flow-${Math.random().toString(36).slice(2)}`;

let VtTaskQueueDb: typeof import('@hierarchidb/vt-orchestrator').VtTaskQueueDb;
let listTasksByStageAndStatus: typeof import('@hierarchidb/vt-orchestrator').listTasksByStageAndStatus;
let ephemeralDB: typeof import('@hierarchidb/gis-sdk').ephemeralDB;
let shapeDB: typeof import('@hierarchidb/shape-store').shapeDB;
let runShapePipeline: typeof import('../../services/vt/runShapePipeline.js').runShapePipeline;
let metadataLoader: typeof import('../../services/metadata/MetadataLoader.js').metadataLoader;
let resolveCountryCodeForDataSource: typeof import('../../services/utils/shapeBuildUtils.js').resolveCountryCodeForDataSource;

const buildConfig = {
  ...DEFAULT_BUILD_CONFIG,
  dataSourceName: 'geoboundaries',
  sourceConfig: {
    ...DEFAULT_BUILD_CONFIG.sourceConfig,
    maxConcurrent: 1,
    retryAttempts: 1,
    retryLimit: 1,
  },
  geometryConfig: {
    ...DEFAULT_BUILD_CONFIG.geometryConfig,
    maxConcurrent: 1,
    zoomBandBoundaries: [1, 2, 4],
  },
  tileEmitConfig: {
    ...DEFAULT_BUILD_CONFIG.tileEmitConfig,
    maxConcurrent: 1,
  },
  cleanupConfig: {
    ...DEFAULT_BUILD_CONFIG.cleanupConfig,
    deleteSourceApiCache: false,
    deleteSourceFilteredCache: false,
    deleteGeometryCache: false,
    deleteTileEmitCache: false,
  },
};

const selectGeoBoundariesPayload = async (): Promise<SourceTaskPayload> => {
  const metadata = await metadataLoader.loadMetadata('geoboundaries', nodeId);
  const candidate = metadata.find(
    (entry) =>
      entry.availableAdminLevels.includes(0) && (entry.iso3 || entry.countryCode || entry.iso2)
  );
  if (!candidate) {
    throw new Error('No GeoBoundaries metadata entry with admin level 0 found.');
  }
  const fallback = candidate.iso3 ?? candidate.countryCode ?? candidate.iso2 ?? '';
  const countryCode = resolveCountryCodeForDataSource('geoboundaries', candidate, fallback);
  return {
    url: `https://geoboundaries.org/api/current/gbOpen/${countryCode}/ADM0/`,
    countryCode,
    countryName: candidate.countryName,
    adminLevel: 0,
    dataSource: 'geoboundaries',
  };
};

const clearNodeArtifacts = async (): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  await taskQueue.delete();
  taskQueue.close();
};

describeNetwork('Shape full-flow pipeline', () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, '__HDB_DATABASE_PREFIX__', {
      configurable: true,
      value: DATABASE_PREFIX,
    });
    if (!VtTaskQueueDb) {
      ({ VtTaskQueueDb, listTasksByStageAndStatus } = await import('@hierarchidb/vt-orchestrator'));
      ({ ephemeralDB: ephemeralDB } = await import('@hierarchidb/gis-sdk'));
      ({ shapeDB } = await import('@hierarchidb/shape-store'));
      ({ runShapePipeline } = await import('../../services/vt/runShapePipeline'));
      ({ metadataLoader } = await import('../../services/metadata/MetadataLoader'));
      ({ resolveCountryCodeForDataSource } = await import('../../services/utils/shapeBuildUtils'));
    }
  });

  beforeEach(async () => {
    await clearNodeArtifacts();
  });

  afterEach(async () => {
    await clearNodeArtifacts();
  });

  it(
    'runs source/geometry/tileEmit with real data and persists outputs',
    { timeout: 300000 },
    async () => {
      const downloadTaskPayloads = [await selectGeoBoundariesPayload()];
      await runShapePipeline({
        nodeId,
        dataSource: 'geoboundaries',
        buildConfig,
        downloadTaskPayloads,
      });

      const taskQueue = new VtTaskQueueDb();
      const [failedSource, failedGeometry, failedTileEmit] = await Promise.all([
        listTasksByStageAndStatus(taskQueue, nodeId, 'source', 'failed'),
        listTasksByStageAndStatus(taskQueue, nodeId, 'geometry', 'failed'),
        listTasksByStageAndStatus(taskQueue, nodeId, 'tileEmit', 'failed'),
      ]);
      taskQueue.close();

      if (failedSource.length || failedGeometry.length || failedTileEmit.length) {
        const format = (tasks: typeof failedSource) =>
          tasks
            .map((task) => `${task.taskId}:${task.errorMessage ?? task.message ?? 'unknown'}`)
            .join('; ');
        throw new Error(
          `Pipeline failures: source=${failedSource.length} (${format(failedSource)}), ` +
            `geometry=${failedGeometry.length} (${format(failedGeometry)}), ` +
            `tileEmit=${failedTileEmit.length} (${format(failedTileEmit)})`
        );
      }

      const sourceCount = await ephemeralDB.sourceCache.where('nodeId').equals(nodeId).count();
      const geometryCount = await ephemeralDB.geometryCache.where('nodeId').equals(nodeId).count();
      const tileCount = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).count();
      const featureMetaCount = await shapeDB.featureMetadata.where('nodeId').equals(nodeId).count();
      const dataSourceMetaCount = await shapeDB.dataSourceMetadata
        .where('nodeId')
        .equals(nodeId)
        .count();
      const tileSample = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).first();

      expect(sourceCount).toBeGreaterThan(0);
      expect(geometryCount).toBeGreaterThan(0);
      expect(tileCount).toBeGreaterThan(0);
      expect(featureMetaCount).toBeGreaterThan(0);
      expect(dataSourceMetaCount).toBeGreaterThan(0);
      expect(tileSample?.layers?.length ?? 0).toBeGreaterThan(0);
      expect(tileSample?.data_Uint8Array?.length ?? 0).toBeGreaterThan(0);
    }
  );
});
