/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type {
  ShapeBuildConfig,
  ShapeRuntimeBuildConfig,
  CountryMetadata,
  DataSourceName,
  SourceTaskPayload,
  SelectedArrayByCountries,
  ShapeProcessingConfig,
} from '~/common/types/index';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  composeRuntimeBuildConfig,
  applyBuildConfigPatch,
  mergeProcessingConfig,
  requireDataSourceName,
  validateBuildConfig,
} from '~/common/types/index';
import type { BuildProgressEvent } from '@hierarchidb/build-api';

import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { cacheValidator } from '~/services/CacheValidator';
import {
  countSelectedAdminPairs,
} from '~/services/utils/shapeBuildUtils';
import {
  deleteRawDataDataSourceBuffersForNodeMetadataIds,
} from '~/services/utils/chunkStore';
import { resolveSourceStageStrategy } from '~/services/build/strategies/resolveSourceStageStrategy';
import { emitTaskSnapshot, emitProgressSnapshot, emitSessionStateChange } from './eventEmission.js';
import type { ShapeBuildStopReason, ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { isStopReason } from './taskQueueManagement.js';
// Custom error types for better error classification
class SourceTaskPayloadGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceTaskPayloadGenerationError';
  }
}

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
import { runShapePipeline } from '~/services/vt/runShapePipeline';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import { setSourcePlannedTotal } from '~/services/vt/shapeProgressPlan';
import { shouldReuseTaskQueueOnStart } from '../shouldReuseTaskQueueOnStart.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';
import { summarizeTaskQueueStatus } from './progressAnalysis.js';

// Available functions from the new structure
const {
  countTaskQueueStatuses,
  setPaused,
  waitIfPaused,
  resolveProgressPhase,
  buildProgressPayloadFromTasks,
  progressCallbacks,
  getShapeEntityHandler,
} = shapeBuildRuntimeCore;

// Mock implementations for missing functions (to be implemented later)
const activePipelines = new Set<string>();
const activePipelineRuns = new Map<string, string>();
const sessionAbortControllers = new Map<string, AbortController>();
const sessionWorkerInstances = new Map<string, { terminate?: () => void }>();

// Placeholder functions for missing implementations
const startSessionTracking = (_nodeId: string) => { };
const clearStalePipelineStateIfInactive = (_nodeId: string, _previousSession?: any, _startupScope?: string) => { };
const clearActivePipelineRuntimeState = (_nodeId: string) => { };

const upsertBuildSessionSnapshot = async (data: { 
  nodeId: NodeId; 
  status?: ShapeBuildSessionRecord['status']; 
  stopReason?: ShapeBuildStopReason; 
  canResume?: boolean; 
  startedAt?: number; 
  completedAt?: number; 
  selectedArrayByCountries?: any; 
  tasks?: any[] 
}): Promise<void> => {
  try {
    await shapeMutationAPIImpl.updateBuildSession(data.nodeId, {
      status: data.status,
      stopReason: data.stopReason,
      canResume: data.canResume,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    });
    
    // Emit session state change event
    if (data.status) {
      const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(data.nodeId).catch(() => null);
      if (sessionRecord) {
        emitSessionStateChange(data.nodeId, sessionRecord.status, data.status, {
          ...sessionRecord,
          status: data.status,
          stopReason: data.stopReason,
          canResume: data.canResume,
          startedAt: data.startedAt ?? sessionRecord.startedAt,
          completedAt: data.completedAt,
        });
      }
    }
  } catch (error) {
    console.error('[shapeBuildAPI] Failed to upsert build session snapshot', error);
  }
};

const updateBuildSessionFromTasks = async (nodeId: NodeId, data: { 
  status?: ShapeBuildSessionRecord['status']; 
  stopReason?: ShapeBuildStopReason; 
  completedAt?: number; 
  canResume?: boolean 
}): Promise<void> => {
  try {
    await shapeMutationAPIImpl.updateBuildSession(nodeId, {
      status: data.status,
      stopReason: data.stopReason,
      completedAt: data.completedAt,
      canResume: data.canResume,
    });
    
    // Emit session state change event
    if (data.status) {
      const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
      if (sessionRecord) {
        emitSessionStateChange(nodeId, sessionRecord.status, data.status, {
          ...sessionRecord,
          status: data.status,
          stopReason: data.stopReason,
          completedAt: data.completedAt,
          canResume: data.canResume,
        });
      }
    }
  } catch (error) {
    console.error('[shapeBuildAPI] Failed to update build session from tasks', error);
  }
};

type CanonicalStageId = 'source-stage' | 'geometry-stage' | 'tile-emit-stage';
type TaskStage = 'source' | 'geometry' | 'tileEmit';

const toCanonicalStageId = (stage: TaskStage): CanonicalStageId => {
  if (stage === 'source') return 'source-stage';
  if (stage === 'geometry') return 'geometry-stage';
  return 'tile-emit-stage';
};

const isSourceOrGeometryStage = (stage: TaskStage): boolean => {
  const stageId = toCanonicalStageId(stage);
  return stageId === 'source-stage' || stageId === 'geometry-stage';
};

const isTileEmitStage = (stage: TaskStage): boolean => (
  toCanonicalStageId(stage) === 'tile-emit-stage'
);

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
  const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig',
  );

  return {
    dataSource: resolvedDataSource,
    sourceConfig: buildConfig.sourceConfig,
    geometryConfig: buildConfig.geometryConfig,
    vectorTiles: buildConfig.tileEmitConfig,
  };
};

const buildSourceStageOptions = (buildConfig: ShapeRuntimeBuildConfig) => ({
  timeoutMs: buildConfig.sourceConfig.timeoutMs,
  retryAttempts: buildConfig.sourceConfig.retryAttempts,
  retryDelay: buildConfig.sourceConfig.retryDelay,
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
    selectedArrayByCountriesKeys: input.selectedArrayByCountries ? Object.keys(input.selectedArrayByCountries) : [],
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
      Object.entries(input.selectedArrayByCountries).slice(0, 3).map(([key, value]) => [
        key,
        Array.isArray(value) ? `Array(${value.length})` : typeof value
      ])
    ),
  });

  const buildPayloads = (countryMetadata: CountryMetadata[]): SourceTaskPayload[] => {
    console.warn('[shapeBuildAPI] building payloads from metadata', {
      nodeId: input.nodeId,
      metadataCount: countryMetadata.length,
      metadataSample: countryMetadata.slice(0, 2).map(meta => ({
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
      payloadSample: payloads.slice(0, 2).map(payload => ({
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
    metadataCountryCodes: countryMetadata.map(m => m.countryCode).slice(0, 10),
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
  console.warn('[shapeBuildAPI] no source payloads from cached metadata; retrying with force refresh', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
    selectedAdminPairCount,
    cachedMetadataCount: countryMetadata.length,
  });
  metadataLoader.clearCache(input.dataSource);
  console.warn('[shapeBuildAPI] metadata cache cleared, loading with force refresh', {
    nodeId: input.nodeId,
    dataSource: input.dataSource,
  });
  const refreshedMetadata = await metadataLoader.loadMetadata(input.dataSource, input.nodeId, { force: true });
  console.warn('[shapeBuildAPI] refreshed metadata loaded', {
    nodeId: input.nodeId,
    refreshedMetadataCount: refreshedMetadata.length,
    refreshedMetadataCountryCodes: refreshedMetadata.map(m => m.countryCode).slice(0, 10),
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
    selectedArrayByCountriesSample: input.selectedArrayByCountries ?
      Object.fromEntries(Object.entries(input.selectedArrayByCountries).slice(0, 5)) : null,
  });
  throw new SourceTaskPayloadGenerationError(
    `[shapeBuildAPI] No source task payloads generated for ${selectedAdminPairCount}`
    + ' selected entries. Metadata may be stale or incompatible with the current selection.',
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
    'estimatePlannedSourceTotal',
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
): { source: boolean; geometry: boolean; tileEmit: boolean } => {
  if (!prevConfig || !nextConfig) {
    return { source: false, geometry: false, tileEmit: false };
  }
  return {
    source: hasConfigDiff(prevConfig.sourceConfig, nextConfig.sourceConfig),
    geometry: hasConfigDiff(prevConfig.geometryConfig, nextConfig.geometryConfig),
    tileEmit: hasConfigDiff(prevConfig.tileEmitConfig, nextConfig.tileEmitConfig),
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
  const [sourceCacheIdsRaw, geometryCacheIdsRaw, tileEmitTasks] = await Promise.all([
    ephemeralDB.sourceCacheMeta
      .where('[nodeId+countryCode+adminLevel]')
      .anyOf(removedKeyTuples)
      .primaryKeys(),
    ephemeralDB.geometryCacheMeta
      .where('[nodeId+countryCode+adminLevel]')
      .anyOf(removedKeyTuples)
      .primaryKeys(),
    taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'tileEmit']).toArray(),
  ]);
  const sourceCacheIds = sourceCacheIdsRaw.map((id: unknown) => String(id));
  if (sourceCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.sourceCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
      ephemeralDB.sourceCacheMeta
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
    ]);
    await deleteRawDataDataSourceBuffersForNodeMetadataIds(nodeId, sourceCacheIds);
  }

  const geometryCacheIds = geometryCacheIdsRaw.map((id: unknown) => String(id));
  const removedBufferSet = new Set(geometryCacheIds);
  if (geometryCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.geometryCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
      ephemeralDB.geometryCacheMeta
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete(),
    ]);
    const relations = await ephemeralDB.tileEmitBufferRelations
      .where('bufferId')
      .anyOf(geometryCacheIds)
      .toArray();
    const affectedTileIds = new Set(relations.map((row) => row.tileId));
    await ephemeralDB.tileEmitBufferRelations
      .where('bufferId')
      .anyOf(geometryCacheIds)
      .delete();
    const encoder = new TextEncoder();
    const hasher = new NobleSha3HashPort();
    const tileIdsToDelete = tileEmitTasks
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
      const stage = task.stage;
      if (isSourceOrGeometryStage(stage)) {
        const input = task.inputData as { countryCode?: string; adminLevel?: number } | undefined;
        if (!input?.countryCode || typeof input.adminLevel !== 'number') return false;
        return removedSet.has(`${normalizeSelectionKey(input.countryCode)}:${input.adminLevel}`);
      }
      if (isTileEmitStage(stage)) {
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
    uniqueStages.map((stage) => ephemeralShapeAPIImpl.listBuildTasksByStage(nodeId, stage)),
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
  if (!plan.source && !plan.geometry && !plan.tileEmit) return;

  const stagesToClear: TaskStage[] = [];
  if (plan.source) {
    stagesToClear.push('source', 'geometry', 'tileEmit');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'source');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'geometry');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
  } else if (plan.geometry) {
    stagesToClear.push('geometry', 'tileEmit');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'geometry');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
  } else if (plan.tileEmit) {
    stagesToClear.push('tileEmit');
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
  }

  await clearBuildTasksByStage(nodeId, stagesToClear);
  await clearTaskQueueStages(nodeId, stagesToClear);

  console.warn('[shapeBuildAPI] config invalidation applied', {
    nodeId,
    source: plan.source,
    geometry: plan.geometry,
    tileEmit: plan.tileEmit,
  });
};

type StartBuildSessionScope = 'startBuildSession';

const startBuildSessionInternal = async (
  scope: StartBuildSessionScope,
  draftId: NodeId,
  buildConfig: ShapeBuildConfig,
  processingConfig: ShapeProcessingConfig | undefined,
  downloadTaskPayloads: SourceTaskPayload[],
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
    }).catch(() => { });
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
  const draftEntity = await executeStartupStep(
    'load-draft',
    async () => handler.getEntity(draftId),
  );
  const draftBuildConfig = draftEntity?.buildConfig;
  const draftProcessingConfig = draftEntity?.processingConfig;
  const normalizedDraftConfig = draftBuildConfig
    ? applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, draftBuildConfig)
    : null;
  const normalizedDraftProcessingConfig = draftProcessingConfig
    ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftProcessingConfig)
    : null;
  const normalizedBuildConfig = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, buildConfig);
  const normalizedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    processingConfig ?? {},
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

  const selectionSummary = await executeStartupStep(
    'summarize-selection',
    async () => summarizeSelectedArrayByCountries(draftEntity.selectedArrayByCountries),
  );
  const selectedAdminPairCount = selectionSummary.selectedAdminPairCount;
  // Allow empty builds (zero selection) - they should succeed with empty output

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
  let sourcePlan;
  try {
    console.warn('[shapeBuildAPI] Starting plan-source-total step', {
      nodeId: nodeForSession,
      selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      downloadTaskPayloadsCount: downloadTaskPayloads.length,
    });
    
    sourcePlan = await executeStartupStep(
      'plan-source-total',
      async () => estimatePlannedSourceTotal({
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
    
    console.warn('[shapeBuildAPI] plan-source-total step completed successfully', {
      nodeId: nodeForSession,
      plannedSourceTotal: sourcePlan.plannedSourceTotal,
      payloadCount: sourcePlan.payloadCount,
    });
  } catch (error) {
    // Emit empty task snapshot to notify UI of the error state
    console.error('[shapeBuildAPI] Failed to plan source total, emitting empty task snapshot', {
      nodeId: nodeForSession,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : undefined,
      selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      downloadTaskPayloadsCount: downloadTaskPayloads.length,
    });
    
    try {
      // Send empty task snapshot to UI so it doesn't wait indefinitely
      await upsertBuildSessionSnapshot({
        nodeId: nodeForSession,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
        tasks: [], // Empty tasks array
        status: 'failed',
        canResume: false,
      });
      
      console.warn('[shapeBuildAPI] Empty build session snapshot upserted', {
        nodeId: nodeForSession,
      });
      
      await emitTaskSnapshot(nodeForSession);
      
      console.warn('[shapeBuildAPI] Empty task snapshot emitted to UI', {
        nodeId: nodeForSession,
      });
      
      // Emit progress snapshot to ensure UI receives notification
      await emitProgressSnapshot(nodeForSession, 'Build failed during source planning.');
      
      console.warn('[shapeBuildAPI] Progress snapshot emitted for failed build', {
        nodeId: nodeForSession,
      });
    } catch (emitError) {
      console.error('[shapeBuildAPI] Failed to emit empty task snapshot', {
        nodeId: nodeForSession,
        emitError: emitError instanceof Error ? emitError.message : String(emitError),
      });
    }
    
    throw error;
  }
  // Only fail if there are selections but no payloads generated (metadata issue)
  // Empty builds (no selections) should succeed with empty output
  if (selectedAdminPairCount > 0 && sourcePlan.plannedSourceTotal === 0) {
    throw new Error(
      '[shapeBuildAPI] Build has selected inputs but generated 0 source tasks.'
      + ' Please reload country metadata and retry.',
    );
  }
  setSourcePlannedTotal(nodeForSession, sourcePlan.plannedSourceTotal);
  const buildStartedAt = Date.now();
  const pipelineRunId = `${nodeForSession}:${buildStartedAt}`;

  setPaused(nodeForSession, false);
  activePipelines.add(pipelineKey);
  activePipelineRuns.set(pipelineKey, pipelineRunId);

  // Create AbortController for immediate termination on pause
  const abortController = new AbortController();
  sessionAbortControllers.set(pipelineKey, abortController);

  try {
    const taskQueue = new VtTaskQueueDb();
    
    // Clean up invalid cache entries before processing any tasks (Requirements 4.1, 4.2, 4.3, 4.4)
    await executeStartupStep(
      'cleanup-invalid-cache-entries',
      async () => {
        try {
          const cleanupResult = await cacheValidator.cleanupInvalidEntries(nodeForSession);
          console.log(
            `[shapeBuildAPI] Cache cleanup completed for node ${nodeForSession}:`,
            { 
              geometryDeleted: cleanupResult.geometryDeleted,
              sourceDeleted: cleanupResult.sourceDeleted,
              totalDeleted: cleanupResult.geometryDeleted + cleanupResult.sourceDeleted
            }
          );
          return cleanupResult;
        } catch (error) {
          console.error(`[shapeBuildAPI] Cache cleanup failed for node ${nodeForSession}:`, error);
          throw new Error(`Cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    );
    
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
    await executeStartupStep(
      'clear-build-task-history',
      async () => clearBuildTasksByStage(nodeForSession, ['source', 'geometry', 'tileEmit']),
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
    const resumeExistingTasks = false;
    const existingSourceTaskCount = await executeStartupStep(
      'count-existing-source-tasks',
      async () => taskQueue.tasks.where('[nodeId+stage]').equals([nodeForSession, 'source']).count(),
      { existingTaskCount },
    );
    const plannedSourceTotal = Math.max(sourcePlan.plannedSourceTotal, existingSourceTaskCount);
    setSourcePlannedTotal(nodeForSession, plannedSourceTotal);
    await executeStartupStep(
      'upsert-session-snapshot',
      async () => upsertBuildSessionSnapshot({
        nodeId: nodeForSession,
        selectedArrayByCountries: draftEntity.selectedArrayByCountries,
        tasks: existingTaskCount === 0 ? [] : undefined,
        status: 'running',
        startedAt: buildStartedAt,
        canResume: false,
      }),
      { existingTaskCount, plannedSourceTotal },
    );
    const emitQueuedProgressSnapshot = async (payload: {
      nodeId: NodeId;
      stage: 'source';
      taskCount: number;
      source: 'created' | 'reused';
    }): Promise<void> => {
      if (payload.stage !== 'source') return;
      await emitProgressSnapshot(payload.nodeId, 'Source task plan prepared.');
    };
    const emitStageTaskSnapshotBarrier = async (payload: {
      nodeId: NodeId;
      stage: TaskStage;
      taskCount: number;
    }): Promise<void> => {
      void payload.taskCount;
      await shapeMutationAPIImpl.updateBuildSession(payload.nodeId, {
        stageId: `ui-sync:${payload.stage}:ui-initializing`,
        stageHeartbeatAt: Date.now(),
      });
      await emitTaskSnapshot(payload.nodeId, { stage: payload.stage });
      await shapeMutationAPIImpl.updateBuildSession(payload.nodeId, {
        stageId: `ui-sync:${payload.stage}:running`,
        stageHeartbeatAt: Date.now(),
      });
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
    }).catch(() => { });
    let terminalProgressMessage: string | undefined;

    // Handle empty builds (no selections and no download payloads)
    if (selectedAdminPairCount === 0 && downloadTaskPayloads.length === 0) {
      console.warn(`[shapeBuildAPI] ${startupScope} empty build - completing immediately`, {
        nodeId: nodeForSession,
        runId: pipelineRunId,
      });
      const completedAt = Date.now();
      terminalProgressMessage = 'Empty build completed successfully (no selections).';
      void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
        stageId: 'startup:pipeline-dispatch:success',
        stageHeartbeatAt: completedAt,
      }).catch(() => { });
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
      clearActivePipelineRuntimeState(nodeForSession);
      void emitProgressSnapshot(nodeForSession, terminalProgressMessage);
      return nodeForSession;
    }

    // Handle empty builds (no selections and no download payloads)
    if (selectedAdminPairCount === 0 && downloadTaskPayloads.length === 0) {
      console.warn(`[shapeBuildAPI] ${startupScope} empty build - completing immediately`, {
        nodeId: nodeForSession,
        runId: pipelineRunId,
      });
      const completedAt = Date.now();
      terminalProgressMessage = 'Empty build completed successfully (no selections).';
      void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
        stageId: 'startup:pipeline-dispatch:success',
        stageHeartbeatAt: completedAt,
      }).catch(() => { });
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
      clearActivePipelineRuntimeState(nodeForSession);
      void emitProgressSnapshot(nodeForSession, terminalProgressMessage);
      return nodeForSession;
    }
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
      abortSignal: abortController.signal,
      onTasksEnqueued: emitQueuedProgressSnapshot,
      onStageTasksPrepared: emitStageTaskSnapshotBarrier,
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
      }).catch(() => { });
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
      if (isAuthPendingPipelineError(error)) {
        terminalProgressMessage = 'Authentication required. Build paused. Resume after sign-in.';
        await updateBuildSessionFromTasks(nodeForSession, {
          status: 'paused',
          stopReason: 'user-pause',
          canResume: true,
        });
        return;
      }
      if (isSourceTaskPayloadGenerationError(error)) {
        console.error('[shapeBuildAPI] source task payload generation failed', error);
        console.error('[shapeBuildAPI] startup', JSON.stringify({
          scope: startupScope,
          phase: 'finish',
          step: 'payload-generation',
          nodeId: nodeForSession,
          runId: pipelineRunId,
          outcome: 'error',
          failedAt,
          ...diagnostics,
        }));
        terminalProgressMessage = `Metadata error: ${diagnostics.errorMessage}`;
        void shapeMutationAPIImpl.updateBuildSession(nodeForSession, {
          stageId: 'startup:payload-generation:error',
          stageHeartbeatAt: failedAt,
        }).catch(() => { });
        await updateBuildSessionFromTasks(nodeForSession, {
          status: 'failed',
          stopReason: 'failed',
          completedAt: failedAt,
          canResume: false,
        });
        return;
      }
      console.error('[shapeBuildAPI] tileEmit pipeline failed', error);
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
      }).catch(() => { });
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const waitForRunningTasksToDrain = async (
  nodeId: NodeId,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<{ drained: boolean; durationMs: number; running: number; queued: number; total: number }> => {
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
    durationMs: Date.now() - startedAt,
    running: latest.running,
    queued: Math.max(0, latest.total - latest.completed - latest.failed - latest.running),
    total: latest.total,
  };
};

const resetRunningTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
  if (runningTasks.length === 0) return;

  // Preserve all task state during force termination - only change status to queued
  // This ensures compliance with Requirements 1.4: Task state preservation
  await Promise.all(runningTasks.map((task) => (
    updateTask(taskQueue, task.taskId, {
      status: 'queued',
      // Preserve all existing state: startedAt, completedAt, outputData, errorMessage, display, message
      // Do NOT set these to undefined as that would violate state preservation requirements
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

    // Measure termination time
    const terminationStartTime = Date.now();

    setPaused(nodeId, true);

    // Immediately abort all running tasks
    const pipelineKey = String(nodeId);
    const abortController = sessionAbortControllers.get(pipelineKey);
    if (abortController) {
      abortController.abort();
    }

    // Implement timeout mechanism for force termination
    const FORCE_TERMINATION_TIMEOUT_MS = 1000;
    let forceTerminationExecuted = false;

    // Set up force termination timeout
    const forceTerminationTimer = setTimeout(async () => {
      if (forceTerminationExecuted) return;
      forceTerminationExecuted = true;

      const durationMs = Date.now() - terminationStartTime;
      console.warn('[shapeBuildAPI][PauseTrace] force-termination-triggered', {
        nodeId,
        durationMs,
        timeoutMs: FORCE_TERMINATION_TIMEOUT_MS,
      });

      // Attempt to terminate worker if available
      const workerInstance = sessionWorkerInstances.get(pipelineKey);
      if (workerInstance?.terminate) {
        try {
          workerInstance.terminate();
          console.warn('[shapeBuildAPI][PauseTrace] worker-terminated', {
            nodeId,
            durationMs: Date.now() - terminationStartTime,
          });
        } catch (error) {
          console.error('[shapeBuildAPI][PauseTrace] worker-termination-failed', {
            nodeId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        console.warn('[shapeBuildAPI][PauseTrace] worker-instance-not-available', {
          nodeId,
          durationMs: Date.now() - terminationStartTime,
        });
      }

      // Force reset running tasks regardless of worker termination
      await resetRunningTasks(nodeId);

      // Update session state
      await upsertBuildSessionSnapshot({
        nodeId,
        status: 'paused',
        stopReason,
        canResume: true,
      });
      await emitProgressSnapshot(nodeId, 'Force termination completed.');
    }, FORCE_TERMINATION_TIMEOUT_MS);

    await resetRunningTasks(nodeId);
    void (async () => {
      try {
        const initialDrain = await waitForRunningTasksToDrain(nodeId, { timeoutMs: 3_000 });

        // Check if cooperative termination completed within timeout
        const terminationElapsed = Date.now() - terminationStartTime;
        if (terminationElapsed <= FORCE_TERMINATION_TIMEOUT_MS && !forceTerminationExecuted) {
          // Cooperative termination succeeded, cancel force termination
          clearTimeout(forceTerminationTimer);
          console.warn('[shapeBuildAPI][PauseTrace] cooperative-termination-success', {
            nodeId,
            durationMs: terminationElapsed,
            targetMs: FORCE_TERMINATION_TIMEOUT_MS,
          });
        } else if (terminationElapsed > FORCE_TERMINATION_TIMEOUT_MS) {
          console.warn('[shapeBuildAPI][PauseTrace] termination-timeout-exceeded', {
            nodeId,
            durationMs: terminationElapsed,
            targetMs: FORCE_TERMINATION_TIMEOUT_MS,
          });
        }

        if (initialDrain.running > 0) {
          console.warn('[shapeBuildAPI][PauseTrace] pause-requeue-not-complete', {
            nodeId,
            ...initialDrain,
          });
        }

        // Only update session state if force termination hasn't been executed
        if (!forceTerminationExecuted) {
          await upsertBuildSessionSnapshot({
            nodeId,
            status: 'paused',
            stopReason,
            canResume: true,
          });
          await emitProgressSnapshot(nodeId, 'Pause requested.');
        }

        const drain = await waitForRunningTasksToDrain(nodeId);
        console.warn('[shapeBuildAPI][PauseTrace] pause-settled', {
          nodeId,
          ...drain,
        });
        if (!drain.drained && !forceTerminationExecuted) {
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
    setSourcePlannedTotal(nodeId, 0);
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
