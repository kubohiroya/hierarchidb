// Test-only worker entry that exposes Shape APIs over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import type { BatchProgressEvent, BatchProgressPayload, BatchTaskUpdateEvent, BuildTaskSummary, BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { CountryMetadata, FetchTaskPayload, SelectedArrayByCountries, ShapeBuildConfig, ShapeProcessingConfig } from '../common/types/index.js';
import type { Endpoint as ComlinkEndpoint } from 'comlink';
import { expose, proxy } from 'comlink';
import { shapeDB } from '@hierarchidb/shape-store';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { shapeBatchAPI } from '../worker/api.js';
import { shapeMutationAPIImpl } from '../services/batch/ShapeBuildAPIClient.js';
import { buildBands, buildContinentLookup, buildCountryLookup, hasHighDetailSelection } from '../services/vt/shapePipelineShared.js';
import { runShapeFetchStageSection } from '../services/vt/shapePipelineFetchStage.js';
import { runShapeTransformStageSection } from '../services/vt/shapePipelineTransformStage.js';
import { runShapeVtStageSection } from '../services/vt/shapePipelineVtStage.js';
import { runShapeMetadataStage } from '../services/vt/shapePipelineMetadataStage.js';
import { runShapePipelineCleanup } from '../services/vt/shapePipelineCleanup.js';
import { resolveFailureHandling } from '../services/vt/shapePipelineStageHelpers.js';
import { CoreDB, ShapeMutationService, ShapeQueryService } from '@hierarchidb/runtime-worker';

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

type ShapeDraftSeedPayload = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  processingConfig: ShapeProcessingConfig;
  selectedArrayByCountries: SelectedArrayByCountries;
};

type ShapeBatchTestAPI = {
  seedDraftNode(payload: ShapeDraftSeedPayload): Promise<void>;
  startBatchProcess(payload: {
    nodeId: NodeId;
    buildConfig: ShapeBuildConfig;
    processingConfig: ShapeProcessingConfig;
    downloadTaskPayloads: FetchTaskPayload[];
    buildContinuationPolicy?: BuildContinuationPolicy;
  }): Promise<NodeId>;
  subscribeToProgress(
    nodeId: NodeId,
    callback: (event: BatchProgressEvent<BatchProgressPayload>) => void
  ): () => void;
  subscribeToTasks(
    nodeId: NodeId,
    callback: (event: BatchTaskUpdateEvent<BuildTaskSummary>) => void
  ): () => void;
  getBatchTasks(nodeId: NodeId): Promise<BuildTaskSummary[]>;
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
  getShapeBatchTestAPI(): ShapeBatchTestAPI;
};


const pipelineRuns = new Map<string, Promise<void>>();
const pipelineStates = new Map<string, PipelineState>();
const pauseStates = new Map<string, PipelinePauseState>();

async function main(endpoint?: Endpoint): Promise<void> {
  const ensureEphemeralOpen = async (): Promise<void> => {
    if (!ephemeralDB.isOpen()) {
      await ephemeralDB.open();
    }
  };

  const adminApi: ShapeEphemeralAdminAPI = {
    seedShapeEphemeralCaches: async (nodeId: NodeId): Promise<void> => {
      await ensureEphemeralOpen();
      const now = Date.now();
      const data = new Uint8Array([1, 2, 3]).buffer;
      await ephemeralDB.fetchCache.put({
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
      await ephemeralDB.transformCache.put({
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
      await ephemeralDB.transformErrors.put({
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
      await ephemeralDB.tileIdToBufferRelations.put({
        id: `${nodeId}-tile-buffer`,
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        tileId: 'z0-0-0',
        bufferId: `${nodeId}-transform-cache`,
        createdAt: now,
      });
    },
    clearShapeEphemeralCache: async (nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void> => {
      await ensureEphemeralOpen();
      switch (cacheType) {
        case 'fetchCache':
          await ephemeralDB.fetchCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'transformCache':
          await ephemeralDB.transformCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'transformErrors':
          await ephemeralDB.transformErrors.where('nodeId').equals(nodeId).delete();
          return;
        case 'tileIdToBufferRelations':
          await ephemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          return;
        case 'buildTasks':
          await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).delete();
          return;
        default:
          return;
      }
    },
    getShapeEphemeralCounts: async (nodeId: NodeId): Promise<EphemeralCacheCounts> => {
      await ensureEphemeralOpen();
      const [fetchCache, transformCache, transformErrors, tileIdToBufferRelations, buildTasks] = await Promise.all([
        ephemeralDB.fetchCache.where('nodeId').equals(nodeId).count(),
        ephemeralDB.transformCache.where('nodeId').equals(nodeId).count(),
        ephemeralDB.transformErrors.where('nodeId').equals(nodeId).count(),
        ephemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).count(),
        ephemeralDB.buildTasks.where('nodeId').equals(nodeId).count(),
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
      ephemeralStore: ephemeralDB,
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
      ephemeralStore: ephemeralDB,
      loadContinentLookup,
    });

    await runShapeMetadataStage({
      nodeId: params.nodeId,
      dataSource,
      ephemeralStore: ephemeralDB,
      shapeDb: shapeDB,
      geometryEngine: params.buildConfig.transformConfig.geometryEngine ?? 'turf',
      recyclingAllowlist,
      diffBuildEnabled: false,
    });

    await runShapePipelineCleanup({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      ephemeralStore: ephemeralDB,
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

  const ensureRootNode = async (coreDB: CoreDB): Promise<NodeId> => {
    const rootId = 'r:root' as NodeId;
    const existing = await coreDB.getNode(rootId);
    if (existing) return rootId;
    const now = Date.now();
    await coreDB.nodes.put({
      id: rootId,
      parentId: null,
      nodeType: 'root' as NodeType,
      metadata: { name: 'Root', description: undefined, tags: [] },
      draftMetadata: null,
      data: null,
      draftData: undefined,
      depth: 0,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });
    return rootId;
  };

  const batchApi: ShapeBatchTestAPI = {
    seedDraftNode: async (payload) => {
      const coreDB = await CoreDB.getSingleton();
      const rootId = await ensureRootNode(coreDB);
      const now = Date.now();
      const existing = await coreDB.getNode(payload.nodeId);
      await coreDB.nodes.put({
        id: payload.nodeId,
        parentId: existing?.parentId ?? rootId,
        nodeType: 'shape' as NodeType,
        metadata: existing?.metadata ?? { name: 'Shape Draft', description: undefined, tags: [] },
        draftMetadata: existing?.draftMetadata ?? null,
        data: existing?.data ?? null,
        draftData: {
          buildConfig: payload.buildConfig,
          processingConfig: payload.processingConfig,
          selectedArrayByCountries: payload.selectedArrayByCountries,
        },
        depth: existing?.depth ?? 1,
        visible: existing?.visible ?? true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        version: (existing?.version ?? 0) + 1,
        lastTouchedAt: now,
      });
    },
    startBatchProcess: async (payload) =>
      shapeBatchAPI.startBatchProcess(
        payload.nodeId,
        payload.buildConfig,
        payload.processingConfig,
        payload.downloadTaskPayloads,
        payload.buildContinuationPolicy,
      ),
    subscribeToProgress: (nodeId, callback) => proxy(shapeBatchAPI.subscribeToProgress(nodeId, callback)),
    subscribeToTasks: (nodeId, callback) => proxy(shapeBatchAPI.subscribeToTasks(nodeId, callback)),
    getBatchTasks: async (nodeId) => shapeBatchAPI.getBatchTasks(nodeId),
  };

  const queryService = await ShapeQueryService.getSingleton(shapeDB);
  const mutationService = await ShapeMutationService.getSingleton(shapeDB);
  const api: ShapeWorkerTestAPI = {
    getShapeQueryAPI: () => proxy(queryService),
    getShapeMutationAPI: () => proxy(mutationService),
    getShapeEphemeralAdminAPI: () => proxy(adminApi),
    getShapePipelineTestAPI: () => proxy(pipelineApi),
    getShapeBatchTestAPI: () => proxy(batchApi),
  };

  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

export { main as exposeShapeTestAPI };
