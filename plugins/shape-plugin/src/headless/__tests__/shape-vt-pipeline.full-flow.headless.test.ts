// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { VtTaskQueueDb, deleteTasksByNode, listTasksByStageAndStatus } from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { runShapeVtPipeline } from '../../services/vt/shapeVtPipeline.js';
import { shapeMutationAPIImpl } from '../../services/batch/ShapeBuildAPIClient.ts';
import { metadataLoader } from '../../services/metadata/MetadataLoader.js';
import { resolveCountryCodeForDataSource } from '../../services/utils/utils.js';
import type { FetchTaskPayload } from '../../common/types/index.js';

const nodeId = 'shape-full-flow-test-node' as NodeId;

const buildConfig = {
  ...DEFAULT_BUILD_CONFIG,
  fetchConfig: {
    ...DEFAULT_BUILD_CONFIG.fetchConfig,
    maxConcurrent: 1,
    retryAttempts: 1,
    retryLimit: 1,
  },
  transformConfig: {
    ...DEFAULT_BUILD_CONFIG.transformConfig,
    maxConcurrent: 1,
    zoomBandBoundaries: [0, 4],
  },
  vtConfig: {
    ...DEFAULT_BUILD_CONFIG.vtConfig,
    maxConcurrent: 1,
  },
  cleanupConfig: {
    ...DEFAULT_BUILD_CONFIG.cleanupConfig,
    deleteFetchCeche: false,
    deleteTransformCache: false,
    deleteVTCache: false,
  },
};

const selectGeoBoundariesPayload = async (): Promise<FetchTaskPayload> => {
  const metadata = await metadataLoader.loadMetadata('geoboundaries', nodeId);
  const candidate = metadata.find((entry) => (
    entry.availableAdminLevels.includes(0)
    && (entry.iso3 || entry.countryCode || entry.iso2)
  ));
  if (!candidate) {
    throw new Error('No GeoBoundaries metadata entry with admin level 0 found.');
  }
  const fallback = candidate.iso3 ?? candidate.countryCode ?? candidate.iso2 ?? '';
  const countryCode = resolveCountryCodeForDataSource('geoboundaries', candidate, fallback);
  return {
    url: `https://www.geoboundaries.org/api/current/gbOpen/${countryCode}/ADM0/`,
    countryCode,
    countryName: candidate.countryName,
    adminLevel: 0,
    dataSource: 'geoboundaries',
  };
};

const clearNodeArtifacts = async (): Promise<void> => {
  await shapeMutationAPIImpl.clearShapeArtifacts(nodeId);
  await shapeDB.featureMetadata.where('nodeId').equals(nodeId).delete();
  await shapeDB.sourceMetadata.where('nodeId').equals(nodeId).delete();
  await shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete();
  await ephemeralShapeDB.clearNodeData(nodeId);
  const taskQueue = new VtTaskQueueDb();
  await deleteTasksByNode(taskQueue, nodeId);
  taskQueue.close();
};

describe('Shape full-flow pipeline', () => {
  beforeEach(async () => {
    await clearNodeArtifacts();
  });

  afterEach(async () => {
    await clearNodeArtifacts();
  });

  it('runs fetch/transform/vt with real data and persists outputs', async () => {
    const downloadTaskPayloads = [await selectGeoBoundariesPayload()];
    await runShapeVtPipeline({
      nodeId,
      dataSource: 'geoboundaries',
      buildConfig,
      downloadTaskPayloads,
    });

    const taskQueue = new VtTaskQueueDb();
    const [failedFetch, failedTransform, failedVt] = await Promise.all([
      listTasksByStageAndStatus(taskQueue, nodeId, 'fetch', 'failed'),
      listTasksByStageAndStatus(taskQueue, nodeId, 'transform', 'failed'),
      listTasksByStageAndStatus(taskQueue, nodeId, 'vt', 'failed'),
    ]);
    taskQueue.close();

    if (failedFetch.length || failedTransform.length || failedVt.length) {
      const format = (tasks: typeof failedFetch) => (
        tasks.map((task) => `${task.taskId}:${task.errorMessage ?? task.message ?? 'unknown'}`).join('; ')
      );
      throw new Error(
        `Pipeline failures: fetch=${failedFetch.length} (${format(failedFetch)}), `
        + `transform=${failedTransform.length} (${format(failedTransform)}), `
        + `vt=${failedVt.length} (${format(failedVt)})`,
      );
    }

    const fetchCount = await ephemeralShapeDB.fetchCache.where('nodeId').equals(nodeId).count();
    const transformCount = await ephemeralShapeDB.transformCache.where('nodeId').equals(nodeId).count();
    const tileCount = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).count();
    const featureMetaCount = await shapeDB.featureMetadata.where('nodeId').equals(nodeId).count();
    const sourceMetaCount = await shapeDB.sourceMetadata.where('nodeId').equals(nodeId).count();

    expect(fetchCount).toBeGreaterThan(0);
    expect(transformCount).toBeGreaterThan(0);
    expect(tileCount).toBeGreaterThan(0);
    expect(featureMetaCount).toBeGreaterThan(0);
    expect(sourceMetaCount).toBeGreaterThan(0);
  }, { timeout: 300000 });
});
