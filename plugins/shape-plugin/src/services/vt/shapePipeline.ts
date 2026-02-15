import type { BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeRuntimeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { shapeDB } from '@hierarchidb/shape-store';
import { ephemeralShapeDB, type EphemeralShapeDB } from '@hierarchidb/gis-sdk';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import {
  buildBands,
  buildContinentLookup,
  buildCountryLookup,
  hasHighDetailSelection,
} from './shapePipelineShared.ts';
import { resolveFailureHandling } from './shapePipelineStageHelpers.ts';
import { runShapeFetchStageSection } from './shapePipelineFetchStage.ts';
import { runShapeTransformStageSection } from './shapePipelineTransformStage.ts';
import { runShapeVtStageSection } from './shapePipelineVtStage.ts';
import { runShapeMetadataStage } from './shapePipelineMetadataStage.ts';
import { runShapePipelineCleanup } from './shapePipelineCleanup.ts';

export type ShapePipelineParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  buildConfig: ShapeRuntimeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  pipelineRunId?: string;
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'fetch';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
};

type ShapePipelineContext = {
  params: ShapePipelineParams;
  taskQueue: VtTaskQueueDb;
  ephemeralStore: EphemeralShapeDB;
  resumeExistingTasks: boolean;
  buildContinuationPolicy: BuildContinuationPolicy;
  failureHandling: ReturnType<typeof resolveFailureHandling>;
  enableHighDetailBands: boolean;
  bands: ReturnType<typeof buildBands>;
  diffBuildEnabled: boolean;
  recyclingAllowlist: Set<string>;
  recyclingByFeatureId: Map<string, boolean>;
  loadCountryLookup: () => Promise<Map<string, CountryMetadata>>;
  loadContinentLookup: () => Promise<Map<string, string>>;
};

const collectRecyclingAllowlist = async (nodeId: NodeId) => {
  const startedAt = Date.now();
  const recyclingByFeatureId = new Map<string, boolean>();
  const recyclingAllowlist = new Set<string>();
  let scannedCount = 0;
  console.warn('[ShapePipeline][Startup] collect recycling allowlist start', JSON.stringify({
    nodeId,
  }));
  await shapeDB.featureMetadata
    .where('nodeId')
    .equals(String(nodeId))
    .each((row) => {
      scannedCount += 1;
      if (!row.featureId) return;
      if (row.recycling) {
        recyclingAllowlist.add(row.featureId);
        recyclingByFeatureId.set(row.featureId, true);
      }
    });
  console.warn('[ShapePipeline][Startup] collect recycling allowlist finish', JSON.stringify({
    nodeId,
    elapsedMs: Date.now() - startedAt,
    scannedCount,
    recyclingCount: recyclingAllowlist.size,
  }));
  return { recyclingByFeatureId, recyclingAllowlist };
};

const createShapePipelineContext = async (params: ShapePipelineParams): Promise<ShapePipelineContext> => {
  const taskQueue = new VtTaskQueueDb();
  const ephemeralStore = ephemeralShapeDB;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
  const failureHandling = resolveFailureHandling(buildContinuationPolicy);

  const { recyclingAllowlist, recyclingByFeatureId } = await collectRecyclingAllowlist(params.nodeId);
  const diffBuildEnabled = recyclingAllowlist.size > 0;

  const enableHighDetailBands = hasHighDetailSelection(
    params.selectedArrayByCountries,
    params.downloadTaskPayloads,
  );
  const bands = buildBands(params.buildConfig.transformConfig.zoomBandBoundaries);

  let metadataCache: CountryMetadata[] | null = null;
  let countryLookup: Map<string, CountryMetadata> | null = null;
  let continentLookup: Map<string, string> | null = null;
  const loadMetadata = async (): Promise<CountryMetadata[]> => {
    if (metadataCache) return metadataCache;
    metadataCache = await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
    return metadataCache;
  };
  const loadCountryLookup = async (): Promise<Map<string, CountryMetadata>> => {
    if (countryLookup) return countryLookup;
    countryLookup = buildCountryLookup(await loadMetadata());
    return countryLookup;
  };
  const loadContinentLookup = async (): Promise<Map<string, string>> => {
    if (continentLookup) return continentLookup;
    continentLookup = buildContinentLookup(await loadMetadata());
    return continentLookup;
  };

  return {
    params,
    taskQueue,
    ephemeralStore,
    resumeExistingTasks,
    buildContinuationPolicy,
    failureHandling,
    enableHighDetailBands,
    bands,
    diffBuildEnabled,
    recyclingAllowlist,
    recyclingByFeatureId,
    loadCountryLookup,
    loadContinentLookup,
  };
};

const preparePipelineRun = async (context: ShapePipelineContext): Promise<void> => {
  const { params, taskQueue, resumeExistingTasks, buildContinuationPolicy, diffBuildEnabled } = context;
  console.warn('[ShapePipeline] run start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    buildContinuationPolicy,
  }));
  if (!resumeExistingTasks) {
    await deleteTasksByNode(taskQueue, params.nodeId);
    if (!diffBuildEnabled) {
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(params.nodeId);
    }
  }
};

const runFetchStage = async (context: ShapePipelineContext): Promise<boolean> => {
  const { params, taskQueue, resumeExistingTasks, failureHandling, buildContinuationPolicy } = context;
  console.warn('[ShapePipeline][Stage] fetch start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    buildContinuationPolicy,
  }));
  const stopAfterStage = await runShapeFetchStageSection({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    selectedArrayByCountries: params.selectedArrayByCountries,
    downloadTaskPayloads: params.downloadTaskPayloads,
    buildConfig: params.buildConfig,
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    failureHandling,
    buildContinuationPolicy,
    pipelineRunId: params.pipelineRunId,
    onTasksEnqueued: params.onTasksEnqueued,
  });
  console.warn('[ShapePipeline][Stage] fetch done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    stopAfterStage,
  }));
  return stopAfterStage;
};

const runTransformStage = async (context: ShapePipelineContext): Promise<boolean> => {
  const {
    params,
    taskQueue,
    resumeExistingTasks,
    failureHandling,
    buildContinuationPolicy,
    bands,
    enableHighDetailBands,
    diffBuildEnabled,
    recyclingAllowlist,
    loadCountryLookup,
    ephemeralStore,
  } = context;
  console.warn('[ShapePipeline][Stage] transform start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    maxConcurrent: params.buildConfig.transformConfig.maxConcurrent,
    geometryEngine: params.buildConfig.transformConfig.geometryEngine ?? 'turf',
  }));
  const runTransitionStep = async <T>(step: string, action: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    const memoryAtStart = (
      globalThis as {
        performance?: {
          memory?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
            jsHeapSizeLimit?: number;
          };
        };
      }
    ).performance?.memory;
    console.warn('[ShapePipeline][Transition] step start', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      step,
      startedAt,
      memoryAtStart: memoryAtStart ?? null,
    }));
    try {
      const result = await action();
      const finishedAt = Date.now();
      const memoryAtFinish = (
        globalThis as {
          performance?: {
            memory?: {
              usedJSHeapSize?: number;
              totalJSHeapSize?: number;
              jsHeapSizeLimit?: number;
            };
          };
        }
      ).performance?.memory;
      console.warn('[ShapePipeline][Transition] step finish', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        step,
        outcome: 'success',
        startedAt,
        finishedAt,
        elapsedMs: finishedAt - startedAt,
        memoryAtStart: memoryAtStart ?? null,
        memoryAtFinish: memoryAtFinish ?? null,
      }));
      return result;
    } catch (error) {
      const finishedAt = Date.now();
      const memoryAtFinish = (
        globalThis as {
          performance?: {
            memory?: {
              usedJSHeapSize?: number;
              totalJSHeapSize?: number;
              jsHeapSizeLimit?: number;
            };
          };
        }
      ).performance?.memory;
      console.warn('[ShapePipeline][Transition] step finish', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        step,
        outcome: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt,
        finishedAt,
        elapsedMs: finishedAt - startedAt,
        memoryAtStart: memoryAtStart ?? null,
        memoryAtFinish: memoryAtFinish ?? null,
      }));
      throw error;
    }
  };
  const countryLookup = await runTransitionStep('load-country-lookup-for-transform', async () => (
    loadCountryLookup()
  ));
  const stopAfterStage = await runTransitionStep('run-transform-stage-section', async () => runShapeTransformStageSection({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    bands,
    enableHighDetailBands,
    countryLookup,
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    failureHandling,
    buildContinuationPolicy,
    pipelineRunId: params.pipelineRunId,
    ephemeralStore,
    diffBuildEnabled,
    recyclingAllowlist,
  }));
  console.warn('[ShapePipeline][Stage] transform done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    stopAfterStage,
  }));
  return stopAfterStage;
};

const runVtStage = async (context: ShapePipelineContext): Promise<void> => {
  const {
    params,
    taskQueue,
    resumeExistingTasks,
    failureHandling,
    bands,
    enableHighDetailBands,
    loadContinentLookup,
    ephemeralStore,
  } = context;
  console.warn('[ShapePipeline][Stage] vt start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    maxConcurrent: params.buildConfig.vtConfig.maxConcurrent,
  }));
  await runShapeVtStageSection({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    bands,
    enableHighDetailBands,
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    failureHandling,
    pipelineRunId: params.pipelineRunId,
    ephemeralStore,
    loadContinentLookup,
  });
  console.warn('[ShapePipeline][Stage] vt done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
  }));
};

const runMetadataStage = async (context: ShapePipelineContext): Promise<void> => {
  const { params, diffBuildEnabled, recyclingAllowlist, recyclingByFeatureId, ephemeralStore } = context;
  const geometryEngine = params.buildConfig.transformConfig.geometryEngine ?? 'turf';
  await runShapeMetadataStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    ephemeralStore,
    shapeDb: shapeDB,
    geometryEngine,
    recyclingByFeatureId: diffBuildEnabled ? recyclingByFeatureId : undefined,
    recyclingAllowlist,
    diffBuildEnabled,
  });
};

const runCleanupStage = async (context: ShapePipelineContext): Promise<void> => {
  const { params, ephemeralStore } = context;
  await runShapePipelineCleanup({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    ephemeralStore,
  });
};

export const runShapePipeline = async (params: ShapePipelineParams): Promise<void> => {
  const context = await createShapePipelineContext(params);
  const markPipelineCheckpoint = (stage: string, phase: 'start' | 'success' | 'error'): void => {
    void shapeMutationAPIImpl.updateBuildSession(params.nodeId, {
      stageId: `pipeline:${stage}:${phase}`,
      stageHeartbeatAt: Date.now(),
    }).catch(() => {});
  };
  const checkpoint = async <T>(stage: string, action: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    markPipelineCheckpoint(stage, 'start');
    console.warn('[ShapePipeline][Checkpoint] start', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      stage,
      startedAt,
    }));
    try {
      const result = await action();
      const finishedAt = Date.now();
      markPipelineCheckpoint(stage, 'success');
      console.warn('[ShapePipeline][Checkpoint] finish', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        stage,
        outcome: 'success',
        startedAt,
        finishedAt,
        elapsedMs: finishedAt - startedAt,
      }));
      return result;
    } catch (error) {
      const finishedAt = Date.now();
      markPipelineCheckpoint(stage, 'error');
      console.error('[ShapePipeline][Checkpoint] finish', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        stage,
        outcome: 'error',
        startedAt,
        finishedAt,
        elapsedMs: finishedAt - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
      }));
      throw error;
    }
  };

  await checkpoint('prepare-pipeline-run', async () => preparePipelineRun(context));

  let stopAfterStage = await checkpoint('fetch-stage', async () => runFetchStage(context));
  if (!stopAfterStage) {
    stopAfterStage = await checkpoint('transform-stage', async () => runTransformStage(context));
  }
  if (!stopAfterStage) {
    await checkpoint('vt-stage', async () => runVtStage(context));
  }
  await checkpoint('metadata-stage', async () => runMetadataStage(context));
  await checkpoint('cleanup-stage', async () => runCleanupStage(context));
};
