import type { BuildContinuationPolicy, NodeId } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { VtTaskQueueDb, deleteTasksByNode } from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';
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

export const runShapePipeline = async (params: ShapePipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const ephemeralStore = ephemeralShapeDB;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
  const failureHandling = resolveFailureHandling(buildContinuationPolicy);
  let stopAfterStage = false;
  let metadataCache: CountryMetadata[] | null = null;
  let countryLookup: Map<string, CountryMetadata> | null = null;
  let continentLookup: Map<string, string> | null = null;
  const existingFeatureMetadata = await shapeQueryAPIImpl.listFeatureMetadata(params.nodeId);
  const recyclingByFeatureId = new Map<string, boolean>();
  const recyclingAllowlist = new Set<string>();
  existingFeatureMetadata.forEach((row) => {
    if (!row.featureId) return;
    if (row.recycling) {
      recyclingAllowlist.add(row.featureId);
      recyclingByFeatureId.set(row.featureId, true);
    }
  });
  const diffBuildEnabled = recyclingAllowlist.size > 0;

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

  const enableHighDetailBands = hasHighDetailSelection(
    params.selectedArrayByCountries,
    params.downloadTaskPayloads,
  );
  const bands = buildBands(params.buildConfig.transformConfig.zoomBandBoundaries);
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

  stopAfterStage = await runShapeFetchStageSection({
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
  if (!stopAfterStage) {
    stopAfterStage = await runShapeTransformStageSection({
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
  }
  if (!stopAfterStage) {
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
  }

  await runShapeMetadataStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    ephemeralStore,
    shapeDb: shapeDB,
    recyclingByFeatureId: diffBuildEnabled ? recyclingByFeatureId : undefined,
    recyclingAllowlist,
    diffBuildEnabled,
  });

  await runShapePipelineCleanup({
    nodeId: params.nodeId,
    buildConfig: params.buildConfig,
    ephemeralStore,
  });
};
