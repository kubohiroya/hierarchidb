import type { BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { shapeDB } from '@hierarchidb/shape-store';
import { hidbEphemeralDB as ephemeralShapeDB, type HidbEphemeralDB } from '@hierarchidb/gis-sdk';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
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
  buildConfig: ShapeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  pipelineRunId?: string;
};

type ShapePipelineContext = {
  params: ShapePipelineParams;
  taskQueue: VtTaskQueueDb;
  ephemeralStore: HidbEphemeralDB;
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
  const existingFeatureMetadata = await shapeQueryAPIImpl.listFeatureMetadata(nodeId);
  const recyclingByFeatureId = new Map<string, boolean>();
  const recyclingAllowlist = new Set<string>();
  existingFeatureMetadata.forEach((row) => {
    if (!row.featureId) return;
    if (row.recycling) {
      recyclingAllowlist.add(row.featureId);
      recyclingByFeatureId.set(row.featureId, true);
    }
  });
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
  return runShapeFetchStageSection({
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
  });
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
  return runShapeTransformStageSection({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    bands,
    enableHighDetailBands,
    countryLookup: await loadCountryLookup(),
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    failureHandling,
    buildContinuationPolicy,
    pipelineRunId: params.pipelineRunId,
    ephemeralStore,
    diffBuildEnabled,
    recyclingAllowlist,
  });
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
};

const runMetadataStage = async (context: ShapePipelineContext): Promise<void> => {
  const { params, diffBuildEnabled, recyclingAllowlist, recyclingByFeatureId, ephemeralStore } = context;
  await runShapeMetadataStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    ephemeralStore,
    shapeDb: shapeDB,
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
  await preparePipelineRun(context);

  let stopAfterStage = await runFetchStage(context);
  if (!stopAfterStage) {
    stopAfterStage = await runTransformStage(context);
  }
  if (!stopAfterStage) {
    await runVtStage(context);
  }
  await runMetadataStage(context);
  await runCleanupStage(context);
};
