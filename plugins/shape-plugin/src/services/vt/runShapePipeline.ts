import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskStage } from '@hierarchidb/build-api';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import type { CountryMetadata, DataSourceName, SourceTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { shapeDB } from '@hierarchidb/shape-store';
import { ephemeralDB, type EphemeralDB } from '@hierarchidb/gis-sdk';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
  runWithStageCheckpoint,
} from '@hierarchidb/build-runtime-services';
import {
  buildBands,
  buildContinentLookup,
  buildCountryLookup,
  hasHighDetailSelection,
} from './shapePipelineShared.ts';
import { resolveFailureHandling } from './shapePipelineStageHelpers.ts';
import { runShapeSourceStageSection } from './shapePipelineSourceStage.ts';
import { runShapeGeometryStageSection } from './runShapeGeometryStageSection.ts';
import { runShapeTileEmitStageSection } from './runShapeTileEmitStageSection.ts';
import { runShapeMetadataStage } from './runShapeMetadataStage.ts';
import { runShapePipelineCleanup } from './runShapePipelineCleanup.ts';
import {
  createDefaultShapeStageProfile,
  flattenShapeStageProfile,
  validateShapeStageProfile,
  type ShapeStageProfileEntry,
} from '../stageProfile';

export type ShapePipelineParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  buildConfig: ShapeRuntimeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  pipelineRunId?: string;
  abortSignal?: AbortSignal;
  isRunCurrent?: () => boolean;
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'source';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
  onStageTasksPrepared?: (payload: {
    nodeId: NodeId;
    stage: TaskStage;
    taskCount: number;
  }) => Promise<void> | void;
};

const assertShapePipelineActive = (params: ShapePipelineParams): void => {
  if (params.abortSignal?.aborted || params.isRunCurrent?.() === false) {
    throw new DOMException('Shape pipeline run is no longer active', 'AbortError');
  }
};

type ShapePipelineContext = {
  params: ShapePipelineParams;
  taskQueue: VtTaskQueueDb;
  ephemeralStore: EphemeralDB;
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
    durationMs: Date.now() - startedAt,
    scannedCount,
    recyclingCount: recyclingAllowlist.size,
  }));
  return { recyclingByFeatureId, recyclingAllowlist };
};

const createShapePipelineContext = async (params: ShapePipelineParams): Promise<ShapePipelineContext> => {
  try {
    const taskQueue = new VtTaskQueueDb();
    const ephemeralStore = ephemeralDB;
    const resumeExistingTasks = Boolean(params.resumeExistingTasks);
    const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
    const failureHandling = resolveFailureHandling(buildContinuationPolicy);

    const { recyclingAllowlist, recyclingByFeatureId } = await collectRecyclingAllowlist(params.nodeId);
    const diffBuildEnabled = recyclingAllowlist.size > 0;

    const enableHighDetailBands = hasHighDetailSelection(
      params.selectedArrayByCountries,
      params.downloadTaskPayloads,
    );
    const bands = buildBands(params.buildConfig.geometryConfig.zoomBandBoundaries);

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
  } catch (error) {
    console.warn('[ShapePipeline][Context] failed to create context', JSON.stringify({
      runId: params.pipelineRunId ?? null,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
};

const preparePipelineRun = async (context: ShapePipelineContext): Promise<void> => {
  const { params, taskQueue, resumeExistingTasks, buildContinuationPolicy, diffBuildEnabled } = context;
  assertShapePipelineActive(params);
  console.warn('[ShapePipeline] run start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    buildContinuationPolicy,
  }));
  if (!resumeExistingTasks) {
    assertShapePipelineActive(params);
    await deleteTasksByNode(taskQueue, params.nodeId);
    assertShapePipelineActive(params);
    if (!diffBuildEnabled) {
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(params.nodeId);
      assertShapePipelineActive(params);
    }
  }
};

const runSourceStage = async (context: ShapePipelineContext): Promise<boolean> => {
  const { params, taskQueue, resumeExistingTasks, failureHandling, buildContinuationPolicy } = context;
  console.warn('[ShapePipeline][Stage] source start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    buildContinuationPolicy,
  }));
  const stopAfterStage = await runShapeSourceStageSection({
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
    abortSignal: params.abortSignal,
    onTasksEnqueued: params.onTasksEnqueued,
    onStageTasksPrepared: params.onStageTasksPrepared,
  });
  console.warn('[ShapePipeline][Stage] source done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    stopAfterStage,
  }));
  return stopAfterStage;
};

const runGeometryStage = async (context: ShapePipelineContext): Promise<boolean> => {
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
  console.warn('[ShapePipeline][Stage] geometry start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    maxConcurrent: params.buildConfig.geometryConfig.maxConcurrent,
    geometryEngine: params.buildConfig.geometryConfig.geometryEngine ?? 'turf',
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
        durationMs: finishedAt - startedAt,
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
        durationMs: finishedAt - startedAt,
        memoryAtStart: memoryAtStart ?? null,
        memoryAtFinish: memoryAtFinish ?? null,
      }));
      throw error;
    }
  };
  const countryLookup = await runTransitionStep('load-country-lookup-for-geometry', async () => (
    loadCountryLookup()
  ));
  const stopAfterStage = await runTransitionStep('run-geometry-stage-section', async () => runShapeGeometryStageSection({
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
    abortSignal: params.abortSignal,
    ephemeralStore,
    diffBuildEnabled,
    recyclingAllowlist,
    onStageTasksPrepared: params.onStageTasksPrepared,
  }));
  console.warn('[ShapePipeline][Stage] geometry done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    stopAfterStage,
  }));
  return stopAfterStage;
};

const runTileEmitStage = async (context: ShapePipelineContext): Promise<void> => {
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
  console.warn('[ShapePipeline][Stage] tileEmit start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    maxConcurrent: params.buildConfig.tileEmitConfig.maxConcurrent,
  }));
  await runShapeTileEmitStageSection({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    bands,
    enableHighDetailBands,
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    failureHandling,
    pipelineRunId: params.pipelineRunId,
    abortSignal: params.abortSignal,
    ephemeralStore,
    loadContinentLookup,
    onStageTasksPrepared: params.onStageTasksPrepared,
  });
  console.warn('[ShapePipeline][Stage] tileEmit done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
  }));
};

const runProfileStage = async (
  stage: ShapeStageProfileEntry,
  context: ShapePipelineContext,
): Promise<boolean> => {
  if (stage.stageKey === 'primary-source') {
    return runSourceStage(context);
  }
  if (stage.stageKey === 'intermediate-geometry') {
    return runGeometryStage(context);
  }
  if (stage.stageKey === 'final-tile-emit') {
    await runTileEmitStage(context);
    return false;
  }
  throw new Error(`[shape-pipeline] Unsupported stageKey in profile: ${stage.stageKey}`);
};

const runMetadataStage = async (context: ShapePipelineContext): Promise<void> => {
  const { params, diffBuildEnabled, recyclingAllowlist, recyclingByFeatureId, ephemeralStore } = context;
  const geometryEngine = params.buildConfig.geometryConfig.geometryEngine ?? 'turf';
  await runShapeMetadataStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    ephemeralStore,
    shapeDb: shapeDB,
    geometryEngine,
    recyclingByFeatureId: diffBuildEnabled ? recyclingByFeatureId : undefined,
    recyclingAllowlist,
    diffBuildEnabled,
    abortSignal: params.abortSignal,
  });
};

const runCleanupStage = async (context: ShapePipelineContext): Promise<void> => {
  const { params, ephemeralStore } = context;
  await runShapePipelineCleanup({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    ephemeralStore,
    abortSignal: params.abortSignal,
  });
};

export const runShapePipeline = async (params: ShapePipelineParams): Promise<void> => {
  console.warn('[ShapePipeline] pipeline start', JSON.stringify({
    runId: params.pipelineRunId ?? null,
    dataSource: params.dataSource,
    downloadTaskPayloadsCount: params.downloadTaskPayloads?.length ?? 0,
  }));
  
  try {
    const shouldStopPipeline = (): boolean =>
      params.abortSignal?.aborted === true || params.isRunCurrent?.() === false;
    if (shouldStopPipeline()) return;
    const context = await createShapePipelineContext(params);
    if (shouldStopPipeline()) return;
    const stageProfile = createDefaultShapeStageProfile();
    validateShapeStageProfile(stageProfile);
    const executionStages = flattenShapeStageProfile(stageProfile);
    const markPipelineCheckpoint = async (
      stage: string,
      phase: 'start' | 'success' | 'error',
    ): Promise<void> => {
      if (shouldStopPipeline()) return;
      await shapeMutationAPIImpl.updateBuildSession(params.nodeId, {
        stageId: `pipeline:${stage}:${phase}`,
        stageHeartbeatAt: Date.now(),
      });
    };

    const checkpointToProgressStage = new Map<string, TaskStage>(
      executionStages.map((stage) => [stage.checkpointStage, stage.canonicalStage]),
    );
    const resolveProgressStage = (checkpointStage: string): TaskStage => (
      checkpointToProgressStage.get(checkpointStage) ?? 'source'
    );

    const checkpoint = async <T>(stage: string, action: () => Promise<T>): Promise<T> => {
      const progressStage = resolveProgressStage(stage);
      return runWithStageCheckpoint({
        nodeId: params.nodeId,
        stage: progressStage,
        action,
        runId: params.pipelineRunId,
        writeHeartbeat: async (_checkpointStage, phase) => {
          await markPipelineCheckpoint(stage, phase);
        },
        logger: {
          onStart: ({ startedAt, memory }) => {
            console.warn('[ShapePipeline][Checkpoint] stage start', JSON.stringify({
              runId: params.pipelineRunId ?? null,
              stage,
              startedAt,
              memory,
            }));
          },
          onSuccess: ({ startedAt, durationMs, memory }) => {
            const finishedAt = Date.now();
            console.warn('[ShapePipeline][Checkpoint] stage success', JSON.stringify({
              runId: params.pipelineRunId ?? null,
              stage,
              outcome: 'success',
              startedAt,
              finishedAt,
              durationMs,
              memory,
            }));
          },
          onError: ({ startedAt, durationMs, errorMessage, memory }) => {
            const finishedAt = Date.now();
            console.warn('[ShapePipeline][Checkpoint] stage error', JSON.stringify({
              runId: params.pipelineRunId ?? null,
              stage,
              outcome: 'error',
              startedAt,
              finishedAt,
              durationMs,
              errorMessage,
              memory,
            }));
          },
        },
      });
    };

    console.warn('[ShapePipeline] prepare start', JSON.stringify({
      runId: params.pipelineRunId ?? null,
    }));
    await checkpoint('prepare-pipeline-run', async () => preparePipelineRun(context));
    if (shouldStopPipeline()) return;

    console.warn('[ShapePipeline] execution stages start', JSON.stringify({
      runId: params.pipelineRunId ?? null,
      stageCount: executionStages.length,
    }));
    
    let stopAfterStage = false;
    for (const stage of executionStages) {
      if (stopAfterStage) {
        console.warn('[ShapePipeline] stage skipped', JSON.stringify({
          runId: params.pipelineRunId ?? null,
          stage: stage.checkpointStage,
        }));
        break;
      }
      console.warn('[ShapePipeline] stage start', JSON.stringify({
        runId: params.pipelineRunId ?? null,
        stage: stage.checkpointStage,
      }));
      stopAfterStage = await checkpoint(
        stage.checkpointStage,
        async () => runProfileStage(stage, context),
      );
      if (shouldStopPipeline()) return;
    }
    
    console.warn('[ShapePipeline] metadata stage start', JSON.stringify({
      runId: params.pipelineRunId ?? null,
    }));
    if (shouldStopPipeline()) return;
    await checkpoint('metadata-stage', async () => runMetadataStage(context));
    if (shouldStopPipeline()) return;
    
    console.warn('[ShapePipeline] cleanup stage start', JSON.stringify({
      runId: params.pipelineRunId ?? null,
    }));
    if (shouldStopPipeline()) return;
    await checkpoint('cleanup-stage', async () => runCleanupStage(context));
    if (shouldStopPipeline()) return;
    
    console.warn('[ShapePipeline] pipeline complete', JSON.stringify({
      runId: params.pipelineRunId ?? null,
    }));
  } catch (error) {
    console.warn('[ShapePipeline] pipeline error', JSON.stringify({
      runId: params.pipelineRunId ?? null,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
};
