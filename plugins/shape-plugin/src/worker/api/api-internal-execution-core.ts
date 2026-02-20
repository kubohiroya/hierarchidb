/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BuildContinuationPolicy, TaskQueueRecord, TaskStage } from '@hierarchidb/batch-api';
import type {
  ShapeBuildConfig,
  ShapeRuntimeBuildConfig,
  CountryMetadata,
  DataSourceName,
  FetchTaskPayload,
  SelectedArrayByCountries,
  ShapeProcessingConfig,
} from '~/common/types/index';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  composeRuntimeBuildConfig,
  mergeBuildConfig,
  mergeProcessingConfig,
  requireDataSourceName,
  validateBatchConfig,
} from '~/common/types/index';
import type { BuildProgressEvent } from '@hierarchidb/batch-api';

import { metadataLoader } from '~/services/metadata/MetadataLoader';
import {
  countSelectedAdminPairs,
} from '~/services/utils/utils';
import {
  deleteRawDataDataSourceBuffersForNodeMetadataIds,
} from '~/services/utils/chunkStore';
import { resolveFetchStageStrategy } from '~/services/batch/strategies/resolveFetchStageStrategy';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  deleteTasksByIds,
  listTasks,
  listTasksByStage,
  listTasksByStatus,
  onTaskQueueUpdate,
  updateTask,
} from '@hierarchidb/vt-orchestrator';
import type { BuildSessionConfig } from '@hierarchidb/shape-store';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { runShapePipeline } from '~/services/vt/shapePipeline';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/batch/ShapeBuildAPIClient';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import { setFetchPlannedTotal } from '~/services/vt/shapeProgressPlan';
import { shouldReuseTaskQueueOnStart } from '../shouldReuseTaskQueueOnStart.js';
import { shapeBuildRuntimeExecutionMetrics } from './api-internal-execution-metrics.js';

const {
  countTaskQueueStatuses,
  setPaused,
  waitIfPaused,
  startSessionTracking,
  clearStalePipelineStateIfInactive,
  clearActivePipelineRuntimeState,
  resolveProgressPhase,
  buildProgressPayloadFromTasks,
  emitProgressSnapshot,
  upsertBuildSessionSnapshot,
  updateBuildSessionFromTasks,
  summarizeTaskQueueStatus,
  progressCallbacks,
  getShapeEntityHandler,
  activePipelines,
  activePipelineRuns,
  seedTaskQueueFromBuildTasks,
  isTaskStageValue,
  isStopReason,
} = shapeBuildRuntimeExecutionMetrics;

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
  const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig',
  );

  return {
    dataSource: resolvedDataSource,
    fetchConfig: buildConfig.fetchConfig,
    transformConfig: buildConfig.transformConfig,
    vectorTiles: buildConfig.vtConfig,
  };
};

const buildFetchStageOptions = (buildConfig: ShapeRuntimeBuildConfig) => ({
  timeoutMs: buildConfig.fetchConfig.timeoutMs,
  retryAttempts: buildConfig.fetchConfig.retryAttempts,
  retryDelay: buildConfig.fetchConfig.retryDelay,
});

const summarizeSelectedArrayByCountries = (
  selectedArrayByCountries: SelectedArrayByCountries | undefined,
): { selectedCountryCount: number; selectedAdminPairCount: number } => {
  if (!selectedArrayByCountries || typeof selectedArrayByCountries !== 'object' || Array.isArray(selectedArrayByCountries)) {
    return { selectedCountryCount: 0, selectedAdminPairCount: 0 };
  }
  let selectedCountryCount = 0;
  let selectedAdminPairCount = 0;
  Object.values(selectedArrayByCountries).forEach((row) => {
    if (!Array.isArray(row)) return;
    let hasSelectedInCountry = false;
    row.forEach((selected) => {
      if (selected === true) {
        hasSelectedInCountry = true;
        selectedAdminPairCount += 1;
      }
    });
    if (hasSelectedInCountry) {
      selectedCountryCount += 1;
    }
  });
  return { selectedCountryCount, selectedAdminPairCount };
};

const resolveFetchTaskPayloadsForPlan = async (input: {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
}): Promise<FetchTaskPayload[]> => {
  if (input.downloadTaskPayloads && input.downloadTaskPayloads.length > 0) {
    return input.downloadTaskPayloads;
  }
  if (!input.selectedArrayByCountries) {
    return [];
  }
  const strategy = resolveFetchStageStrategy(input.dataSource);
  const selectedAdminPairCount = countSelectedAdminPairs(input.selectedArrayByCountries);
  const buildPayloads = (countryMetadata: CountryMetadata[]): FetchTaskPayload[] => strategy.buildFetchTaskPayloads({
    selectedArrayByCountries: input.selectedArrayByCountries,
    countryMetadata,
  });
  const countryMetadata = await metadataLoader.loadMetadata(input.dataSource, input.nodeId);
  const payloadsFromCache = buildPayloads(countryMetadata);
  if (payloadsFromCache.length > 0 || selectedAdminPairCount === 0) {
    return payloadsFromCache;
  }
  console.warn('[shapeBuildAPI] no fetch payloads from cached metadata; retrying with force refresh', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
    selectedAdminPairCount,
  });
  metadataLoader.clearCache(input.dataSource);
  const refreshedMetadata = await metadataLoader.loadMetadata(input.dataSource, input.nodeId, { force: true });
  const payloadsFromRefreshedMetadata = buildPayloads(refreshedMetadata);
  if (payloadsFromRefreshedMetadata.length > 0) {
    return payloadsFromRefreshedMetadata;
  }
  throw new Error(
    `[shapeBuildAPI] No fetch task payloads generated for ${selectedAdminPairCount}`
    + ' selected entries. Metadata may be stale or incompatible with the current selection.',
  );
};

const estimatePlannedFetchTotal = async (input: {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
}): Promise<{ plannedFetchTotal: number; payloadCount: number }> => {
  const dataSource = requireDataSourceName(
    input.buildConfig.dataSourceName,
    'estimatePlannedFetchTotal',
  );
  const payloads = await resolveFetchTaskPayloadsForPlan({
    nodeId: input.nodeId,
    dataSource,
    selectedArrayByCountries: input.selectedArrayByCountries,
    downloadTaskPayloads: input.downloadTaskPayloads,
  });
  if (payloads.length === 0) {
    return { plannedFetchTotal: 0, payloadCount: 0 };
  }
  const strategy = resolveFetchStageStrategy(dataSource);
  const { tasks } = await strategy.buildFetchTasks({
    nodeId: input.nodeId,
    fetchTaskPayloads: payloads,
    config: buildBuildSessionConfig(input.buildConfig),
    options: buildFetchStageOptions(input.buildConfig),
  });
  return {
    plannedFetchTotal: tasks.length,
    payloadCount: payloads.length,
  };
};

const hasConfigDiff = <T extends object>(left: T, right: T): boolean => {
  const keys = new Set<keyof T>([...Object.keys(left), ...Object.keys(right)] as Array<keyof T>);
  for (const key of keys) {
    if (!Object.is(left[key], right[key])) {
      return true;
    }
  }
  return false;
};

const resolveConfigInvalidationPlan = (
  prevConfig: ShapeRuntimeBuildConfig | null,
  nextConfig: ShapeRuntimeBuildConfig | null,
): { fetch: boolean; transform: boolean; vt: boolean } => {
  if (!prevConfig || !nextConfig) {
    return { fetch: false, transform: false, vt: false };
  }
  return {
    fetch: hasConfigDiff(prevConfig.fetchConfig, nextConfig.fetchConfig),
    transform: hasConfigDiff(prevConfig.transformConfig, nextConfig.transformConfig),
    vt: hasConfigDiff(prevConfig.vtConfig, nextConfig.vtConfig),
  };
};

const normalizeSelectionKey = (code: string): string => code.trim().toUpperCase();

const buildSelectionSet = (selection: SelectedArrayByCountries | undefined): Set<string> => {
  const set = new Set<string>();
  if (!selection || Array.isArray(selection)) return set;
  Object.entries(selection).forEach(([code, row]) => {
    if (!Array.isArray(row)) return;
    const normalizedCode = normalizeSelectionKey(code);
    row.forEach((selected, index) => {
      if (selected) {
        set.add(`${normalizedCode}:${index}`);
      }
    });
  });
  return set;
};

const computeRemovedSelectionPairs = (
  prevSelection: SelectedArrayByCountries | undefined,
  nextSelection: SelectedArrayByCountries | undefined,
): Array<{ countryCode: string; adminLevel: number }> => {
  if (!prevSelection || Array.isArray(prevSelection)) return [];
  const prevSet = buildSelectionSet(prevSelection);
  const nextSet = buildSelectionSet(nextSelection);
  const removed: Array<{ countryCode: string; adminLevel: number }> = [];
  prevSet.forEach((entry) => {
    if (nextSet.has(entry)) return;
    const [countryCode, adminLevelText] = entry.split(':');
    const adminLevel = Number.parseInt(adminLevelText ?? '', 10);
    if (!countryCode || !Number.isFinite(adminLevel)) return;
    removed.push({ countryCode, adminLevel });
  });
  return removed;
};

const applySelectionDiffCleanup = async (
  nodeId: NodeId,
  prevSelection: SelectedArrayByCountries | undefined,
  nextSelection: SelectedArrayByCountries | undefined,
): Promise<void> => {
  const removedPairs = computeRemovedSelectionPairs(prevSelection, nextSelection);
  if (removedPairs.length === 0) return;
  const taskQueue = new VtTaskQueueDb();
  const removedKeyTuples = removedPairs.map((entry) => (
    [nodeId, normalizeSelectionKey(entry.countryCode), entry.adminLevel] as const
  ));
  const [fetchCacheIdsRaw, transformCacheIdsRaw, vtTasks] = await Promise.all([
    ephemeralDB.fetchCacheMeta
      .where('[nodeId+countryCode+adminLevel]')
      .anyOf(removedKeyTuples)
      .primaryKeys(),
    ephemeralDB.transformCacheMeta
      .where('[nodeId+countryCode+adminLevel]')
      .anyOf(removedKeyTuples)
      .primaryKeys(),
    taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'vt']).toArray(),
  ]);
  const fetchCacheIds = fetchCacheIdsRaw.map((id: unknown) => String(id));
  if (fetchCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.fetchCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
      ephemeralDB.fetchCacheMeta
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
    ]);
      await deleteRawDataDataSourceBuffersForNodeMetadataIds(nodeId, fetchCacheIds);
  }

  const transformCacheIds = transformCacheIdsRaw.map((id: unknown) => String(id));
  const removedBufferSet = new Set(transformCacheIds);
  if (transformCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.transformCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
      ephemeralDB.transformCacheMeta
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
    ]);
    const relations = await ephemeralDB.tileIdToBufferRelations
      .where('bufferId')
      .anyOf(transformCacheIds)
      .toArray();
    const affectedTileIds = new Set(relations.map((row) => row.tileId));
    await ephemeralDB.tileIdToBufferRelations
      .where('bufferId')
      .anyOf(transformCacheIds)
      .delete();
    const encoder = new TextEncoder();
    const hasher = new NobleSha3HashPort();
    const tileIdsToDelete = vtTasks
      .map((task) => {
        const input = task.inputData as { bufferIds?: string[]; tileId?: number } | undefined;
        if (!input?.bufferIds?.length || typeof input.tileId !== 'number') return null;
        if (!input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId))) return null;
        const sorted = [...input.bufferIds].sort();
        const hash = hasher.digest(encoder.encode(JSON.stringify(sorted)).buffer, 'sha3-256');
        return `${input.tileId}|${hash}`;
      })
      .filter((entry): entry is string => Boolean(entry));
    for (const tileId of tileIdsToDelete) {
      await shapeMutationAPIImpl.deleteVectorTile(tileId);
    }
    if (affectedTileIds.size > 0 && tileIdsToDelete.length === 0) {
      await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    }
  }

  const tasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
  const removedSet = new Set(removedPairs.map((entry) => `${normalizeSelectionKey(entry.countryCode)}:${entry.adminLevel}`));
  const removedTaskIds = tasks
    .filter((task) => {
      const stage = task.stage ?? task.taskType;
      if (stage === 'fetch' || stage === 'transform') {
        const input = task.inputData as { countryCode?: string; adminLevel?: number } | undefined;
        if (!input?.countryCode || typeof input.adminLevel !== 'number') return false;
        return removedSet.has(`${normalizeSelectionKey(input.countryCode)}:${input.adminLevel}`);
      }
      if (stage === 'vt') {
        const input = task.inputData as { bufferIds?: string[] } | undefined;
        if (!input?.bufferIds?.length) return false;
        return input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId));
      }
      return false;
    })
    .map((task) => task.taskId);
  if (removedTaskIds.length > 0) {
    await taskQueue.tasks.bulkDelete(removedTaskIds);
  }
};

const clearTaskQueueStages = async (nodeId: NodeId, stages: Array<TaskStage>): Promise<void> => {
  if (stages.length === 0) return;
  const taskQueue = new VtTaskQueueDb();
  const uniqueStages = Array.from(new Set(stages));
  const taskRows = await Promise.all(
    uniqueStages.map((stage) => listTasksByStage(taskQueue, nodeId, stage)),
  );
  const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
  if (taskIds.length === 0) return;
  await deleteTasksByIds(taskQueue, taskIds);
};

const clearBuildTasksByStage = async (nodeId: NodeId, stages: Array<TaskStage>): Promise<void> => {
  const uniqueStages = Array.from(new Set(stages));
  if (uniqueStages.length === 0) return;
  const taskRows = await Promise.all(
    uniqueStages.map((stage) => ephemeralShapeAPIImpl.listBuildTasksByType(nodeId, stage)),
  );
  const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
  if (taskIds.length > 0) {
    await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
  }
};

const applyConfigInvalidation = async (
  nodeId: NodeId,
  prevConfig: ShapeRuntimeBuildConfig | null,
  nextConfig: ShapeRuntimeBuildConfig | null,
): Promise<void> => {
  const plan = resolveConfigInvalidationPlan(prevConfig, nextConfig);
  if (!plan.fetch && !plan.transform && !plan.vt) return;

  const stagesToClear: TaskStage[] = [];
  if (plan.fetch) {
    stagesToClear.push('fetch', 'transform', 'vt');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
  } else if (plan.transform) {
    stagesToClear.push('transform', 'vt');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
  } else if (plan.vt) {
    stagesToClear.push('vt');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
  }

  await clearBuildTasksByStage(nodeId, stagesToClear);
  await clearTaskQueueStages(nodeId, stagesToClear);

  console.warn('[shapeBuildAPI] config invalidation applied', {
    nodeId,
    fetch: plan.fetch,
    transform: plan.transform,
    vt: plan.vt,
  });
};

type StartBuildSessionScope = 'startBuildSession';

const startBuildSessionInternal = async (
  scope: StartBuildSessionScope,
  draftId: NodeId,
  buildConfig: ShapeBuildConfig,
  processingConfig: ShapeProcessingConfig | undefined,
  downloadTaskPayloads: FetchTaskPayload[],
  buildContinuationPolicy?: BuildContinuationPolicy,
  progressCallback?: (event: BuildProgressEvent) => void,
): Promise<NodeId> => {
  if (!buildConfig.dataSourceName) {
    throw new Error('Data source is required to start build processing');
  }
  let startupNodeId: NodeId = draftId;
  const startupScope = scope;
  const getStartupErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
  );
  const emitStartupStepLog = (
    phase: 'start' | 'finish',
    step: string,
    extra?: Record<string, unknown>,
  ): void => {
    void shapeMutationAPIImpl.updateBuildSession(startupNodeId, {
      stageId: `startup:${step}:${phase}`,
      stageHeartbeatAt: Date.now(),
    }).catch(() => {});
    const payload = {
      scope: startupScope,
      phase,
      step,
      draftId,
      nodeId: startupNodeId,
      ...extra,
    };
    console.warn('[shapeBuildAPI] startup', JSON.stringify(payload));
  };
  const executeStartupStep = async <T>(
    step: string,
    runner: () => Promise<T>,
    extra?: Record<string, unknown>,
  ): Promise<T> => {
    const startedAt = Date.now();
    emitStartupStepLog('start', step, extra);
    try {
      const result = await runner();
      emitStartupStepLog('finish', step, {
        ...(extra ?? {}),
        outcome: 'success',
        elapsedMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      emitStartupStepLog('finish', step, {
        ...(extra ?? {}),
        outcome: 'error',
        elapsedMs: Date.now() - startedAt,
        errorMessage: getStartupErrorMessage(error),
      });
      throw error;
    }
  };

  // Prefer persisted draft config when provided to avoid stale zoom settings.
  const handler = getShapeEntityHandler();
  const draftEntity = await executeStartupStep(
    'load-draft',
    async () => handler.getEntity(draftId),
  );
  const draftBuildConfig = draftEntity?.buildConfig;
  const draftProcessingConfig = draftEntity?.processingConfig;
  const normalizedDraftConfig = draftBuildConfig
    ? mergeBuildConfig(DEFAULT_BUILD_CONFIG, draftBuildConfig)
    : null;
  const normalizedDraftProcessingConfig = draftProcessingConfig
    ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftProcessingConfig)
    : null;
  const normalizedBuildConfig = mergeBuildConfig(DEFAULT_BUILD_CONFIG, buildConfig);
  const normalizedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    processingConfig ?? {},
  );
  const mergedBatchConfig = normalizedDraftConfig
    ? mergeBuildConfig(normalizedDraftConfig, normalizedBuildConfig)
    : normalizedBuildConfig;
  const mergedProcessingConfig = normalizedDraftProcessingConfig
    ? mergeProcessingConfig(normalizedDraftProcessingConfig, normalizedProcessingConfig)
    : normalizedProcessingConfig;
  const mergedRuntimeConfig = composeRuntimeBuildConfig(mergedBatchConfig, mergedProcessingConfig);
  const validation = validateBatchConfig(mergedBatchConfig, mergedProcessingConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
  }
  emitStartupStepLog('finish', 'resolve-runtime-config', {
    outcome: 'success',
    transformMaxConcurrent: mergedRuntimeConfig.transformConfig.maxConcurrent,
    fetchMaxConcurrent: mergedRuntimeConfig.fetchConfig.maxConcurrent,
    vtMaxConcurrent: mergedRuntimeConfig.vtConfig.maxConcurrent,
    source: {
      draftBuildConfig: Boolean(draftBuildConfig),
      payloadBuildConfig: Boolean(buildConfig),
      draftProcessingConfig: Boolean(draftProcessingConfig),
      payloadProcessingConfig: Boolean(processingConfig),
    },
  });

  // Get draft to find the associated nodeId
  if (!draftEntity) {
    throw new Error(`Working copy not found: ${draftId}`);
  }

  const selectionSummary = await executeStartupStep(
    'summarize-selection',
    async () => summarizeSelectedArrayByCountries(draftEntity.selectedArrayByCountries),
  );
  const selectedAdminPairCount = selectionSummary.selectedAdminPairCount;
  if (!downloadTaskPayloads.length && selectedAdminPairCount === 0) {
    throw new Error('Shape build session requires download task payloads or selection');
  }

  const nodeForSession = draftId;
  startupNodeId = nodeForSession;
  const pipelineKey = String(nodeForSession);
  const previousSession = await executeStartupStep(
    'load-session-record',
    async () => shapeQueryAPIImpl.getBuildSessionRecord(nodeForSession).catch(() => null),
  );
  if (activePipelines.has(pipelineKey)) {
    await clearStalePipelineStateIfInactive(
      nodeForSession,
      previousSession,
      startupScope,
    );
  }
  if (activePipelines.has(pipelineKey)) {
    setPaused(nodeForSession, false);
    await upsertBuildSessionSnapshot({
      nodeId: nodeForSession,
      status: 'running',
      canResume: false,
      stopReason: undefined,
    });
    await emitProgressSnapshot(nodeForSession, `${startupScope} ignored: pipeline already active`);
    return nodeForSession;
  }
  const fetchPlan = await executeStartupStep(
    'plan-fetch-total',
    async () => estimatePlannedFetchTotal({
      nodeId: nodeForSession,
      buildConfig: mergedRuntimeConfig,
      selectedArrayByCountries: draftEntity.selectedArrayByCountries,
      downloadTaskPayloads,
    }),
    {
      payloadCount: downloadTaskPayloads.length,
      selectedCountryCount: selectionSummary.selectedCountryCount,
      selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
    },
  );
  if ((downloadTaskPayloads.length > 0 || selectedAdminPairCount > 0) && fetchPlan.plannedFetchTotal === 0) {
    throw new Error(
      '[shapeBuildAPI] Build has selected inputs but generated 0 fetch tasks.'
      + ' Please reload country metadata and retry.',
    );
  }
  setFetchPlannedTotal(nodeForSession, fetchPlan.plannedFetchTotal);
  const buildStartedAt = Date.now();
  const pipelineRunId = `${nodeForSession}:${buildStartedAt}`;

  setPaused(nodeForSession, false);
  activePipelines.add(pipelineKey);
  activePipelineRuns.set(pipelineKey, pipelineRunId);

  try {
    const taskQueue = new VtTaskQueueDb();
    await executeStartupStep(
      'selection-diff-cleanup',
      async () => applySelectionDiffCleanup(
        nodeForSession,
        previousSession?.selectedArrayByCountries,
        draftEntity.selectedArrayByCountries,
      ),
    );
    await executeStartupStep(
      'config-invalidation',
      async () => applyConfigInvalidation(nodeForSession, null, mergedRuntimeConfig),
    );
    let existingTaskCount = await executeStartupStep(
      'count-existing-tasks',
      async () => taskQueue.tasks.where('nodeId').equals(nodeForSession).count(),
    );
    const canReuseTaskQueue = shouldReuseTaskQueueOnStart(previousSession?.status);
    if (!canReuseTaskQueue && existingTaskCount > 0) {
      await executeStartupStep(
        'clear-completed-session-task-queue',
        async () => {
          await deleteTasksByNode(taskQueue, nodeForSession);
          existingTaskCount = 0;
        },
        {
          existingTaskCount,
          previousSessionStatus: previousSession?.status ?? null,
        },
      );
    }
    if (existingTaskCount === 0 && canReuseTaskQueue) {
      await executeStartupStep(
        'seed-task-queue',
        async () => {
          await seedTaskQueueFromBuildTasks(nodeForSession);
          existingTaskCount = await taskQueue.tasks.where('nodeId').equals(nodeForSession).count();
        },
      );
    }
    const resumeExistingTasks = canReuseTaskQueue && existingTaskCount > 0;
    if (resumeExistingTasks) {
      await executeStartupStep(
        'normalize-existing-tasks',
        async () => {
          await resetRunningTasks(nodeForSession);
          await resetFailedTasks(nodeForSession);
          await normalizeTaskQueueStageFields(nodeForSession);
        },
        { existingTaskCount },
      );
    }
    const existingFetchTaskCount = await executeStartupStep(
      'count-existing-fetch-tasks',
      async () => taskQueue.tasks.where('[nodeId+stage]').equals([nodeForSession, 'fetch']).count(),
      { existingTaskCount },
    );
    const plannedFetchTotal = Math.max(fetchPlan.plannedFetchTotal, existingFetchTaskCount);
    setFetchPlannedTotal(nodeForSession, plannedFetchTotal);
    await executeStartupStep(
      'upsert-session-snapshot',
      async () => upsertBuildSessionSnapshot({
        nodeId: nodeForSession,
        draftId,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
        tasks: existingTaskCount === 0 ? [] : undefined,
        status: 'running',
        startedAt: buildStartedAt,
        canResume: false,
      }),
      { existingTaskCount, plannedFetchTotal },
    );
    const emitQueuedProgressSnapshot = async (payload: {
      nodeId: NodeId;
      stage: 'fetch';
      taskCount: number;
      source: 'created' | 'reused';
    }): Promise<void> => {
      if (payload.stage !== 'fetch') return;
      await emitProgressSnapshot(payload.nodeId, 'Fetch task plan prepared.');
    };
    emitStartupStepLog('start', 'pipeline-dispatch', {
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
      resumeExistingTasks,
    });
    const resolvedDataSource = requireDataSourceName(
      mergedRuntimeConfig.dataSourceName,
      startupScope,
    );
    startSessionTracking(nodeForSession);
    console.warn(`[shapeBuildAPI] ${startupScope} pipeline start`, {
      nodeId: nodeForSession,
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
    });
    void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
      stageId: 'startup:pipeline-dispatch:start',
      stageHeartbeatAt: Date.now(),
    }).catch(() => {});
    let terminalProgressMessage: string | undefined;
    void runShapePipeline({
      nodeId: nodeForSession,
      dataSource: resolvedDataSource,
      buildConfig: mergedRuntimeConfig,
      selectedArrayByCountries: draftEntity.selectedArrayByCountries,
      downloadTaskPayloads,
      waitIfPaused: () => waitIfPaused(nodeForSession),
      buildContinuationPolicy,
      resumeExistingTasks,
      pipelineRunId,
      onTasksEnqueued: emitQueuedProgressSnapshot,
    }).then(async () => {
      const completedAt = Date.now();
      terminalProgressMessage = undefined;
      const taskQueue = new VtTaskQueueDb();
      const tasks = await listTasks(taskQueue, nodeForSession);
      const terminalTaskStatus = summarizeTaskQueueStatus(tasks).status;
      const pipelineFinishedWithFailure = terminalTaskStatus === 'failed';
      void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
        stageId: pipelineFinishedWithFailure
          ? 'startup:pipeline-dispatch:error'
          : 'startup:pipeline-dispatch:success',
        stageHeartbeatAt: completedAt,
      }).catch(() => {});
      await updateBuildSessionFromTasks(nodeForSession, {
        status: pipelineFinishedWithFailure ? 'failed' : 'completed',
        stopReason: pipelineFinishedWithFailure ? 'failed' : 'completed',
        completedAt,
        canResume: false,
      });
      if (pipelineFinishedWithFailure) {
        terminalProgressMessage = 'Pipeline finished with failed tasks.';
      }
    }).catch(async (error) => {
      const failedAt = Date.now();
      const diagnostics = toErrorDiagnostics(error);
      console.error('[shapeBuildAPI] vt pipeline failed', error);
      console.error('[shapeBuildAPI] startup', JSON.stringify({
        scope: startupScope,
        phase: 'finish',
        step: 'pipeline-run',
        nodeId: nodeForSession,
        runId: pipelineRunId,
        outcome: 'error',
        failedAt,
        ...diagnostics,
      }));
      terminalProgressMessage = `Pipeline failed (${diagnostics.errorName ?? 'Error'}): ${diagnostics.errorMessage}`;
      void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
        stageId: 'startup:pipeline-dispatch:error',
        stageHeartbeatAt: failedAt,
      }).catch(() => {});
      await updateBuildSessionFromTasks(nodeForSession, {
        status: 'failed',
        stopReason: 'failed',
        completedAt: failedAt,
        canResume: false,
      });
    }).finally(() => {
      clearActivePipelineRuntimeState(nodeForSession);
      void emitProgressSnapshot(nodeForSession, terminalProgressMessage);
    });
    emitStartupStepLog('finish', 'pipeline-dispatch', {
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
      resumeExistingTasks,
      outcome: 'success',
    });
  } catch (error) {
    if (activePipelineRuns.get(pipelineKey) === pipelineRunId) {
      clearActivePipelineRuntimeState(nodeForSession);
    }
    throw error;
  }

  if (progressCallback) {
    const existing = progressCallbacks.get(String(nodeForSession));
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    const unsubscribe = onTaskQueueUpdate(nodeForSession, (event) => {
      if (event.type === 'delete') {
        return;
      }
      void (async () => {
        try {
          const vtTasks = await listTasks(taskQueue, event.nodeId);
          progressCallback({
            nodeId: event.nodeId,
            stage: event.task.stage,
            phase: resolveProgressPhase(event.nodeId, vtTasks),
            timestamp: Date.now(),
            message: event.task.errorMessage,
            payload: await buildProgressPayloadFromTasks(event.nodeId, vtTasks, {
              eventTask: event.task,
              source: 'event',
            }),
          });
        } catch (error) {
          console.error('[shapeBuildAPI] progress payload build failed', error);
        }
      })();
    });
    progressCallbacks.set(String(nodeForSession), { unsubscribe, callback: progressCallback });
  }

  return nodeForSession;
};

const normalizeTaskQueueStageFields = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const patches: Array<{ taskId: string; updates: { taskType?: TaskQueueRecord['stage']; stage?: TaskQueueRecord['stage'] } }> = [];
  await taskQueue.tasks.where('nodeId').equals(nodeId).each((record) => {
    if (!record || typeof record !== 'object') return;
    const taskId = (record as { taskId?: unknown }).taskId;
    if (typeof taskId !== 'string' || taskId.length === 0) return;
    const taskType = (record as { taskType?: unknown }).taskType;
    const stage = (record as { stage?: unknown }).stage;
    const normalizedStage = isTaskStageValue(stage)
      ? stage
      : isTaskStageValue(taskType)
        ? taskType
        : undefined;
    if (!normalizedStage) return;
    const updates: { taskType?: TaskQueueRecord['stage']; stage?: TaskQueueRecord['stage'] } = {};
    if (!isTaskStageValue(taskType)) updates.taskType = normalizedStage;
    if (!isTaskStageValue(stage)) updates.stage = normalizedStage;
    if (Object.keys(updates).length > 0) {
      patches.push({ taskId, updates });
    }
  });
  if (patches.length === 0) return;
  const debugTag = 'normalize-task-queue-2026-02-09-0334';
  const startedAt = Date.now();
  console.warn('[shapeBuildAPI][TaskDebug] normalizeTaskQueueStageFields start', {
    tag: debugTag,
    nodeId,
    patchCount: patches.length,
  });
  let waitTimer: ReturnType<typeof setInterval> | null = null;
  waitTimer = setInterval(() => {
    console.warn('[shapeBuildAPI][TaskDebug] normalizeTaskQueueStageFields waiting', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  }, 5000);
  try {
    await Promise.all(patches.map((patch) => taskQueue.tasks.update(patch.taskId, patch.updates)));
    console.warn('[shapeBuildAPI][TaskDebug] normalizeTaskQueueStageFields done', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  } finally {
    if (waitTimer) clearInterval(waitTimer);
  }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const asRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const waitForRunningTasksToDrain = async (
  nodeId: NodeId,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<{ drained: boolean; elapsedMs: number; running: number; queued: number; total: number }> => {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const pollMs = options?.pollMs ?? 100;
  const startedAt = Date.now();
  const taskQueue = new VtTaskQueueDb();
  let latest = await countTaskQueueStatuses(taskQueue, nodeId);
  while (latest.running > 0 && Date.now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    latest = await countTaskQueueStatuses(taskQueue, nodeId);
  }
  return {
    drained: latest.running === 0,
    elapsedMs: Date.now() - startedAt,
    running: latest.running,
    queued: Math.max(0, latest.total - latest.completed - latest.failed - latest.running),
    total: latest.total,
  };
};

const resetRunningTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
  if (runningTasks.length === 0) return;
  await Promise.all(runningTasks.map((task) => (
    updateTask(taskQueue, task.taskId, {
      status: 'queued',
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      errorMessage: undefined,
      display: undefined,
      message: undefined,
      outputData: undefined,
    }, { allowTerminalStatusTransition: true })
  )));
};


const resetFailedTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const failedTasks = await listTasksByStatus(taskQueue, nodeId, 'failed');
  if (failedTasks.length === 0) return;
  await Promise.all(failedTasks.map((task) => (
    updateTask(taskQueue, task.taskId, {
      status: 'queued',
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      errorMessage: undefined,
      display: undefined,
      message: undefined,
      outputData: undefined,
    }, { allowTerminalStatusTransition: true })
  )));
};
const invokeShapeBuildCommand = async (
  command: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  if (command === 'session/pause') {
    const nodeId = payload.nodeId as NodeId;
    if (!nodeId) throw new Error('[shapeBuildAPI] session/pause requires nodeId');
    const rawStopReason = typeof payload.stopReason === 'string' ? payload.stopReason : undefined;
    const stopReason = rawStopReason && isStopReason(rawStopReason) ? rawStopReason : undefined;
    console.warn('[shapeBuildAPI][PauseTrace] pause-requested', {
      nodeId,
      stopReason: stopReason ?? null,
    });
    setPaused(nodeId, true);
    await resetRunningTasks(nodeId);
    void (async () => {
      try {
        const initialDrain = await waitForRunningTasksToDrain(nodeId, { timeoutMs: 3_000 });
        if (initialDrain.running > 0) {
          console.warn('[shapeBuildAPI][PauseTrace] pause-requeue-not-complete', {
            nodeId,
            ...initialDrain,
          });
        }
        await upsertBuildSessionSnapshot({
          nodeId,
          status: 'idle',
          stopReason,
          canResume: true,
        });
        await emitProgressSnapshot(nodeId, 'Pause requested.');
        const drain = await waitForRunningTasksToDrain(nodeId);
        console.warn('[shapeBuildAPI][PauseTrace] pause-settled', {
          nodeId,
          ...drain,
        });
        if (!drain.drained) {
          await emitProgressSnapshot(
            nodeId,
            `Pause requested; waiting for ${drain.running} running task(s) to reach a pause point.`
          );
        }
      } catch (error) {
        console.warn('[shapeBuildAPI][PauseTrace] pause-settle-monitor-failed', {
          nodeId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return;
  }

  if (command === 'session/cancel-queued') {
    const nodeId = payload.nodeId as NodeId;
    if (!nodeId) throw new Error('[shapeBuildAPI] session/cancel-queued requires nodeId');
    const rawStopReason = typeof payload.stopReason === 'string' ? payload.stopReason : undefined;
    const stopReason = rawStopReason && isStopReason(rawStopReason) ? rawStopReason : 'user-pause';
    const pipelineKey = String(nodeId);
    if (activePipelines.has(pipelineKey)) {
      await invokeShapeBuildCommand('session/pause', { nodeId, stopReason });
      return;
    }
    setPaused(nodeId, false);
    setFetchPlannedTotal(nodeId, 0);
    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await upsertBuildSessionSnapshot({
      nodeId,
      status: 'idle',
      stopReason,
      canResume: false,
    });
    await emitProgressSnapshot(nodeId, 'Queued build canceled.');
    return;
  }

  if (command === 'session/resume') {
    const nodeId = payload.nodeId as NodeId;
    if (!nodeId) throw new Error('[shapeBuildAPI] session/resume requires nodeId');
    const buildContinuationPolicy = payload.buildContinuationPolicy as BuildContinuationPolicy | undefined;
    const payloadBuildConfig = asRecordOrNull(payload.buildConfig) as Partial<ShapeBuildConfig> | null;
    const payloadProcessingConfig = asRecordOrNull(payload.processingConfig) as Partial<ShapeProcessingConfig> | null;
    const pipelineKey = String(nodeId);
    let sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
    const resumeScope = 'resumeBuildSession';
    const getResumeErrorMessage = (error: unknown): string => (
      error instanceof Error ? error.message : String(error)
    );
    const emitResumeStepLog = (
      phase: 'start' | 'finish',
      step: string,
      extra?: Record<string, unknown>,
    ): void => {
      void shapeMutationAPIImpl.updateBuildSession(nodeId, {
        stageId: `startup:${step}:${phase}`,
        stageHeartbeatAt: Date.now(),
      }).catch(() => {});
      console.warn('[shapeBuildAPI] startup', JSON.stringify({
        scope: resumeScope,
        phase,
        step,
        nodeId,
        ...extra,
      }));
    };
    const executeResumeStep = async <T>(
      step: string,
      runner: () => Promise<T>,
      extra?: Record<string, unknown>,
    ): Promise<T> => {
      const startedAt = Date.now();
      emitResumeStepLog('start', step, extra);
      try {
        const result = await runner();
        emitResumeStepLog('finish', step, {
          ...(extra ?? {}),
          outcome: 'success',
          elapsedMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        emitResumeStepLog('finish', step, {
          ...(extra ?? {}),
          outcome: 'error',
          elapsedMs: Date.now() - startedAt,
          errorMessage: getResumeErrorMessage(error),
        });
        throw error;
      }
    };

    if (activePipelines.has(pipelineKey)) {
      await clearStalePipelineStateIfInactive(
        nodeId,
        sessionRecord,
        'resumeBuildSession',
      );
    }
    setPaused(nodeId, false);
    await executeResumeStep('emit-progress-snapshot', async () => emitProgressSnapshot(nodeId));
    const taskQueue = new VtTaskQueueDb();
    const runningTaskCount = await executeResumeStep(
      'count-running-tasks',
      async () => taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'running']).count(),
    );
    if (runningTaskCount > 0) {
      await executeResumeStep(
        'reset-running-tasks',
        async () => resetRunningTasks(nodeId),
        { runningTaskCount },
      );
      if (activePipelines.has(pipelineKey)) {
        clearActivePipelineRuntimeState(nodeId);
      }
    }
    await executeResumeStep('reset-failed-tasks', async () => resetFailedTasks(nodeId));
    let existingTaskCount = await executeResumeStep(
      'count-existing-tasks',
      async () => taskQueue.tasks.where('nodeId').equals(nodeId).count(),
    );
    if (existingTaskCount === 0) {
      await executeResumeStep(
        'seed-task-queue',
        async () => {
          await seedTaskQueueFromBuildTasks(nodeId);
          existingTaskCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
        },
      );
    }
    if (existingTaskCount > 0) {
      await executeResumeStep(
        'normalize-existing-tasks',
        async () => normalizeTaskQueueStageFields(nodeId),
        { existingTaskCount },
      );
    }
    if (activePipelines.has(pipelineKey)) {
      await emitProgressSnapshot(nodeId, 'resumeBuildSession ignored: pipeline already active');
      return;
    }

    const handler = getShapeEntityHandler();
    const draftEntity = await executeResumeStep('load-draft', async () => handler.getEntity(nodeId));
    if (!draftEntity) return;
    if (!sessionRecord) {
      sessionRecord = await executeResumeStep(
        'load-session-record',
        async () => shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null),
      );
    }
    const draftBuildConfig = draftEntity.buildConfig;
    const draftProcessingConfig = draftEntity.processingConfig;
    const normalizedDraftConfig = draftBuildConfig
      ? mergeBuildConfig(DEFAULT_BUILD_CONFIG, draftBuildConfig)
      : null;
    const normalizedPayloadConfig = payloadBuildConfig
      ? mergeBuildConfig(DEFAULT_BUILD_CONFIG, payloadBuildConfig)
      : null;
    const mergedBuildConfig = normalizedDraftConfig
      ? (normalizedPayloadConfig
        ? mergeBuildConfig(normalizedDraftConfig, normalizedPayloadConfig)
        : normalizedDraftConfig)
      : normalizedPayloadConfig;
    if (!mergedBuildConfig) {
      throw new Error('[shapeBuildAPI] buildConfig is required to resume build session');
    }
    const normalizedDraftProcessingConfig = draftProcessingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftProcessingConfig)
      : null;
    const normalizedPayloadProcessingConfig = payloadProcessingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, payloadProcessingConfig)
      : null;
    const normalizedProcessingConfig = normalizedDraftProcessingConfig
      ? (normalizedPayloadProcessingConfig
        ? mergeProcessingConfig(normalizedDraftProcessingConfig, normalizedPayloadProcessingConfig)
        : normalizedDraftProcessingConfig)
      : (normalizedPayloadProcessingConfig ?? DEFAULT_PROCESSING_CONFIG);
    const mergedRuntimeConfig = composeRuntimeBuildConfig(mergedBuildConfig, normalizedProcessingConfig);
    emitResumeStepLog('finish', 'resolve-runtime-config', {
      outcome: 'success',
      transformMaxConcurrent: mergedRuntimeConfig.transformConfig.maxConcurrent,
      fetchMaxConcurrent: mergedRuntimeConfig.fetchConfig.maxConcurrent,
      vtMaxConcurrent: mergedRuntimeConfig.vtConfig.maxConcurrent,
      source: {
        draftBuildConfig: Boolean(draftBuildConfig),
        payloadBuildConfig: Boolean(payloadBuildConfig),
        draftProcessingConfig: Boolean(draftProcessingConfig),
        payloadProcessingConfig: Boolean(payloadProcessingConfig),
      },
    });
    const selectionSummary = await executeResumeStep(
      'summarize-selection',
      async () => summarizeSelectedArrayByCountries(draftEntity.selectedArrayByCountries),
      { existingTaskCount },
    );
    const fetchPlan = await executeResumeStep(
      'plan-fetch-total',
      async () => estimatePlannedFetchTotal({
        nodeId,
        buildConfig: mergedRuntimeConfig,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
      }),
      {
        existingTaskCount,
        selectedCountryCount: selectionSummary.selectedCountryCount,
        selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      },
    );
    const selectedAdminPairCount = selectionSummary.selectedAdminPairCount;
    if (existingTaskCount === 0 && selectedAdminPairCount === 0) {
      throw new Error('[shapeBuildAPI] Resume requires selected countries/admin levels or existing queued tasks.');
    }
    if (existingTaskCount === 0 && selectedAdminPairCount > 0 && fetchPlan.plannedFetchTotal === 0) {
      throw new Error(
        '[shapeBuildAPI] Resume has selected inputs but generated 0 fetch tasks.'
        + ' Please reload country metadata and retry.',
      );
    }
    setFetchPlannedTotal(nodeId, fetchPlan.plannedFetchTotal);
    await executeResumeStep(
      'selection-diff-cleanup',
      async () => applySelectionDiffCleanup(
        nodeId,
        sessionRecord?.selectedArrayByCountries,
        draftEntity.selectedArrayByCountries,
      ),
    );
    await executeResumeStep(
      'config-invalidation',
      async () => applyConfigInvalidation(nodeId, null, mergedRuntimeConfig),
    );
    existingTaskCount = await executeResumeStep(
      'count-existing-tasks-after-invalidation',
      async () => taskQueue.tasks.where('nodeId').equals(nodeId).count(),
    );
    if (existingTaskCount === 0) {
      await executeResumeStep(
        'seed-task-queue-after-invalidation',
        async () => {
          await seedTaskQueueFromBuildTasks(nodeId);
          existingTaskCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
        },
      );
    }
    const existingFetchTaskCount = await executeResumeStep(
      'count-existing-fetch-tasks-after-invalidation',
      async () => taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'fetch']).count(),
      { existingTaskCount },
    );
    const plannedFetchTotal = Math.max(fetchPlan.plannedFetchTotal, existingFetchTaskCount);
    setFetchPlannedTotal(nodeId, plannedFetchTotal);
    const resolvedDataSource = requireDataSourceName(
      mergedRuntimeConfig.dataSourceName,
      'resumeBuildSession',
    );
    const pipelineRunId = `${nodeId}:${Date.now()}`;
    await executeResumeStep(
      'upsert-session-snapshot',
      async () => upsertBuildSessionSnapshot({
        nodeId,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
        tasks: existingTaskCount === 0 ? [] : undefined,
        status: 'running',
        startedAt: Date.now(),
        canResume: false,
      }),
      { existingTaskCount, plannedFetchTotal },
    );
    const emitQueuedProgressSnapshot = async (snapshot: {
      nodeId: NodeId;
      stage: 'fetch';
      taskCount: number;
      source: 'created' | 'reused';
    }): Promise<void> => {
      if (snapshot.stage !== 'fetch') return;
      await emitProgressSnapshot(snapshot.nodeId, 'Fetch task plan prepared.');
    };
    emitResumeStepLog('start', 'pipeline-dispatch', {
      runId: pipelineRunId,
      existingTaskCount,
    });
    startSessionTracking(nodeId);
    activePipelines.add(pipelineKey);
    activePipelineRuns.set(pipelineKey, pipelineRunId);
    console.warn('[shapeBuildAPI] resumeBuildSession pipeline start', {
      nodeId,
      runId: pipelineRunId,
    });
    void shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stageId: 'startup:pipeline-dispatch:start',
      stageHeartbeatAt: Date.now(),
    }).catch(() => {});
    let terminalProgressMessage: string | undefined;
    void runShapePipeline({
      nodeId,
      dataSource: resolvedDataSource,
      buildConfig: mergedRuntimeConfig,
      selectedArrayByCountries: draftEntity.selectedArrayByCountries,
      waitIfPaused: () => waitIfPaused(nodeId),
      resumeExistingTasks: true,
      buildContinuationPolicy,
      pipelineRunId,
      onTasksEnqueued: emitQueuedProgressSnapshot,
    }).then(async () => {
      const completedAt = Date.now();
      terminalProgressMessage = undefined;
      const tasks = await listTasks(taskQueue, nodeId);
      const terminalTaskStatus = summarizeTaskQueueStatus(tasks).status;
      const pipelineFinishedWithFailure = terminalTaskStatus === 'failed';
      void shapeMutationAPIImpl.updateBuildSession(nodeId, {
        stageId: pipelineFinishedWithFailure
          ? 'startup:pipeline-dispatch:error'
          : 'startup:pipeline-dispatch:success',
        stageHeartbeatAt: completedAt,
      }).catch(() => {});
      await updateBuildSessionFromTasks(nodeId, {
        status: pipelineFinishedWithFailure ? 'failed' : 'completed',
        stopReason: pipelineFinishedWithFailure ? 'failed' : 'completed',
        completedAt,
        canResume: false,
      });
      if (pipelineFinishedWithFailure) {
        terminalProgressMessage = 'Pipeline finished with failed tasks.';
      }
    }).catch(async (error) => {
      const failedAt = Date.now();
      const diagnostics = toErrorDiagnostics(error);
      console.error('[shapeBuildAPI] vt pipeline failed', error);
      console.error('[shapeBuildAPI] startup', JSON.stringify({
        scope: resumeScope,
        phase: 'finish',
        step: 'pipeline-run',
        nodeId,
        runId: pipelineRunId,
        outcome: 'error',
        failedAt,
        ...diagnostics,
      }));
      terminalProgressMessage = `Pipeline failed (${diagnostics.errorName ?? 'Error'}): ${diagnostics.errorMessage}`;
      void shapeMutationAPIImpl.updateBuildSession(nodeId, {
        stageId: 'startup:pipeline-dispatch:error',
        stageHeartbeatAt: failedAt,
      }).catch(() => {});
      await updateBuildSessionFromTasks(nodeId, {
        status: 'failed',
        stopReason: 'failed',
        completedAt: failedAt,
        canResume: false,
      });
    }).finally(() => {
      clearActivePipelineRuntimeState(nodeId);
      void emitProgressSnapshot(nodeId, terminalProgressMessage);
    });
    emitResumeStepLog('finish', 'pipeline-dispatch', {
      runId: pipelineRunId,
      existingTaskCount,
      outcome: 'success',
    });
    return;
  }

  throw new Error(`[shapeBuildAPI] Unknown build command: ${command}`);
};

const toErrorDiagnostics = (error: unknown): {
  errorMessage: string;
  errorName?: string;
  errorStack?: string;
} => {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
    };
  }
  return {
    errorMessage: String(error),
  };
};

export const shapeBuildRuntimeExecutionControl = {
  startBuildSessionInternal,
  invokeShapeBuildCommand,
} as const;

export type ShapeBuildRuntimeExecutionControl = typeof shapeBuildRuntimeExecutionControl;
