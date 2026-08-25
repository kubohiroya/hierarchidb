/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import { AuthRequiredError, AuthService } from '@hierarchidb/auth';
import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord, ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type {
  ShapeBuildConfig,
  ShapeProcessingConfig,
  ShapeRuntimeBuildConfig,
} from '~/common/types/BuildTaskResult';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '~/common/types/constants';
import type {
  CountryMetadata,
  DataSourceName,
  SourceTaskPayload,
} from '~/common/types/data-source';
import { requireDataSourceName } from '~/common/types/data-source';
import type { SelectedArrayByCountries } from '~/common/types/ShapeEntity';
import { resolveSourceStageStrategy } from '~/services/build/strategies/resolveSourceStageStrategy';
import { cacheValidator } from '~/services/CacheValidator';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import {
  applyBuildConfigPatch,
  assertShapeBuildConfigTileEmitContract,
  composeRuntimeBuildConfig,
  countSelectedAdminPairs,
  mergeProcessingConfig,
  validateBuildConfig,
} from '~/services/utils/shapeBuildUtils';
import {
  emitHeartbeat,
  emitSessionLifecyclePhaseUpdated,
  emitSessionStatusUpdated,
  emitStageSnapshotUpdated,
  readStartedStageTiming,
} from './eventEmissionConstantsUtils.js';

// Custom error types for better error classification
class SourceTaskPayloadGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceTaskPayloadGenerationError';
  }
}

export const SHAPE_PIPELINE_SHUTDOWN_TIMEOUT_MS = 15_000;

export class ShapeBuildPauseShutdownTimeoutError extends Error {
  readonly code = 'SHAPE_BUILD_PAUSE_SHUTDOWN_TIMEOUT';

  constructor(
    readonly nodeId: NodeId,
    readonly runId: string,
    readonly timeoutMs: number
  ) {
    super(
      `[shapeBuildAPI] Pipeline shutdown timed out after ${timeoutMs}ms: ${String(nodeId)}:${runId}`
    );
    this.name = 'ShapeBuildPauseShutdownTimeoutError';
  }
}

export class ShapeBuildPauseActivePipelineMissingError extends Error {
  readonly code = 'SHAPE_BUILD_PAUSE_ACTIVE_PIPELINE_MISSING';

  constructor(readonly nodeId: NodeId) {
    super(`[shapeBuildAPI] Active pipeline is required to pause session: ${String(nodeId)}`);
    this.name = 'ShapeBuildPauseActivePipelineMissingError';
  }
}

export class ShapeBuildResumeContractError extends Error {
  readonly code = 'SHAPE_BUILD_RESUME_CONTRACT';

  constructor(
    readonly nodeId: NodeId,
    message: string
  ) {
    super(`[shapeBuildAPI] ${message}: ${String(nodeId)}`);
    this.name = 'ShapeBuildResumeContractError';
  }
}

const createActivePipelineAlreadyExistsError = (nodeId: NodeId, runId: string): Error => {
  const error = new Error(
    `[shapeBuildAPI] active pipeline already exists: ${String(nodeId)}:${runId}`
  );
  error.name = 'ShapeBuildActivePipelineAlreadyExistsError';
  return error;
};

import type { BuildSessionConfig } from '@hierarchidb/shape-store';
import {
  deleteTasksByNode,
  listTasks,
  listTasksByStatus,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import {
  ephemeralShapeAPIImpl,
  shapeMutationAPIImpl,
  shapeQueryAPIImpl,
} from '~/services/build/ShapeBuildAPIClient';
import { runShapeArtifactCascadeCleanup } from '~/services/vt/runShapeArtifactCascadeCleanup';
import { runShapePipeline } from '~/services/vt/runShapePipeline';
import { setSourcePlannedTotal } from '~/services/vt/shapeProgressPlanUtils';
import { shouldReuseTaskQueueOnStart } from '../shouldReuseTaskQueueOnStart.js';
import { summarizeTaskQueueStatus } from './progressAnalysis.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';
import {
  finalizePipelineOutcome,
  persistFailureAndRethrow,
} from './shapeBuildRuntimeFailureHandlingUtils.js';

// Available functions from the new structure
const {
  countTaskQueueStatuses,
  setPaused,
  waitIfPaused,
  getShapeEntityHandler,
  registerActivePipeline,
  clearActivePipeline,
  getActivePipeline,
  invalidateActivePipeline,
  isActivePipelineRunCurrent,
} = shapeBuildRuntimeCore;

// Placeholder functions for missing implementations
const startSessionTracking = (_nodeId: string) => {};
const clearStalePipelineStateIfInactive = (
  _nodeId: string,
  _previousSession?: ShapeBuildSessionRecord,
  _startupScope?: string
) => {};
const clearBuildSessionAuthContext = (): void => {
  AuthService.getSingleton()
    .then((auth) => auth.clearBuildSessionContext())
    .catch(() => {});
};
const clearActivePipelineRuntimeState = (nodeId: NodeId, runId: string): void => {
  if (!clearActivePipeline(nodeId, runId)) return;
  clearBuildSessionAuthContext();
};

const requirePausedHeartbeatAt = (
  status: ShapeBuildSessionRecord['status'] | undefined,
  lastHeartbeatAt: number | undefined
): void => {
  if (status !== 'paused') return;
  if (
    typeof lastHeartbeatAt !== 'number' ||
    !Number.isFinite(lastHeartbeatAt) ||
    lastHeartbeatAt < 0
  ) {
    throw new Error('[shapeBuildAPI] lastHeartbeatAt is required for paused status');
  }
};

const upsertBuildSessionSnapshot = async (data: {
  nodeId: NodeId;
  status?: ShapeBuildSessionRecord['status'];
  stopReason?: ShapeBuildStopReason;
  canResume?: boolean;
  startedAt?: number;
  completedAt?: number;
  lastHeartbeatAt?: number;
  selectedArrayByCountries?: SelectedArrayByCountries;
}): Promise<void> => {
  requirePausedHeartbeatAt(data.status, data.lastHeartbeatAt);
  const currentSession =
    data.startedAt === undefined
      ? await shapeQueryAPIImpl.getBuildSessionRecord(data.nodeId)
      : null;
  if (!currentSession || data.startedAt !== undefined) {
    if (data.status === undefined) {
      throw new Error('[shapeBuildAPI] status is required to create a build session');
    }
    if (data.startedAt === undefined || !Number.isFinite(data.startedAt) || data.startedAt < 0) {
      throw new Error('[shapeBuildAPI] startedAt is required to create a build session');
    }
    if (
      (data.status === 'completed' || data.status === 'failed') &&
      (data.completedAt === undefined ||
        !Number.isFinite(data.completedAt) ||
        data.completedAt < data.startedAt)
    ) {
      throw new Error(
        `[shapeBuildAPI] completedAt is required for terminal build session: ${data.status}`
      );
    }
    await shapeMutationAPIImpl.upsertBuildSession({
      nodeId: data.nodeId,
      status: data.status,
      selectedArrayByCountries: data.selectedArrayByCountries,
      startedAt: data.startedAt,
      updatedAt: data.completedAt ?? data.lastHeartbeatAt ?? data.startedAt,
      completedAt: data.completedAt,
      lastHeartbeatAt: data.lastHeartbeatAt,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
      stopReason: data.stopReason,
      canResume: data.canResume,
    });
  } else {
    await shapeMutationAPIImpl.updateBuildSession(data.nodeId, {
      status: data.status,
      stopReason: data.stopReason,
      canResume: data.canResume,
      completedAt: data.completedAt,
      lastHeartbeatAt: data.lastHeartbeatAt,
    });
  }

  if (data.lastHeartbeatAt !== undefined) {
    emitHeartbeat(data.nodeId, data.lastHeartbeatAt);
  }

  // Emit sessionStatusUpdated unconditionally after DB write.
  // Re-read the record so all fields (stageId, stageStartedAt, etc.) are current.
  // If the record is unavailable, emit with the known status directly to avoid
  // silently dropping the event (the previous "if (newSessionRecord)" guard was
  // the root cause of lifecycle.phase staying 'idle').
  if (data.status) {
    const newSessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(data.nodeId);
    if (!newSessionRecord) {
      throw new Error(
        `[shapeBuildAPI] build session record is missing after update: ${String(data.nodeId)}`
      );
    }
    emitSessionStatusUpdated(data.nodeId, newSessionRecord);
  }
};

const updateBuildSessionFromTasks = async (
  nodeId: NodeId,
  data: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    completedAt?: number;
    lastHeartbeatAt?: number;
    canResume?: boolean;
  },
  requireCurrentPipelineRun?: () => void
): Promise<void> => {
  requirePausedHeartbeatAt(data.status, data.lastHeartbeatAt);
  requireCurrentPipelineRun?.();
  await shapeMutationAPIImpl.updateBuildSession(nodeId, {
    status: data.status,
    stopReason: data.stopReason,
    completedAt: data.completedAt,
    lastHeartbeatAt: data.lastHeartbeatAt,
    canResume: data.canResume,
  });
  requireCurrentPipelineRun?.();

  if (data.lastHeartbeatAt !== undefined) {
    emitHeartbeat(nodeId, data.lastHeartbeatAt);
  }

  if (data.status) {
    const newSessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    requireCurrentPipelineRun?.();
    if (!newSessionRecord) {
      throw new Error(
        `[shapeBuildAPI] build session record is missing after task update: ${String(nodeId)}`
      );
    }
    emitSessionStatusUpdated(nodeId, newSessionRecord);
  }
};

const requireResumablePausedSessionStartedAt = (
  nodeId: NodeId,
  previousSession: ShapeBuildSessionRecord
): number => {
  if (previousSession.canResume !== true) {
    throw new ShapeBuildResumeContractError(
      nodeId,
      'paused build session is not explicitly resumable'
    );
  }
  if (
    typeof previousSession.startedAt !== 'number' ||
    !Number.isFinite(previousSession.startedAt) ||
    previousSession.startedAt < 0
  ) {
    throw new ShapeBuildResumeContractError(
      nodeId,
      'paused build session is missing a valid startedAt'
    );
  }
  return previousSession.startedAt;
};

const initializeAndReadStageTiming = async (
  nodeId: NodeId,
  stage: TaskStage,
  requireCurrentPipelineRun: () => void
): Promise<{ stageStartedAt: number; stageInactiveMs: number }> => {
  requireCurrentPipelineRun();
  let sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
  requireCurrentPipelineRun();
  if (!sessionRecord) {
    throw new Error(
      `[shapeBuildAPI] build session record is missing before stage snapshot: ${String(nodeId)}`
    );
  }
  const currentTiming = readStartedStageTiming(sessionRecord);
  if (currentTiming?.stage !== stage) {
    const stageStartedAt = Date.now();
    requireCurrentPipelineRun();
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      stageId: stage,
      stageStartedAt,
      stageInactiveMs: 0,
      stages: {
        [stage]: { status: 'running' },
      },
    });
    requireCurrentPipelineRun();
    sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    requireCurrentPipelineRun();
    if (!sessionRecord) {
      throw new Error(
        `[shapeBuildAPI] build session record is missing after stage start: ${String(nodeId)}`
      );
    }
  }
  const timing = readStartedStageTiming(sessionRecord, stage);
  if (!timing) {
    throw new Error(
      `[shapeBuildAPI] stage timing is missing after stage start: ${String(nodeId)}:${stage}`
    );
  }
  return {
    stageStartedAt: timing.stageStartedAt,
    stageInactiveMs: timing.stageInactiveMs,
  };
};

type TaskStage = 'source' | 'geometry' | 'tileEmit';

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
  const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig'
  );

  return {
    dataSource: resolvedDataSource,
    sourceConfig: buildConfig.sourceConfig,
    geometryConfig: buildConfig.geometryConfig,
    vectorTiles: buildConfig.tileEmitConfig,
    borderGeometryConfig: buildConfig.borderGeometryConfig,
  };
};

const buildSourceStageOptions = (buildConfig: ShapeRuntimeBuildConfig) => ({
  timeoutMs: buildConfig.sourceConfig.timeoutMs,
  retryAttempts: buildConfig.sourceConfig.retryAttempts,
  retryDelay: buildConfig.sourceConfig.retryDelay,
});

const summarizeSelectedArrayByCountries = (
  selectedArrayByCountries: SelectedArrayByCountries | undefined
): { selectedCountryCount: number; selectedAdminPairCount: number } => {
  if (
    !selectedArrayByCountries ||
    typeof selectedArrayByCountries !== 'object' ||
    Array.isArray(selectedArrayByCountries)
  ) {
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

const resolveSourceTaskPayloadsForPlan = async (input: {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
}): Promise<SourceTaskPayload[]> => {
  console.warn('[shapeBuildAPI] resolveSourceTaskPayloadsForPlan start', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
    hasDownloadTaskPayloads: Boolean(input.downloadTaskPayloads?.length),
    downloadTaskPayloadsCount: input.downloadTaskPayloads?.length ?? 0,
    hasSelectedArrayByCountries: Boolean(input.selectedArrayByCountries),
    selectedArrayByCountriesKeys: input.selectedArrayByCountries
      ? Object.keys(input.selectedArrayByCountries)
      : [],
  });

  if (input.downloadTaskPayloads && input.downloadTaskPayloads.length > 0) {
    console.warn('[shapeBuildAPI] using provided downloadTaskPayloads', {
      nodeId: input.nodeId,
      payloadCount: input.downloadTaskPayloads.length,
    });
    return input.downloadTaskPayloads;
  }
  if (!input.selectedArrayByCountries) {
    console.warn('[shapeBuildAPI] no selectedArrayByCountries, returning empty payloads', {
      nodeId: input.nodeId,
    });
    return [];
  }
  const strategy = resolveSourceStageStrategy(input.dataSource);
  const selectedAdminPairCount = countSelectedAdminPairs(input.selectedArrayByCountries);
  console.warn('[shapeBuildAPI] selectedAdminPairCount calculated', {
    nodeId: input.nodeId,
    selectedAdminPairCount,
    selectedArrayByCountriesSample: Object.fromEntries(
      Object.entries(input.selectedArrayByCountries)
        .slice(0, 3)
        .map(([key, value]) => [
          key,
          Array.isArray(value) ? `Array(${value.length})` : typeof value,
        ])
    ),
  });

  const buildPayloads = (countryMetadata: CountryMetadata[]): SourceTaskPayload[] => {
    console.warn('[shapeBuildAPI] building payloads from metadata', {
      nodeId: input.nodeId,
      metadataCount: countryMetadata.length,
      metadataSample: countryMetadata.slice(0, 2).map((meta) => ({
        countryCode: meta.countryCode,
        adminLevels: meta.availableAdminLevels?.length ?? 0,
      })),
    });
    const payloads = strategy.buildSourceTaskPayloads({
      selectedArrayByCountries: input.selectedArrayByCountries,
      countryMetadata,
    });
    console.warn('[shapeBuildAPI] payloads built from metadata', {
      nodeId: input.nodeId,
      payloadCount: payloads.length,
      payloadSample: payloads.slice(0, 2).map((payload) => ({
        countryCode: payload.countryCode,
        adminLevel: payload.adminLevel,
        hasGeometry: Boolean(payload.url),
      })),
    });
    return payloads;
  };

  console.warn('[shapeBuildAPI] loading metadata from cache', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
  });
  const countryMetadata = await metadataLoader.loadMetadata(input.dataSource, input.nodeId);
  console.warn('[shapeBuildAPI] metadata loaded from cache', {
    nodeId: input.nodeId,
    metadataCount: countryMetadata.length,
    metadataCountryCodes: countryMetadata.map((m) => m.countryCode).slice(0, 10),
  });

  const payloadsFromCache = buildPayloads(countryMetadata);
  if (payloadsFromCache.length > 0 || selectedAdminPairCount === 0) {
    console.warn('[shapeBuildAPI] returning payloads from cache', {
      nodeId: input.nodeId,
      payloadCount: payloadsFromCache.length,
      selectedAdminPairCount,
    });
    return payloadsFromCache;
  }
  console.warn(
    '[shapeBuildAPI] no source payloads from cached metadata; retrying with force refresh',
    {
      nodeId: input.nodeId,
      dataSource: input.dataSource,
      selectedAdminPairCount,
      cachedMetadataCount: countryMetadata.length,
    }
  );
  metadataLoader.clearCache(input.dataSource);
  console.warn('[shapeBuildAPI] metadata cache cleared, loading with force refresh', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
  });
  const refreshedMetadata = await metadataLoader.loadMetadata(input.dataSource, input.nodeId, {
    force: true,
  });
  console.warn('[shapeBuildAPI] refreshed metadata loaded', {
    nodeId: input.nodeId,
    refreshedMetadataCount: refreshedMetadata.length,
    refreshedMetadataCountryCodes: refreshedMetadata.map((m) => m.countryCode).slice(0, 10),
    metadataChanged: refreshedMetadata.length !== countryMetadata.length,
  });

  const payloadsFromRefreshedMetadata = buildPayloads(refreshedMetadata);
  if (payloadsFromRefreshedMetadata.length > 0) {
    console.warn('[shapeBuildAPI] returning payloads from refreshed metadata', {
      nodeId: input.nodeId,
      payloadCount: payloadsFromRefreshedMetadata.length,
    });
    return payloadsFromRefreshedMetadata;
  }
  console.error('[shapeBuildAPI] failed to generate payloads even after refresh', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
    selectedAdminPairCount,
    cachedMetadataCount: countryMetadata.length,
    refreshedMetadataCount: refreshedMetadata.length,
    selectedArrayByCountriesKeys: Object.keys(input.selectedArrayByCountries || {}),
    selectedArrayByCountriesSample: input.selectedArrayByCountries
      ? Object.fromEntries(Object.entries(input.selectedArrayByCountries).slice(0, 5))
      : null,
  });
  throw new SourceTaskPayloadGenerationError(
    `[shapeBuildAPI] No source task payloads generated for ${selectedAdminPairCount}` +
      ' selected entries. Metadata may be stale or incompatible with the current selection.'
  );
};

const estimatePlannedSourceTotal = async (input: {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
}): Promise<{ plannedSourceTotal: number; payloadCount: number }> => {
  const dataSource = requireDataSourceName(
    input.buildConfig.dataSourceName,
    'estimatePlannedSourceTotal'
  );
  const payloads = await resolveSourceTaskPayloadsForPlan({
    nodeId: input.nodeId,
    dataSource,
    selectedArrayByCountries: input.selectedArrayByCountries,
    downloadTaskPayloads: input.downloadTaskPayloads,
  });
  if (payloads.length === 0) {
    return { plannedSourceTotal: 0, payloadCount: 0 };
  }
  const strategy = resolveSourceStageStrategy(dataSource);
  const { tasks } = await strategy.buildSourceTasks({
    nodeId: input.nodeId,
    sourceTaskPayloads: payloads,
    config: buildBuildSessionConfig(input.buildConfig),
    options: buildSourceStageOptions(input.buildConfig),
  });
  return {
    plannedSourceTotal: tasks.length,
    payloadCount: payloads.length,
  };
};

const buildSelectionSet = (selection: SelectedArrayByCountries | undefined): Set<string> => {
  const set = new Set<string>();
  if (!selection || Array.isArray(selection)) return set;
  Object.entries(selection).forEach(([code, row]) => {
    if (!Array.isArray(row)) return;
    row.forEach((selected, index) => {
      if (selected) {
        set.add(`${code}:${index}`);
      }
    });
  });
  return set;
};

const computeRemovedSelectionPairs = (
  prevSelection: SelectedArrayByCountries | undefined,
  nextSelection: SelectedArrayByCountries | undefined
): Array<{ countryCode: string; adminLevel: number }> => {
  if (!prevSelection || Array.isArray(prevSelection)) return [];
  const prevSet = buildSelectionSet(prevSelection);
  const nextSet = buildSelectionSet(nextSelection);
  const removed: Array<{ countryCode: string; adminLevel: number }> = [];
  prevSet.forEach((entry) => {
    if (nextSet.has(entry)) return;
    const [countryCode, adminLevelText] = entry.split(':');
    const adminLevel = Number.parseInt(adminLevelText ?? '', 10);
    removed.push({ countryCode: countryCode ?? '', adminLevel });
  });
  return removed;
};

const applySelectionDiffCleanup = async (
  nodeId: NodeId,
  prevSelection: SelectedArrayByCountries | undefined,
  nextSelection: SelectedArrayByCountries | undefined
): Promise<void> => {
  const removedPairs = computeRemovedSelectionPairs(prevSelection, nextSelection);
  if (removedPairs.length === 0) return;
  await runShapeArtifactCascadeCleanup({
    nodeId,
    target: {
      kind: 'selection',
      removedSelections: removedPairs,
    },
  });
};

const clearBuildTasksByStage = async (nodeId: NodeId, stages: Array<TaskStage>): Promise<void> => {
  const uniqueStages = Array.from(new Set(stages));
  if (uniqueStages.length === 0) return;
  const taskRows = await Promise.all(
    uniqueStages.map((stage) => ephemeralShapeAPIImpl.listBuildTasksByStage(nodeId, stage))
  );
  const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
  if (taskIds.length > 0) {
    await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
  }
};

type StartBuildSessionScope = 'startBuildSession';

const startBuildSessionInternal = async (
  scope: StartBuildSessionScope,
  draftId: NodeId,
  buildConfig: ShapeBuildConfig,
  processingConfig: ShapeProcessingConfig | undefined,
  downloadTaskPayloads: SourceTaskPayload[],
  buildContinuationPolicy?: BuildContinuationPolicy
): Promise<NodeId> => {
  const activePipelineBeforeStartup = getActivePipeline(draftId);
  if (
    activePipelineBeforeStartup !== null &&
    !isActivePipelineRunCurrent(draftId, activePipelineBeforeStartup.runId)
  ) {
    throw createActivePipelineAlreadyExistsError(draftId, activePipelineBeforeStartup.runId);
  }
  if (!buildConfig.dataSourceName) {
    throw new Error('Data source is required to start build processing');
  }
  let startupNodeId: NodeId = draftId;
  const startupScope = scope;
  const getStartupErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
  const emitStartupStepLog = (
    phase: 'start' | 'finish',
    step: string,
    extra?: Record<string, unknown>
  ): void => {
    // stageHeartbeatAt keeps the session alive during long startup steps.
    // stageId is NOT written here — startup:* values are not valid StageIds
    // and must not appear in the session record per the event spec.
    void shapeMutationAPIImpl
      .updateBuildSession(startupNodeId, {
        stageHeartbeatAt: Date.now(),
      })
      .catch(() => {});
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
    extra?: Record<string, unknown>
  ): Promise<T> => {
    const startedAt = Date.now();
    emitStartupStepLog('start', step, extra);
    try {
      const result = await runner();
      emitStartupStepLog('finish', step, {
        ...(extra ?? {}),
        outcome: 'success',
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      emitStartupStepLog('finish', step, {
        ...(extra ?? {}),
        outcome: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage: getStartupErrorMessage(error),
      });
      throw error;
    }
  };

  // Prefer persisted draft config when provided to avoid stale zoom settings.
  const handler = getShapeEntityHandler();
  const draftEntity = await executeStartupStep('load-draft', async () =>
    handler.getEntity(draftId)
  );
  const draftBuildConfig = draftEntity?.buildConfig;
  const draftProcessingConfig = draftEntity?.processingConfig;
  if (draftBuildConfig) {
    assertShapeBuildConfigTileEmitContract(draftBuildConfig);
  }
  assertShapeBuildConfigTileEmitContract(buildConfig);
  const normalizedDraftConfig = draftBuildConfig
    ? applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, draftBuildConfig)
    : null;
  const normalizedDraftProcessingConfig = draftProcessingConfig
    ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftProcessingConfig)
    : null;
  const normalizedBuildConfig = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, buildConfig);
  const normalizedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    processingConfig ?? {}
  );
  const mergedBatchConfig = normalizedDraftConfig
    ? applyBuildConfigPatch(normalizedDraftConfig, normalizedBuildConfig)
    : normalizedBuildConfig;
  const mergedProcessingConfig = normalizedDraftProcessingConfig
    ? mergeProcessingConfig(normalizedDraftProcessingConfig, normalizedProcessingConfig)
    : normalizedProcessingConfig;
  const mergedRuntimeConfig = composeRuntimeBuildConfig(mergedBatchConfig, mergedProcessingConfig);
  const validation = validateBuildConfig(mergedBatchConfig, mergedProcessingConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
  }
  emitStartupStepLog('finish', 'resolve-runtime-config', {
    outcome: 'success',
    transformMaxConcurrent: mergedRuntimeConfig.geometryConfig.maxConcurrent,
    sourceMaxConcurrent: mergedRuntimeConfig.sourceConfig.maxConcurrent,
    vtMaxConcurrent: mergedRuntimeConfig.tileEmitConfig.maxConcurrent,
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

  const selectionSummary = await executeStartupStep('summarize-selection', async () =>
    summarizeSelectedArrayByCountries(draftEntity.selectedArrayByCountries)
  );
  const selectedAdminPairCount = selectionSummary.selectedAdminPairCount;
  // Allow empty builds (zero selection) - they should succeed with empty output

  const nodeForSession = draftId;
  startupNodeId = nodeForSession;
  const previousSession = await executeStartupStep('load-session-record', async () =>
    shapeQueryAPIImpl.getBuildSessionRecord(nodeForSession)
  );
  const activePipelineAtStartup = getActivePipeline(nodeForSession);
  if (
    activePipelineAtStartup !== null &&
    (previousSession?.status !== 'running' ||
      !isActivePipelineRunCurrent(nodeForSession, activePipelineAtStartup.runId))
  ) {
    throw createActivePipelineAlreadyExistsError(nodeForSession, activePipelineAtStartup.runId);
  }
  if (previousSession?.status === 'running') {
    await clearStalePipelineStateIfInactive(nodeForSession, previousSession, startupScope);
  }
  if (previousSession?.status === 'running') {
    await setPaused(nodeForSession, false);
    await upsertBuildSessionSnapshot({
      nodeId: nodeForSession,
      status: 'running',
      canResume: false,
      stopReason: undefined,
    });
    // sessionStatusUpdated is emitted inside upsertBuildSessionSnapshot
    return nodeForSession;
  }
  const resumeExistingTasks = shouldReuseTaskQueueOnStart(previousSession?.status);
  const buildStartedAt =
    resumeExistingTasks && previousSession
      ? requireResumablePausedSessionStartedAt(nodeForSession, previousSession)
      : Date.now();
  let sourcePlan: Awaited<ReturnType<typeof estimatePlannedSourceTotal>>;
  try {
    console.warn('[shapeBuildAPI] Starting plan-source-total step', {
      nodeId: nodeForSession,
      selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      downloadTaskPayloadsCount: downloadTaskPayloads.length,
    });

    sourcePlan = await executeStartupStep(
      'plan-source-total',
      async () =>
        estimatePlannedSourceTotal({
          nodeId: nodeForSession,
          buildConfig: mergedRuntimeConfig,
          selectedArrayByCountries: draftEntity.selectedArrayByCountries,
          downloadTaskPayloads,
        }),
      {
        payloadCount: downloadTaskPayloads.length,
        selectedCountryCount: selectionSummary.selectedCountryCount,
        selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      }
    );

    if (selectedAdminPairCount > 0 && sourcePlan.plannedSourceTotal === 0) {
      throw new Error(
        '[shapeBuildAPI] Build has selected inputs but generated 0 source tasks.' +
          ' Please reload country metadata and retry.'
      );
    }

    console.warn('[shapeBuildAPI] plan-source-total step completed successfully', {
      nodeId: nodeForSession,
      plannedSourceTotal: sourcePlan.plannedSourceTotal,
      payloadCount: sourcePlan.payloadCount,
    });
  } catch (error) {
    // If auth is required, set session to paused (not failed) so the auth dialog
    // can be shown and the user can retry after authenticating (#979)
    if (error instanceof AuthRequiredError) {
      const pausedAt = Date.now();
      return persistFailureAndRethrow(
        error,
        async () => {
          if (resumeExistingTasks) {
            await updateBuildSessionFromTasks(nodeForSession, {
              status: 'paused',
              stopReason: 'auth-required',
              lastHeartbeatAt: pausedAt,
              canResume: true,
            });
          } else {
            await upsertBuildSessionSnapshot({
              nodeId: nodeForSession,
              selectedArrayByCountries: draftEntity.selectedArrayByCountries,
              status: 'paused',
              stopReason: 'auth-required',
              startedAt: buildStartedAt,
              lastHeartbeatAt: pausedAt,
              canResume: true,
            });
          }
        },
        (persistenceError) => {
          console.error('[shapeBuildAPI] Failed to persist auth-required pause', {
            nodeId: nodeForSession,
            persistenceError:
              persistenceError instanceof Error
                ? persistenceError.message
                : String(persistenceError),
          });
        }
      );
    }
    // Emit sessionStatusUpdated with 'failed' so the UI is not left waiting.
    console.error('[shapeBuildAPI] Failed to plan source total', {
      nodeId: nodeForSession,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      downloadTaskPayloadsCount: downloadTaskPayloads.length,
    });
    const failedAt = Date.now();
    return persistFailureAndRethrow(
      error,
      async () => {
        if (resumeExistingTasks) {
          await updateBuildSessionFromTasks(nodeForSession, {
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          });
        } else {
          await upsertBuildSessionSnapshot({
            nodeId: nodeForSession,
            selectedArrayByCountries: draftEntity.selectedArrayByCountries,
            status: 'failed',
            stopReason: 'failed',
            startedAt: buildStartedAt,
            completedAt: failedAt,
            canResume: false,
          });
        }
      },
      (persistenceError) => {
        console.error('[shapeBuildAPI] Failed to persist source planning failure', {
          nodeId: nodeForSession,
          persistenceError:
            persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
        });
      }
    );
  }

  setSourcePlannedTotal(nodeForSession, sourcePlan.plannedSourceTotal);
  const pipelineRunId = `${nodeForSession}:${buildStartedAt}`;

  // Propagate session identity to AuthService so AUTH_REQUIRED notifications
  // carry sessionId + sessionStartedAt for UI-side deduplication (#991).
  const authService = await AuthService.getSingleton();
  authService.setBuildSessionContext(String(nodeForSession), buildStartedAt);

  await setPaused(nodeForSession, false);
  const abortController = new AbortController();

  try {
    const taskQueue = new VtTaskQueueDb();

    // Clean up invalid cache entries before processing any tasks (Requirements 4.1, 4.2, 4.3, 4.4)
    await executeStartupStep('cleanup-invalid-cache-entries', async () => {
      const cleanupResult = await cacheValidator.cleanupInvalidEntries(nodeForSession);
      console.log(`[shapeBuildAPI] Cache cleanup completed for node ${nodeForSession}:`, {
        geometryDeleted: cleanupResult.geometryDeleted,
        sourceDeleted: cleanupResult.sourceDeleted,
        totalDeleted: cleanupResult.geometryDeleted + cleanupResult.sourceDeleted,
      });
      return cleanupResult;
    });

    await executeStartupStep('selection-diff-cleanup', async () =>
      applySelectionDiffCleanup(
        nodeForSession,
        previousSession?.selectedArrayByCountries,
        draftEntity.selectedArrayByCountries
      )
    );
    if (!resumeExistingTasks) {
      await executeStartupStep('fresh-build-tile-artifact-invalidation', async () =>
        runShapeArtifactCascadeCleanup({
          nodeId: nodeForSession,
          target: { kind: 'stage', stage: 'tileEmit' },
        })
      );
      await executeStartupStep('clear-build-task-history', async () =>
        clearBuildTasksByStage(nodeForSession, ['source', 'geometry', 'tileEmit'])
      );
    }
    let existingTaskCount = await executeStartupStep('count-existing-tasks', async () =>
      taskQueue.tasks.where('nodeId').equals(nodeForSession).count()
    );
    if (!resumeExistingTasks && existingTaskCount > 0) {
      await executeStartupStep(
        'clear-completed-session-task-queue',
        async () => {
          await deleteTasksByNode(taskQueue, nodeForSession);
          existingTaskCount = 0;
        },
        {
          existingTaskCount,
          previousSessionStatus: previousSession?.status ?? null,
        }
      );
    }
    const existingSourceTaskCount = await executeStartupStep(
      'count-existing-source-tasks',
      async () =>
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeForSession, 'source']).count(),
      { existingTaskCount }
    );
    const plannedSourceTotal = Math.max(sourcePlan.plannedSourceTotal, existingSourceTaskCount);
    setSourcePlannedTotal(nodeForSession, plannedSourceTotal);
    await executeStartupStep(
      'upsert-session-snapshot',
      async () => {
        if (resumeExistingTasks) {
          await updateBuildSessionFromTasks(nodeForSession, {
            status: 'running',
            stopReason: undefined,
            canResume: false,
            completedAt: undefined,
          });
          return;
        }
        await upsertBuildSessionSnapshot({
          nodeId: nodeForSession,
          selectedArrayByCountries: draftEntity.selectedArrayByCountries,
          status: 'running',
          startedAt: buildStartedAt,
          canResume: false,
        });
      },
      { existingTaskCount, plannedSourceTotal }
    );
    const emitQueuedProgressSnapshot = async (payload: {
      nodeId: NodeId;
      stage: 'source';
      taskCount: number;
      source: 'created' | 'reused';
    }): Promise<void> => {
      // Source tasks are now enqueued; emit stageSnapshotUpdated so the UI can
      // display the task list. stageStartedAt is read from the session record.
      if (payload.stage !== 'source') return;
      const timing = await initializeAndReadStageTiming(
        payload.nodeId,
        payload.stage,
        requireCurrentPipelineRun
      );
      await emitStageSnapshotUpdated(
        payload.nodeId,
        payload.stage,
        timing.stageStartedAt,
        timing.stageInactiveMs,
        undefined,
        isCurrentPipelineRun
      );
    };
    const emitStageTaskSnapshotBarrier = async (payload: {
      nodeId: NodeId;
      stage: TaskStage;
      taskCount: number;
    }): Promise<void> => {
      void payload.taskCount;
      // Initialize timing only at an actual stage transition, then read the
      // persisted values back before emitting the snapshot.
      const timing = await initializeAndReadStageTiming(
        payload.nodeId,
        payload.stage,
        requireCurrentPipelineRun
      );
      await emitStageSnapshotUpdated(
        payload.nodeId,
        payload.stage,
        timing.stageStartedAt,
        timing.stageInactiveMs,
        undefined,
        isCurrentPipelineRun
      );
    };
    emitStartupStepLog('start', 'pipeline-dispatch', {
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
      resumeExistingTasks,
    });
    const resolvedDataSource = requireDataSourceName(
      mergedRuntimeConfig.dataSourceName,
      startupScope
    );
    startSessionTracking(nodeForSession);
    console.warn(`[shapeBuildAPI] ${startupScope} pipeline start`, {
      nodeId: nodeForSession,
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
    });
    void shapeMutationAPIImpl
      .updateBuildSession(nodeForSession, {
        stageHeartbeatAt: Date.now(),
      })
      .catch(() => {});
    // Handle empty builds (no selections and no download payloads)
    if (selectedAdminPairCount === 0 && downloadTaskPayloads.length === 0) {
      console.warn(`[shapeBuildAPI] ${startupScope} empty build - completing immediately`, {
        nodeId: nodeForSession,
        runId: pipelineRunId,
      });
      const completedAt = Date.now();
      await updateBuildSessionFromTasks(nodeForSession, {
        status: 'completed',
        stopReason: 'completed',
        completedAt,
        canResume: false,
      });
      emitStartupStepLog('finish', 'pipeline-dispatch', {
        runId: pipelineRunId,
        payloadCount: downloadTaskPayloads.length,
        resumeExistingTasks,
        outcome: 'success',
        emptyBuild: true,
      });
      clearBuildSessionAuthContext();
      return nodeForSession;
    }

    // Handle empty builds (no selections and no download payloads)
    if (selectedAdminPairCount === 0 && downloadTaskPayloads.length === 0) {
      console.warn(`[shapeBuildAPI] ${startupScope} empty build - completing immediately`, {
        nodeId: nodeForSession,
        runId: pipelineRunId,
      });
      const completedAt = Date.now();
      await updateBuildSessionFromTasks(nodeForSession, {
        status: 'completed',
        stopReason: 'completed',
        completedAt,
        canResume: false,
      });
      emitStartupStepLog('finish', 'pipeline-dispatch', {
        runId: pipelineRunId,
        payloadCount: downloadTaskPayloads.length,
        resumeExistingTasks,
        outcome: 'success',
        emptyBuild: true,
      });
      clearBuildSessionAuthContext();
      return nodeForSession;
    }
    console.warn('[shapeBuildAPI] Starting runShapePipeline execution', {
      nodeId: nodeForSession,
      runId: pipelineRunId,
      dataSource: resolvedDataSource,
      selectedAdminPairCount,
      downloadTaskPayloadsCount: downloadTaskPayloads.length,
    });
    if (getActivePipeline(nodeForSession) !== null) {
      throw new Error(`[shapeBuildAPI] active pipeline already exists: ${String(nodeForSession)}`);
    }
    const isCurrentPipelineRun = (): boolean =>
      isActivePipelineRunCurrent(nodeForSession, pipelineRunId);
    const requireCurrentPipelineRun = (): void => {
      if (isCurrentPipelineRun()) return;
      const error = new Error(
        `[shapeBuildAPI] stale pipeline run cannot publish updates: ${String(nodeForSession)}:${pipelineRunId}`
      );
      error.name = 'AbortError';
      throw error;
    };
    const pipelineExecutionPromise = Promise.resolve().then(() =>
      runShapePipeline({
        nodeId: nodeForSession,
        dataSource: resolvedDataSource,
        buildConfig: mergedRuntimeConfig,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
        downloadTaskPayloads,
        waitIfPaused: () => waitIfPaused(nodeForSession),
        buildContinuationPolicy,
        resumeExistingTasks,
        pipelineRunId,
        abortSignal: abortController.signal,
        isRunCurrent: isCurrentPipelineRun,
        onTasksEnqueued: async (payload) => {
          requireCurrentPipelineRun();
          await emitQueuedProgressSnapshot(payload);
        },
        onStageTasksPrepared: async (payload) => {
          requireCurrentPipelineRun();
          await emitStageTaskSnapshotBarrier(payload);
        },
      })
    );
    const activePipelinePromise = finalizePipelineOutcome(pipelineExecutionPromise, {
      onSuccess: async () => {
        if (
          abortController.signal.aborted ||
          !isActivePipelineRunCurrent(nodeForSession, pipelineRunId)
        ) {
          return;
        }
        console.warn('[shapeBuildAPI] runShapePipeline completed successfully', {
          nodeId: nodeForSession,
          runId: pipelineRunId,
        });
        const completedAt = Date.now();
        const taskQueue = new VtTaskQueueDb();
        const tasks = await listTasks(taskQueue, nodeForSession);
        requireCurrentPipelineRun();
        const terminalTaskStatus = summarizeTaskQueueStatus(tasks).status;
        const pipelineFinishedWithFailure = terminalTaskStatus === 'failed';
        await updateBuildSessionFromTasks(
          nodeForSession,
          {
            status: pipelineFinishedWithFailure ? 'failed' : 'completed',
            stopReason: pipelineFinishedWithFailure ? 'failed' : 'completed',
            completedAt,
            canResume: false,
          },
          requireCurrentPipelineRun
        );
        if (pipelineFinishedWithFailure) {
        }
      },
      onFailure: async (error) => {
        if (
          abortController.signal.aborted ||
          !isActivePipelineRunCurrent(nodeForSession, pipelineRunId)
        ) {
          return;
        }
        console.error('[shapeBuildAPI] runShapePipeline failed with error', {
          nodeId: nodeForSession,
          runId: pipelineRunId,
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        // updateBuildSessionFromTasks already emits sessionStatusUpdated.
        // No additional snapshot emission needed here.

        const failedAt = Date.now();
        const diagnostics = toErrorDiagnostics(error);
        if (isAuthPendingPipelineError(error)) {
          const pausedAt = Date.now();
          await updateBuildSessionFromTasks(
            nodeForSession,
            {
              status: 'paused',
              stopReason: 'auth-required',
              lastHeartbeatAt: pausedAt,
              canResume: true,
            },
            requireCurrentPipelineRun
          );
          return;
        }
        if (isSourceTaskPayloadGenerationError(error)) {
          console.error('[shapeBuildAPI] source task payload generation failed', error);
          console.error(
            '[shapeBuildAPI] startup',
            JSON.stringify({
              scope: startupScope,
              phase: 'finish',
              step: 'payload-generation',
              nodeId: nodeForSession,
              runId: pipelineRunId,
              outcome: 'error',
              failedAt,
              ...diagnostics,
            })
          );
          await updateBuildSessionFromTasks(
            nodeForSession,
            {
              status: 'failed',
              stopReason: 'failed',
              completedAt: failedAt,
              canResume: false,
            },
            requireCurrentPipelineRun
          );
          return;
        }
        console.error('[shapeBuildAPI] tileEmit pipeline failed', error);
        console.error(
          '[shapeBuildAPI] startup',
          JSON.stringify({
            scope: startupScope,
            phase: 'finish',
            step: 'pipeline-run',
            nodeId: nodeForSession,
            runId: pipelineRunId,
            outcome: 'error',
            failedAt,
            ...diagnostics,
          })
        );
        await updateBuildSessionFromTasks(
          nodeForSession,
          {
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          },
          requireCurrentPipelineRun
        );
      },
      onFinalizationError: (finalizationError) => {
        console.error('[shapeBuildAPI] Failed to persist terminal pipeline state', {
          nodeId: nodeForSession,
          runId: pipelineRunId,
          error:
            finalizationError instanceof Error
              ? finalizationError.message
              : String(finalizationError),
        });
      },
    });
    registerActivePipeline(nodeForSession, {
      promise: activePipelinePromise,
      abortController,
      runId: pipelineRunId,
    });
    void activePipelinePromise.then(() => {
      if (!abortController.signal.aborted) {
        clearActivePipelineRuntimeState(nodeForSession, pipelineRunId);
      }
    });
    emitStartupStepLog('finish', 'pipeline-dispatch', {
      runId: pipelineRunId,
      payloadCount: downloadTaskPayloads.length,
      resumeExistingTasks,
      outcome: 'success',
    });
  } catch (error) {
    clearActivePipelineRuntimeState(nodeForSession, pipelineRunId);
    if (getActivePipeline(nodeForSession) === null) {
      clearBuildSessionAuthContext();
    }
    const failedAt = Date.now();
    return persistFailureAndRethrow(
      error,
      async () => {
        if (resumeExistingTasks) {
          await updateBuildSessionFromTasks(nodeForSession, {
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          });
        } else {
          await upsertBuildSessionSnapshot({
            nodeId: nodeForSession,
            selectedArrayByCountries: draftEntity.selectedArrayByCountries,
            status: 'failed',
            stopReason: 'failed',
            startedAt: buildStartedAt,
            completedAt: failedAt,
            canResume: false,
          });
        }
      },
      (persistenceError) => {
        console.error('[shapeBuildAPI] Failed to persist startup failure', {
          nodeId: nodeForSession,
          persistenceError:
            persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
        });
      }
    );
  }

  return nodeForSession;
};

const waitForPipelineShutdown = async (
  nodeId: NodeId,
  runId: string,
  pipelinePromise: Promise<void>,
  timeoutMs: number
): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      pipelinePromise,
      new Promise<void>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ShapeBuildPauseShutdownTimeoutError(nodeId, runId, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
};

const resetRunningTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
  if (runningTasks.length === 0) return;

  // Runtime shutdown is already confirmed at this boundary. Requeue only tasks
  // interrupted while running and preserve their task payload/result metadata.
  await Promise.all(
    runningTasks.map((task) =>
      updateTask(
        taskQueue,
        task.taskId,
        {
          status: 'queued',
          // Preserve all existing state: startedAt, completedAt, outputData, errorMessage, display, message
          // Do NOT set these to undefined as that would violate state preservation requirements
        },
        { allowTerminalStatusTransition: true }
      )
    )
  );
};

const isShapeBuildStopReason = (value: unknown): value is ShapeBuildStopReason =>
  value === 'route-leave' ||
  value === 'user-pause' ||
  value === 'auth-required' ||
  value === 'failed' ||
  value === 'completed' ||
  value === 'unknown';

const resolveCommandStopReason = (
  command: 'session/pause' | 'session/cancel-queued',
  value: unknown
): ShapeBuildStopReason => {
  if (value === undefined) return 'user-pause';
  if (isShapeBuildStopReason(value)) return value;
  throw new Error(`[shapeBuildAPI] invalid ${command} stopReason: ${String(value)}`);
};

const invokeShapeBuildCommand = async (
  command: string,
  payload: Record<string, unknown>
): Promise<void> => {
  if (command === 'session/pause') {
    const nodeId = payload.nodeId as NodeId;
    if (!nodeId) throw new Error('[shapeBuildAPI] session/pause requires nodeId');
    const stopReason = resolveCommandStopReason('session/pause', payload.stopReason);
    console.warn('[shapeBuildAPI][PauseTrace] pause-requested', {
      nodeId,
      stopReason: stopReason ?? null,
    });

    const terminationStartTime = Date.now();
    const activePipeline = getActivePipeline(nodeId);
    if (activePipeline === null) {
      const error = new ShapeBuildPauseActivePipelineMissingError(nodeId);
      const failedAt = Date.now();
      await setPaused(nodeId, false);
      return persistFailureAndRethrow(
        error,
        async () =>
          upsertBuildSessionSnapshot({
            nodeId,
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          }),
        (persistenceError) => {
          console.error('[shapeBuildAPI] Failed to persist missing active pipeline', {
            nodeId,
            persistenceError,
          });
        }
      );
    }
    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    if (!isActivePipelineRunCurrent(nodeId, activePipeline.runId)) {
      throw new ShapeBuildPauseActivePipelineMissingError(nodeId);
    }
    if (sessionRecord === null) {
      activePipeline.abortController.abort();
      invalidateActivePipeline(nodeId, activePipeline.runId);
      void activePipeline.promise.then(
        () => clearActivePipelineRuntimeState(nodeId, activePipeline.runId),
        () => clearActivePipelineRuntimeState(nodeId, activePipeline.runId)
      );
      await setPaused(nodeId, false);
      throw new Error(
        `[shapeBuildAPI] build session record is missing before pause: ${String(nodeId)}`
      );
    }

    activePipeline.abortController.abort();
    try {
      await setPaused(nodeId, true);
      emitSessionLifecyclePhaseUpdated(
        nodeId,
        {
          ...sessionRecord,
          stopReason,
        },
        'pausing'
      );
      await waitForPipelineShutdown(
        nodeId,
        activePipeline.runId,
        activePipeline.promise,
        SHAPE_PIPELINE_SHUTDOWN_TIMEOUT_MS
      );
    } catch (error) {
      invalidateActivePipeline(nodeId, activePipeline.runId);
      void activePipeline.promise.then(
        () => clearActivePipelineRuntimeState(nodeId, activePipeline.runId),
        () => clearActivePipelineRuntimeState(nodeId, activePipeline.runId)
      );
      await setPaused(nodeId, false);
      const failedAt = Date.now();
      await persistFailureAndRethrow(
        error,
        async () =>
          upsertBuildSessionSnapshot({
            nodeId,
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          }),
        (persistenceError) => {
          console.error('[shapeBuildAPI] Failed to persist pause shutdown failure', {
            nodeId,
            runId: activePipeline.runId,
            persistenceError,
          });
        }
      );
    }

    try {
      await resetRunningTasks(nodeId);
      const taskQueue = new VtTaskQueueDb();
      const counts = await countTaskQueueStatuses(taskQueue, nodeId);
      if (counts.running !== 0) {
        const error = new Error(
          `[shapeBuildAPI] Pipeline settled but ${counts.running} running tasks remain: ${String(nodeId)}`
        );
        error.name = 'ShapeBuildPauseDrainInvariantError';
        throw error;
      }

      const pausedAt = Date.now();
      await upsertBuildSessionSnapshot({
        nodeId,
        status: 'paused',
        stopReason,
        lastHeartbeatAt: pausedAt,
        canResume: true,
      });
      console.warn('[shapeBuildAPI][PauseTrace] pause-settled', {
        nodeId,
        runId: activePipeline.runId,
        durationMs: Date.now() - terminationStartTime,
        running: counts.running,
        total: counts.total,
      });
    } catch (error) {
      invalidateActivePipeline(nodeId, activePipeline.runId);
      await setPaused(nodeId, false);
      const failedAt = Date.now();
      await persistFailureAndRethrow(
        error,
        async () =>
          upsertBuildSessionSnapshot({
            nodeId,
            status: 'failed',
            stopReason: 'failed',
            completedAt: failedAt,
            canResume: false,
          }),
        (persistenceError) => {
          console.error('[shapeBuildAPI] Failed to persist post-drain pause failure', {
            nodeId,
            runId: activePipeline.runId,
            persistenceError,
          });
        }
      );
    } finally {
      clearActivePipelineRuntimeState(nodeId, activePipeline.runId);
    }
    return;
  }

  if (command === 'session/cancel-queued') {
    const nodeId = payload.nodeId as NodeId;
    if (!nodeId) throw new Error('[shapeBuildAPI] session/cancel-queued requires nodeId');
    const stopReason = resolveCommandStopReason('session/cancel-queued', payload.stopReason);
    // If the session is currently running, delegate to pause instead of wiping the queue.
    const currentSession = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    if (currentSession?.status === 'running') {
      await invokeShapeBuildCommand('session/pause', { nodeId, stopReason });
      return;
    }
    await setPaused(nodeId, false);
    setSourcePlannedTotal(nodeId, 0);
    const taskQueue = new VtTaskQueueDb();
    await deleteTasksByNode(taskQueue, nodeId);
    await upsertBuildSessionSnapshot({
      nodeId,
      status: 'idle',
      stopReason,
      canResume: false,
    });
    return;
  }

  throw new Error(`[shapeBuildAPI] Unknown build command: ${command}`);
};

const toErrorDiagnostics = (
  error: unknown
): {
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

const isAuthPendingPipelineError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return error.name === 'SourceStageAuthPendingError';
};

const isSourceTaskPayloadGenerationError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return error.name === 'SourceTaskPayloadGenerationError';
};

export const shapeBuildRuntimeExecutionControl = {
  startBuildSessionInternal,
  invokeShapeBuildCommand,
} as const;

export type ShapeBuildRuntimeExecutionControl = typeof shapeBuildRuntimeExecutionControl;
