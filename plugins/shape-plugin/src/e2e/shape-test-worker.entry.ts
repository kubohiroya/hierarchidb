// Test-only worker entry that exposes Shape APIs over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import type { BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { CountryMetadata, FetchTaskPayload, SelectedArrayByCountries, ShapeBuildConfig } from '../common/types/index.js';
import type { Endpoint as ComlinkEndpoint } from 'comlink';
import { expose, proxy } from 'comlink';
import { shapeDB } from '@hierarchidb/shape-store';
import { hidbEphemeralDB } from '@hierarchidb/gis-sdk';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { shapeMutationAPIImpl } from '../services/batch/ShapeBuildAPIClient.js';
import { buildBands, buildContinentLookup, buildCountryLookup, hasHighDetailSelection } from '../services/vt/shapePipelineShared.js';
import { runShapeFetchStageSection } from '../services/vt/shapePipelineFetchStage.js';
import { runShapeTransformStageSection } from '../services/vt/shapePipelineTransformStage.js';
import { runShapeVtStageSection } from '../services/vt/shapePipelineVtStage.js';
import { runShapeMetadataStage } from '../services/vt/shapePipelineMetadataStage.js';
import { runShapePipelineCleanup } from '../services/vt/shapePipelineCleanup.js';
import { resolveFailureHandling } from '../services/vt/shapePipelineStageHelpers.js';
import { ShapeMutationService, ShapeQueryService } from '@hierarchidb/runtime-worker';

type Endpoint = MessagePort | Worker | ComlinkEndpoint;

type EphemeralCacheType =
  | 'fetchCache'
  | 'transformCache'
  | 'transformErrors'
  | 'tileIdToBufferRelations'
  | 'buildTasks';

type EphemeralCacheCounts = {
  fetchCache: number;
  transformCache: number;
  transformErrors: number;
  tileIdToBufferRelations: number;
  buildTasks: number;
};

type ShapeEphemeralAdminAPI = {
  seedShapeEphemeralCaches(nodeId: NodeId): Promise<void>;
  clearShapeEphemeralCache(nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void>;
  getShapeEphemeralCounts(nodeId: NodeId): Promise<EphemeralCacheCounts>;
};

type PipelineState = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

type ShapePipelineRunParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  downloadTaskPayloads?: FetchTaskPayload[];
  selectedArrayByCountries?: SelectedArrayByCountries;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  startPaused?: boolean;
};

type ShapePipelineTestAPI = {
  startPipeline(params: ShapePipelineRunParams): Promise<void>;
  pausePipeline(nodeId: NodeId): Promise<void>;
  resumePipeline(nodeId: NodeId): Promise<void>;
  waitForPipeline(nodeId: NodeId): Promise<void>;
  getPipelineState(nodeId: NodeId): Promise<PipelineState>;
};

type PipelinePauseState = {
  paused: boolean;
  waiters: Array<() => void>;
};

type ShapeWorkerTestAPI = {
  getShapeQueryAPI(): ShapeQueryAPI;
  getShapeMutationAPI(): ShapeMutationAPI;
  getShapeEphemeralAdminAPI(): ShapeEphemeralAdminAPI;
  getShapePipelineTestAPI(): ShapePipelineTestAPI;
};

async function main(endpoint?: Endpoint): Promise<void> {
  const ensureEphemeralOpen = async (): Promise<void> => {
    if (!hidbEphemeralDB.isOpen()) {
      await hidbEphemeralDB.open();
    }
  };

  const adminApi: ShapeEphemeralAdminAPI = {
    seedShapeEphemeralCaches: async (nodeId: NodeId): Promise<void> => {
      await ensureEphemeralOpen();
      const now = Date.now();
      const data = new Uint8Array([1, 2, 3]).buffer;
      await hidbEphemeralDB.fetchCache.put({
        id: `${nodeId}-fetch-cache`,
        nodeId,
        domainType: 'shape',
        sourceKey: 'seed-fetch',
        countryCode: 'JP',
        adminLevel: 0,
        data,
        format: 'flatgeobuf',
        compression: 'none',
        featureCount: 1,
        inputFeatureCount: 1,
        bbox: [0, 0, 1, 1],
        downloadTime: 1,
        size: data.byteLength,
        vertexCount: 1,
        polygonCount: 1,
        inputVertexCount: 1,
        inputPolygonCount: 1,
        timestamp: now,
      });
      await hidbEphemeralDB.transformCache.put({
        id: `${nodeId}-transform-cache`,
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        sourceKey: 'seed-transform',
        countryCode: 'JP',
        adminLevel: 0,
        data,
        featureCount: 1,
        vertexCount: 1,
        polygonCount: 1,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: now,
      });
      await hidbEphemeralDB.transformErrors.put({
        id: `${nodeId}-transform-error`,
        nodeId,
        domainType: 'shape',
        taskId: `${nodeId}-transform-task`,
        stage: 'transform',
        polygonCount: 0,
        ringCount: 0,
        polygonErrorCount: 0,
        ringErrorCount: 0,
        createdAt: now,
        lineFeatures: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      await hidbEphemeralDB.tileIdToBufferRelations.put({
        id: `${nodeId}-tile-buffer`,
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        tileId: 'z0-0-0',
        bufferId: `${nodeId}-buffer`,
        createdAt: now,
      });
    },
    clearShapeEphemeralCache: async (nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void> => {
      await ensureEphemeralOpen();
      switch (cacheType) {
        case 'fetchCache':
          await hidbEphemeralDB.fetchCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'transformCache':
          await hidbEphemeralDB.transformCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'transformErrors':
          await hidbEphemeralDB.transformErrors.where('nodeId').equals(nodeId).delete();
          return;
        case 'tileIdToBufferRelations':
          await hidbEphemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          return;
        case 'buildTasks':
          await hidbEphemeralDB.buildTasks.where('nodeId').equals(nodeId).delete();
          return;
        default:
          return;
      }
    },
    getShapeEphemeralCounts: async (nodeId: NodeId): Promise<EphemeralCacheCounts> => {
      await ensureEphemeralOpen();
      const [fetchCache, transformCache, transformErrors, tileIdToBufferRelations, buildTasks] = await Promise.all([
        hidbEphemeralDB.fetchCache.where('nodeId').equals(nodeId).count(),
        hidbEphemeralDB.transformCache.where('nodeId').equals(nodeId).count(),
        hidbEphemeralDB.transformErrors.where('nodeId').equals(nodeId).count(),
        hidbEphemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).count(),
        hidbEphemeralDB.buildTasks.where('nodeId').equals(nodeId).count(),
      ]);
      return {
        fetchCache,
        transformCache,
        transformErrors,
        tileIdToBufferRelations,
        buildTasks,
      };
    },
  };

  const pipelineRuns = new Map<string, Promise<void>>();
  const pipelineStates = new Map<string, PipelineState>();
  const pauseStates = new Map<string, PipelinePauseState>();

  const ensurePauseState = (nodeId: NodeId): PipelinePauseState => {
    const key = String(nodeId);
    const existing = pauseStates.get(key);
    if (existing) return existing;
    const next: PipelinePauseState = { paused: false, waiters: [] };
    pauseStates.set(key, next);
    return next;
  };

  const waitIfPaused = async (nodeId: NodeId): Promise<void> => {
    const state = ensurePauseState(nodeId);
    if (!state.paused) return;
    await new Promise<void>((resolve) => {
      state.waiters.push(resolve);
    });
  };

  const setPaused = (nodeId: NodeId, paused: boolean): void => {
    const state = ensurePauseState(nodeId);
    state.paused = paused;
    if (!paused && state.waiters.length > 0) {
      const waiters = state.waiters.slice();
      state.waiters.length = 0;
      waiters.forEach((resume) => resume());
    }
  };

  const runPipeline = async (params: ShapePipelineRunParams): Promise<void> => {
    const dataSource = params.buildConfig.dataSourceName;
    if (!dataSource) {
      throw new Error('Shape pipeline requires a dataSourceName.');
    }
    const taskQueue = new VtTaskQueueDb();
    const resumeExistingTasks = Boolean(params.resumeExistingTasks);
    const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
    const failureHandling = resolveFailureHandling(buildContinuationPolicy);
    const enableHighDetailBands = hasHighDetailSelection(
      params.selectedArrayByCountries,
      params.downloadTaskPayloads,
    );
    const bands = buildBands(params.buildConfig.transformConfig.zoomBandBoundaries);
    const recyclingAllowlist = new Set<string>();

    if (!resumeExistingTasks) {
      await deleteTasksByNode(taskQueue, params.nodeId);
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(params.nodeId);
    }

    let metadataCache: CountryMetadata[] | null = null;
    const loadMetadata = async (): Promise<CountryMetadata[]> => {
      if (metadataCache) return metadataCache;
      metadataCache = await metadataLoader.loadMetadata(dataSource, params.nodeId);
      return metadataCache;
    };
    const loadCountryLookup = async (): Promise<Map<string, CountryMetadata>> => (
      buildCountryLookup(await loadMetadata())
    );
    const loadContinentLookup = async (): Promise<Map<string, string>> => (
      buildContinentLookup(await loadMetadata())
    );

    const waitForPause = () => waitIfPaused(params.nodeId);

    await waitForPause();
    const stopAfterFetch = await runShapeFetchStageSection({
      nodeId: params.nodeId,
      dataSource,
      selectedArrayByCountries: params.selectedArrayByCountries,
      downloadTaskPayloads: params.downloadTaskPayloads,
      buildConfig: params.buildConfig,
      taskQueue,
      waitIfPaused: () => waitIfPaused(params.nodeId),
      resumeExistingTasks,
      failureHandling,
      buildContinuationPolicy,
    });
    if (stopAfterFetch) return;

    await waitForPause();
    const stopAfterTransform = await runShapeTransformStageSection({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      bands,
      enableHighDetailBands,
      countryLookup: await loadCountryLookup(),
      taskQueue,
      waitIfPaused: () => waitIfPaused(params.nodeId),
      resumeExistingTasks,
      failureHandling,
      buildContinuationPolicy,
      ephemeralStore: hidbEphemeralDB,
      diffBuildEnabled: false,
      recyclingAllowlist,
    });
    if (stopAfterTransform) return;

    await waitForPause();
    await runShapeVtStageSection({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      bands,
      enableHighDetailBands,
      taskQueue,
      waitIfPaused: () => waitIfPaused(params.nodeId),
      resumeExistingTasks,
      failureHandling,
      ephemeralStore: hidbEphemeralDB,
      loadContinentLookup,
    });

    await runShapeMetadataStage({
      nodeId: params.nodeId,
      dataSource,
      ephemeralStore: hidbEphemeralDB,
      shapeDb: shapeDB,
      recyclingAllowlist,
      diffBuildEnabled: false,
    });

    await runShapePipelineCleanup({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      ephemeralStore: hidbEphemeralDB,
    });
  };

  const pipelineApi: ShapePipelineTestAPI = {
    startPipeline: async (params) => {
      const key = String(params.nodeId);
      if (pipelineRuns.has(key)) {
        throw new Error(`Pipeline already running for ${key}`);
      }
      const pauseState = ensurePauseState(params.nodeId);
      if (params.startPaused) {
        pauseState.paused = true;
      }
      pipelineStates.set(key, pauseState.paused ? 'paused' : 'running');
      const promise = (async () => {
        try {
          await runPipeline(params);
          pipelineStates.set(key, 'completed');
        } catch (error) {
          pipelineStates.set(key, 'failed');
          throw error;
        } finally {
          pipelineRuns.delete(key);
          setPaused(params.nodeId, false);
        }
      })();
      pipelineRuns.set(key, promise);
    },
    pausePipeline: async (nodeId) => {
      const key = String(nodeId);
      if (!pipelineRuns.has(key)) return;
      setPaused(nodeId, true);
      pipelineStates.set(key, 'paused');
    },
    resumePipeline: async (nodeId) => {
      const key = String(nodeId);
      if (!pipelineRuns.has(key)) return;
      setPaused(nodeId, false);
      pipelineStates.set(key, 'running');
    },
    waitForPipeline: async (nodeId) => {
      const promise = pipelineRuns.get(String(nodeId));
      if (promise) {
        await promise;
      }
    },
    getPipelineState: async (nodeId) => (
      pipelineStates.get(String(nodeId)) ?? 'idle'
    ),
  };

  const queryService = await ShapeQueryService.getSingleton(shapeDB);
  const mutationService = await ShapeMutationService.getSingleton(shapeDB);
  const api: ShapeWorkerTestAPI = {
    getShapeQueryAPI: () => proxy(queryService),
    getShapeMutationAPI: () => proxy(mutationService),
    getShapeEphemeralAdminAPI: () => proxy(adminApi),
    getShapePipelineTestAPI: () => proxy(pipelineApi),
  };

  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

export { main as exposeShapeTestAPI };
