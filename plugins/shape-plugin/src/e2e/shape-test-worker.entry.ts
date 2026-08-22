// Test-only worker entry that exposes Shape APIs over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import type {
  BuildTaskSummary,
  BuildTaskUpdateEvent,
  BuildContinuationPolicy,
  StageSnapshotUpdatedEvent,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { CountryMetadata, SourceTaskPayload, SelectedArrayByCountries, ShapeBuildConfig, ShapeProcessingConfig } from '../common/types/index';
import type { Endpoint as ComlinkEndpoint } from 'comlink';
import { expose, proxy } from 'comlink';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { initializeRouteDB } from '@hierarchidb/route-store';
import { initializeShapeChunkStore } from '../services/utils/initializeShapeChunkStore.js';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { metadataLoader } from '../services/metadata/MetadataLoader';
import { shapeBuildAPI } from '../worker/api';
import { shapeMutationAPIImpl } from '../services/build/ShapeBuildAPIClient';
import { buildBands, buildContinentLookup, buildCountryLookup, hasHighDetailSelection } from '../services/vt/shapePipelineShared';
import { runShapeSourceStageSection } from '../services/vt/shapePipelineSourceStage';
import { runShapeGeometryStageSection } from '../services/vt/runShapeGeometryStageSection';
import { runShapeTileEmitStageSection } from '../services/vt/runShapeTileEmitStageSection';
import { runShapeMetadataStage } from '../services/vt/runShapeMetadataStage';
import { runShapePipelineCleanup } from '../services/vt/runShapePipelineCleanup';
import { resolveFailureHandling } from '../services/vt/shapePipelineStageHelpers';
import { CoreDB, ShapeMutationService, ShapeQueryService } from '@hierarchidb/runtime-worker';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';

const testDatabasePrefix = getBuildDatabasePrefix();
const shapeDB = initializeShapeDB(getDBName(testDatabasePrefix, 'shape'));
const ephemeralDB = initializeEphemeralDB(getDBName(testDatabasePrefix, 'ephemeral'));
initializeRouteDB(getDBName(testDatabasePrefix, 'route'));
initializeShapeChunkStore(getDBName(testDatabasePrefix, 'shape-chunks'));

type Endpoint = MessagePort | Worker | ComlinkEndpoint;

type EphemeralCacheType =
  | 'sourceCache'
  | 'geometryCache'
  | 'geometryErrors'
  | 'tileEmitBufferRelations'
  | 'buildTasks';

type EphemeralCacheCounts = {
  sourceCache: number;
  geometryCache: number;
  geometryErrors: number;
  tileEmitBufferRelations: number;
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
  downloadTaskPayloads?: SourceTaskPayload[];
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

type ShapeBuildTestAPI = {
  seedDraftNode(payload: ShapeDraftSeedPayload): Promise<void>;
  startBuildSession(payload: {
    nodeId: NodeId;
    buildConfig: ShapeBuildConfig;
    processingConfig: ShapeProcessingConfig;
    downloadTaskPayloads: SourceTaskPayload[];
    buildContinuationPolicy?: BuildContinuationPolicy;
  }): Promise<NodeId>;
  subscribeStageSnapshots(
    nodeId: NodeId,
    callback: (event: StageSnapshotUpdatedEvent) => void
  ): () => void;
  subscribeTasks(
    nodeId: NodeId,
    callback: (event: BuildTaskUpdateEvent<BuildTaskSummary>) => void
  ): () => void;
  getBuildTasks(nodeId: NodeId): Promise<BuildTaskSummary[]>;
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
  getShapeBuildTestAPI(): ShapeBuildTestAPI;
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
      const sourceCacheId = `${nodeId}-source-cache`;

      // Phase 1: Write source cache with timestamp: 0
      await ephemeralDB.sourceCache.put({
        id: sourceCacheId,
        nodeId,
        domainType: 'shape',
        sourceKey: 'seed-source',
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
        timestamp: 0,
      });

      // Phase 2: Mark source cache write complete
      await ephemeralDB.sourceCache.update(sourceCacheId, { timestamp: now });

      const geometryCacheId = `${nodeId}-geometry-cache`;

      // Phase 1: Write geometry cache with timestamp: 0
      await ephemeralDB.geometryCache.put({
        id: geometryCacheId,
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        sourceKey: 'seed-geometry',
        countryCode: 'JP',
        adminLevel: 0,
        data,
        featureCount: 1,
        vertexCount: 1,
        polygonCount: 1,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: 0,
      });

      // Phase 2: Mark geometry cache write complete
      await ephemeralDB.geometryCache.update(geometryCacheId, { timestamp: now });

      await ephemeralDB.geometryErrors.put({
        id: `${nodeId}-geometry-error`,
        nodeId,
        domainType: 'shape',
        taskId: `${nodeId}-geometry-task`,
        stage: 'geometry',
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
      await ephemeralDB.tileEmitBufferRelations.put({
        id: `${nodeId}-tile-buffer`,
        nodeId,
        domainType: 'shape',
        bandIndex: 0,
        tileId: 'z0-0-0',
        bufferId: `${nodeId}-geometry-cache`,
        createdAt: now,
      });
    },
    clearShapeEphemeralCache: async (nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void> => {
      await ensureEphemeralOpen();
      switch (cacheType) {
        case 'sourceCache':
          await ephemeralDB.sourceCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'geometryCache':
          await ephemeralDB.geometryCache.where('nodeId').equals(nodeId).delete();
          return;
        case 'geometryErrors':
          await ephemeralDB.geometryErrors.where('nodeId').equals(nodeId).delete();
          return;
        case 'tileEmitBufferRelations':
          await ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
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
      const [sourceCache, geometryCache, geometryErrors, tileEmitBufferRelations, buildTasks] = await Promise.all([
        ephemeralDB.sourceCache.where('nodeId').equals(nodeId).count(),
        ephemeralDB.geometryCache.where('nodeId').equals(nodeId).count(),
        ephemeralDB.geometryErrors.where('nodeId').equals(nodeId).count(),
        ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(nodeId).count(),
        ephemeralDB.buildTasks.where('nodeId').equals(nodeId).count(),
      ]);
      return {
        sourceCache,
        geometryCache,
        geometryErrors,
        tileEmitBufferRelations,
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
      waiters.forEach((resume) => {
        resume();
      });
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
    const bands = buildBands(params.buildConfig.geometryConfig.zoomBandBoundaries);
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
    const stopAfterFetch = await runShapeSourceStageSection({
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
    const stopAfterGeometry = await runShapeGeometryStageSection({
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
    if (stopAfterGeometry) return;

    await waitForPause();
    await runShapeTileEmitStageSection({
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
      geometryEngine: params.buildConfig.geometryConfig.geometryEngine ?? 'turf',
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

  const buildApi: ShapeBuildTestAPI = {
    seedDraftNode: async (payload) => {
      const coreDB = await CoreDB.getSingleton(
        getDBName(getBuildDatabasePrefix(), 'core')
      );
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
    startBuildSession: async (payload) => shapeBuildAPI.startBuildSession(
      payload.nodeId,
      payload.buildConfig,
      payload.processingConfig,
      payload.downloadTaskPayloads,
      payload.buildContinuationPolicy,
    ),
    subscribeStageSnapshots: (nodeId, callback) => proxy(shapeBuildAPI.subscribeStageSnapshots(nodeId, callback)),
    subscribeTasks: (nodeId, callback) => proxy(shapeBuildAPI.subscribeTasks(nodeId, callback)),
    getBuildTasks: async (nodeId) => shapeBuildAPI.getBuildTasks(nodeId),
  };

  const shapeChunkStoreDatabaseName = getDBName(testDatabasePrefix, 'shape-chunks');
  const queryService = await ShapeQueryService.getSingleton(
    shapeDB,
    shapeChunkStoreDatabaseName
  );
  const mutationService = await ShapeMutationService.getSingleton(
    shapeDB,
    shapeChunkStoreDatabaseName
  );
  const api: ShapeWorkerTestAPI = {
    getShapeQueryAPI: () => proxy(queryService),
    getShapeMutationAPI: () => proxy(mutationService),
    getShapeEphemeralAdminAPI: () => proxy(adminApi),
    getShapePipelineTestAPI: () => proxy(pipelineApi),
    getShapeBuildTestAPI: () => proxy(buildApi),
  };

  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

export { main as exposeShapeTestAPI };
