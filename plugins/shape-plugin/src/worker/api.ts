/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BuildContinuationPolicy, TaskDisplayPayload, TaskQueueRecord, TaskStage } from '@hierarchidb/batch-api';
import type { ShapeBuildSessionRecord, ShapeBuildStopReason } from '@hierarchidb/shape-api';
import { Dexie } from 'dexie';
import type {
  ShapeBuildConfig,
  ShapeProcessingConfig,
  ShapeRuntimeBuildConfig,
} from '../common/types/index.js';
import {
  type BuildSession,
  type BuildTask,
  type CountryMetadata,
  type DataSourceConfig,
  type DataSourceName,
  SHAPE_DATA_SOURCES,
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  composeRuntimeBuildConfig,
  mergeBuildConfig,
  mergeProcessingConfig,
  isDataSourceName,
  requireDataSourceName,
  type ProcessingStatus,
  type ProgressInfo,
  type TileInfo,
  type FetchTaskPayload,
  validateBatchConfig,
  type ShapeStepValidationResult,
  type SelectedArrayByCountries,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import {
  type BuildProgressEvent,
  type BuildProgressPayload,
  type BuildTaskSummary,
  type BuildTaskUpdateEvent,
  type ProgressPhase,
} from '@hierarchidb/batch-api';
import {
  countSelectedAdminPairs,
  generateDownloadTaskPayloads,
  getPreferredCountryCodeFormat,
} from '../services/utils/utils.js';
import {
  deleteRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNodeMetadataIds,
} from '../services/utils/chunkStore.js';
import { normalizeCountryCodeFormat } from '../services/utils/iso3166.js';
import { resolveFetchStageStrategy } from '../services/batch/strategies/resolveFetchStageStrategy.ts';
import { toBuildSessionRecord } from '../services/batch/shapeSessionMappers.ts';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  deleteTasksByIds,
  listTasks,
  listTasksByStage,
  listTasksByStatus,
  onTaskQueueUpdate,
  putTasks,
  updateTask,
} from '@hierarchidb/vt-orchestrator';
import type { BuildSessionConfig, BuildSessionRecord, BuildTaskRecord, StageStatus } from '@hierarchidb/shape-store';
import { ephemeralDB, type EphemeralBuildTaskRecord } from '@hierarchidb/gis-sdk';
import { runShapePipeline } from '../services/vt/shapePipeline.js';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../services/batch/ShapeBuildAPIClient.ts';
import { isTaskSkipped } from '../common/utils/taskMessages.ts';
import { buildShapeTaskTitle } from '../common/utils/taskTitles.ts';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import {
  resolveTaskActivityTimestamp,
  resolveTaskProcessingTimestamp,
  selectLatestTaskBySequence,
} from './taskOrdering.ts';
import { getStagePlan, setFetchPlannedTotal } from '../services/vt/shapeProgressPlan.ts';
import { shouldReuseTaskQueueOnStart } from './shouldReuseTaskQueueOnStart.ts';

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
  console.warn('[shapeBatchAPI] no fetch payloads from cached metadata; retrying with force refresh', {
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
    `[shapeBatchAPI] No fetch task payloads generated for ${selectedAdminPairCount}`
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

  console.warn('[shapeBatchAPI] config invalidation applied', {
    nodeId,
    fetch: plan.fetch,
    transform: plan.transform,
    vt: plan.vt,
  });
};

const mapBuildSessionRecordToBuildSession = (
  record: BuildSessionRecord,
  config: BuildSessionConfig,
): BuildSession => ({
  nodeId: record.nodeId,
  draftId: record.draftId,
  status: record.status,
  config,
  startedAt: record.startedAt,
  updatedAt: record.updatedAt,
  completedAt: record.completedAt,
  progress: record.progress,
  canResume: record.canResume,
  lastActivity: record.lastActivity ?? record.updatedAt,
  expiresAt: record.expiresAt,
  stages: record.stages,
  resourceUsage: record.resourceUsage,
});

const resolveBuildSessionConfig = async (nodeId: NodeId): Promise<BuildSessionConfig> => {
  const handler = getShapeEntityHandler();
  const entity = await handler.getEntity(nodeId);
  const mergedBuildConfig = mergeBuildConfig(
    DEFAULT_BUILD_CONFIG,
    entity?.buildConfig ?? {},
  );
  const mergedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    entity?.processingConfig ?? {},
  );
  return buildBuildSessionConfig(composeRuntimeBuildConfig(mergedBuildConfig, mergedProcessingConfig));
};

type TaskQueueStatusCounts = {
  total: number;
  running: number;
  completed: number;
  failed: number;
  recycled: number;
};

const countTaskQueueStatuses = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
): Promise<TaskQueueStatusCounts> => {
  const [total, running, completed, failed, recycled] = await Promise.all([
    taskQueue.tasks.where('nodeId').equals(nodeId).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'running']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'completed']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'failed']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'recycled']).count(),
  ]);
  return { total, running, completed, failed, recycled };
};

const resolveBuildSessionStatusFromCounts = (
  nodeId: NodeId,
  counts: TaskQueueStatusCounts,
): BuildSession['status'] => {
  const effectiveTotal = Math.max(0, counts.total - counts.recycled);
  if (getPauseState(nodeId).paused) return 'paused';
  if (counts.running > 0) return 'running';
  if (counts.failed > 0) return 'failed';
  if (effectiveTotal > 0 && counts.completed + counts.failed >= effectiveTotal) return 'completed';
  if (effectiveTotal > 0) return 'queued';
  if (counts.recycled > 0) return 'completed';
  return 'idle';
};

const buildProgressFromCounts = (counts: TaskQueueStatusCounts): BuildSession['progress'] => {
  const effectiveTotal = Math.max(0, counts.total - counts.recycled);
  const doneCount = Math.min(effectiveTotal, counts.completed + counts.failed);
  return {
    total: effectiveTotal,
    completed: counts.completed,
    failed: counts.failed,
    skipped: 0,
    percentage: effectiveTotal > 0 ? Math.round((doneCount / effectiveTotal) * 100) : 0,
  };
};

const getBuildSessionInternal = async (nodeId: NodeId): Promise<BuildSession | undefined> => {
  const config = await resolveBuildSessionConfig(nodeId);
  const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
  const buildSession = sessionRecord ? toBuildSessionRecord(sessionRecord) : null;
  if (buildSession) {
    return mapBuildSessionRecordToBuildSession(buildSession, config);
  }

  const taskQueue = new VtTaskQueueDb();
  const counts = await countTaskQueueStatuses(taskQueue, nodeId);
  if (counts.total === 0) return undefined;

  const firstTask = await taskQueue.tasks
    .where('[nodeId+index]')
    .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
    .first();
  const now = Date.now();
  const status = resolveBuildSessionStatusFromCounts(nodeId, counts);
  const progress = buildProgressFromCounts(counts);
  const startedAt = typeof firstTask?.createdAt === 'number' ? firstTask.createdAt : now;

  return {
    draftId: nodeId,
    nodeId,
    status,
    config,
    startedAt,
    updatedAt: now,
    completedAt: status === 'completed' ? now : undefined,
    progress,
    canResume: status === 'paused',
    lastActivity: now,
    expiresAt: resolveSessionExpiresAt(now),
    stages: {},
    resourceUsage: undefined,
  };
};

interface ProgressSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildProgressEvent) => void;
}

interface TaskSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildTaskUpdateEvent) => void;
}

type PauseState = {
  paused: boolean;
  waiters: Array<() => void>;
};

const progressCallbacks = new Map<string, ProgressSubscription>();
const taskCallbacks = new Map<string, TaskSubscription>();
const pauseStates = new Map<string, PauseState>();
const activePipelines = new Set<string>();
const activePipelineRuns = new Map<string, string>();
const sessionSubscriptions = new Map<string, () => void>();
const STALE_PIPELINE_GRACE_MS = 30_000;

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const resolveEffectiveTaskStatus = (task: TaskQueueRecord): TaskQueueRecord['status'] => {
  if (task.stage !== 'vt') return task.status;
  if (task.status !== 'completed') return task.status;
  const progress = typeof task.progress === 'number' ? task.progress : 0;
  const isFinal = typeof task.completedAt === 'number' || progress >= 100;
  return isFinal ? task.status : 'running';
};

const resolveTaskProgress = (task: TaskQueueRecord): number => {
  return task.progress ?? 0;
};

const validTaskStages: TaskQueueRecord['stage'][] = ['fetch', 'transform', 'vt'];
const validTaskStatuses: TaskQueueRecord['status'][] = [
  'queued',
  'running',
  'completed',
  'failed',
  'recycled',
];

const isValidTaskStage = (value: unknown): value is TaskQueueRecord['stage'] => (
  typeof value === 'string' && validTaskStages.includes(value as TaskQueueRecord['stage'])
);

const isValidTaskStatus = (value: unknown): value is TaskQueueRecord['status'] => (
  typeof value === 'string' && validTaskStatuses.includes(value as TaskQueueRecord['status'])
);

const normalizeTaskPhase = (status: TaskQueueRecord['status']): ProgressPhase => status;


type BuildTaskRecordLike = BuildTaskRecord | EphemeralBuildTaskRecord;

const normalizeResumedTaskStatus = (status: BuildTaskRecordLike['status']): TaskQueueRecord['status'] => {
  if (status === 'failed' || status === 'running') {
    return 'queued';
  }
  return status;
};

const isStopReason = (value: string): value is ShapeBuildStopReason => (
  value === 'route-leave'
  || value === 'user-pause'
  || value === 'failed'
  || value === 'completed'
  || value === 'unknown'
);

const mapBuildTaskToQueueTask = (task: BuildTaskRecordLike): TaskQueueRecord => {
  const nextStatus = normalizeResumedTaskStatus(task.status);
  const shouldKeepOutput = nextStatus === 'completed' || nextStatus === 'recycled';
  const resolvedProgress = shouldKeepOutput
    ? (Number.isFinite(task.progress) ? Math.min(100, Math.max(0, task.progress)) : 100)
    : 0;
  const keepMessage = shouldKeepOutput ? task.message : undefined;
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: task.taskType,
    status: nextStatus,
    index: task.index,
    progress: resolvedProgress,
    display: shouldKeepOutput ? task.display : undefined,
    message: keepMessage,
    inputData: task.inputData,
    outputData: shouldKeepOutput ? task.outputData : undefined,
    errorMessage: undefined,
  };
};

const BUILD_TASK_SEED_BATCH_SIZE = 250;

const seedTaskQueueFromBuildTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  let scannedCount = 0;
  let queuedCount = 0;
  let skippedCount = 0;
  let batch: TaskQueueRecord[] = [];
  let writeChain = Promise.resolve();

  const flushBatch = (): void => {
    if (batch.length === 0) return;
    const nextBatch = batch;
    batch = [];
    queuedCount += nextBatch.length;
    writeChain = writeChain.then(() => putTasks(taskQueue, nextBatch));
  };

  await ephemeralDB.buildTasks
    .where('[nodeId+index]')
    .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
    .each((task) => {
      scannedCount += 1;
      if (!isValidTaskStage(task.taskType) || !isValidTaskStatus(task.status)) {
        skippedCount += 1;
        return;
      }
      batch.push(mapBuildTaskToQueueTask(task));
      if (batch.length >= BUILD_TASK_SEED_BATCH_SIZE) {
        flushBatch();
      }
    });

  flushBatch();
  await writeChain;

  console.warn('[shapeBatchAPI] seed task queue from build tasks', JSON.stringify({
    nodeId,
    scannedCount,
    queuedCount,
    skippedCount,
  }));
};

const purgeLegacyBuildTasks = async (nodeId: NodeId): Promise<number> => {
  const invalidTaskIds: string[] = [];
  await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).each((task) => {
    if (!isValidTaskStatus(task.status) || !isValidTaskStage(task.taskType)) {
      invalidTaskIds.push(task.taskId);
    }
  });
  if (invalidTaskIds.length === 0) return 0;
  await ephemeralDB.buildTasks.bulkDelete(invalidTaskIds);
  console.warn('[shapeBatchAPI] purged legacy build tasks', JSON.stringify({
    nodeId,
    removedCount: invalidTaskIds.length,
  }));
  return invalidTaskIds.length;
};

const purgeLegacyTaskQueue = async (nodeId: NodeId, taskQueue: VtTaskQueueDb): Promise<number> => {
  const removedTaskIds: string[] = [];
  const tasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
  tasks.forEach((task) => {
    if (!isValidTaskStatus(task.status) || !isValidTaskStage(task.stage)) {
      removedTaskIds.push(task.taskId);
      return;
    }
    if (task.metadata && typeof task.metadata === 'object') {
      const metadata = task.metadata as Record<string, unknown>;
      if (metadata.cacheReuse === true) {
        removedTaskIds.push(task.taskId);
      }
    }
  });
  if (removedTaskIds.length === 0) return 0;
  await deleteTasksByIds(taskQueue, removedTaskIds);
  console.warn('[shapeBatchAPI] purged legacy task queue records', JSON.stringify({
    nodeId,
    removedCount: removedTaskIds.length,
  }));
  return removedTaskIds.length;
};

const ensureTaskQueueSeeded = async (nodeId: NodeId, taskQueue: VtTaskQueueDb): Promise<void> => {
  await purgeLegacyTaskQueue(nodeId, taskQueue);
  await purgeLegacyBuildTasks(nodeId);
  const existingCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
  if (existingCount > 0) return;
  const buildTaskCount = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).count();
  if (buildTaskCount === 0) return;
  await seedTaskQueueFromBuildTasks(nodeId);
};


const buildTaskSummaryFields = (
  task: TaskQueueRecord,
): {
  message?: string;
  title?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  sequence?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
} => ({
  message: task.message ?? task.errorMessage,
  title: buildShapeTaskTitle(task),
  error: task.errorMessage,
  errorMessage: task.errorMessage,
  index: task.index,
  sequence: task.sequence,
  stagePriority: task.stagePriority,
  metadata: task.metadata,
});

const mapTaskQueueRecordToTaskSummary = (
  task: TaskQueueRecord,
): ShapeBuildTaskSummary => {
  const base = buildTaskSummaryFields(task);
  return {
    taskId: task.taskId,
    stage: task.stage,
    status: normalizeTaskPhase(resolveEffectiveTaskStatus(task)),
    progress: resolveTaskProgress(task),
    display: task.display,
    message: base.message,
    title: base.title,
    error: base.error,
    errorMessage: base.errorMessage,
    index: base.index,
    sequence: base.sequence,
    stagePriority: base.stagePriority,
    metadata: base.metadata,
  };
};

type ShapeBuildTaskSummary = BuildTaskSummary & {
  title?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  sequence?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
};

type ProgressTaskMeta = {
  taskId: string;
  sequence?: number;
  status: TaskQueueRecord['status'];
  stage: TaskQueueRecord['stage'];
  progress: number;
  title?: string;
  display?: TaskDisplayPayload;
};

const resolveTaskType = (tasks: TaskQueueRecord[]): TaskQueueRecord['stage'] | undefined => {
  const stageOrder: Array<TaskQueueRecord['stage']> = ['fetch', 'transform', 'vt'];
  return stageOrder.find((stage) => (
    tasks.some((task) => {
      const status = resolveEffectiveTaskStatus(task);
      return task.stage === stage && status !== 'completed' && status !== 'failed' && status !== 'recycled';
    })
  ));
};

const summarizeTaskQueueStatus = (tasks: TaskQueueRecord[]) => {
  const nonRecycled = tasks.filter((task) => resolveEffectiveTaskStatus(task) !== 'recycled');
  const total = nonRecycled.length;
  const completed = nonRecycled.filter((task) => {
    const status = resolveEffectiveTaskStatus(task);
    return status === 'completed' && !isTaskSkipped(task.display, task.message);
  }).length;
  const failed = nonRecycled.filter((task) => resolveEffectiveTaskStatus(task) === 'failed').length;
  const skipped = nonRecycled.filter((task) => isTaskSkipped(task.display, task.message)).length;
  const doneCount = Math.min(total, completed + skipped + failed);
  const hasRecycled = tasks.length > total;
  const status: BuildTask['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : total > 0
        ? 'running'
        : hasRecycled
          ? 'completed'
          : 'idle';
  return {
    status,
    taskType: resolveTaskType(tasks),
  };
};

const summarizeTaskQueueProgress = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  taskType?: TaskQueueRecord['stage'],
): Promise<ProgressInfo> => {
  const stageCounts: Record<TaskQueueRecord['stage'], {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    recycled: number;
  }> = {
    fetch: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    transform: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    vt: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
  };
  tasks.forEach((task) => {
    const bucket = stageCounts[task.stage];
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      bucket.recycled += 1;
      return;
    }
    bucket.total += 1;
    if (isTaskSkipped(task.display, task.message)) {
      bucket.skipped += 1;
      return;
    }
    if (status === 'failed') {
      bucket.failed += 1;
      return;
    }
    if (status === 'completed') {
      bucket.completed += 1;
    }
  });
  const completed = stageCounts.fetch.completed + stageCounts.transform.completed + stageCounts.vt.completed;
  const failed = stageCounts.fetch.failed + stageCounts.transform.failed + stageCounts.vt.failed;
  const skipped = stageCounts.fetch.skipped + stageCounts.transform.skipped + stageCounts.vt.skipped;
  const plan = getStagePlan(nodeId);
  const resolveStageTotal = (
    counts: typeof stageCounts[keyof typeof stageCounts],
    planned?: number,
  ): number => {
    if (typeof planned !== 'number') return counts.total;
    const adjustedPlan = Math.max(0, planned - counts.recycled);
    return Math.max(counts.total, adjustedPlan);
  };
  const total = resolveStageTotal(stageCounts.fetch, plan?.fetchTotal)
    + resolveStageTotal(stageCounts.transform, plan?.transformTotal)
    + resolveStageTotal(stageCounts.vt);
  let resolvedTaskType = taskType;
  if (!resolvedTaskType && tasks.length === 0 && plan?.fetchTotal && plan.fetchTotal > 0) {
    resolvedTaskType = 'fetch';
  }
  if (!resolvedTaskType && tasks.length === 0 && plan?.transformTotal && plan.transformTotal > 0) {
    resolvedTaskType = 'transform';
  }
  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType: resolvedTaskType,
  };
};

const buildTaskQueueSummary = async (nodeId: NodeId, tasks: TaskQueueRecord[]) => {
  const statusSummary = summarizeTaskQueueStatus(tasks);
  const progress = await summarizeTaskQueueProgress(nodeId, tasks, statusSummary.taskType);
  return {
    status: statusSummary.status,
    progress,
  };
};

const buildTaskSummarySnapshot = async (
  nodeId: NodeId,
  taskQueue: VtTaskQueueDb,
): Promise<ShapeBuildTaskSummary[]> => {
  const tasks = await listTasks(taskQueue, nodeId);
  return tasks.map((task) => mapTaskQueueRecordToTaskSummary(task));
};

const buildProgressPayloadFromTasks = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  options?: { eventTask?: TaskQueueRecord; source?: 'event' | 'snapshot' },
): Promise<BuildProgressPayload> => {
  const summary = await summarizeTaskQueueProgress(nodeId, tasks, resolveTaskType(tasks));
  const stageStatusMap = buildStageStatusMap(nodeId, tasks);
  const progressTask = options?.eventTask ?? selectLatestTaskBySequence(tasks) ?? undefined;
  const meta: Record<string, unknown> = {};
  if (progressTask) {
    const progressTaskSummary = buildTaskSummaryFields(progressTask);
    const progressTaskMeta: ProgressTaskMeta = {
      taskId: progressTask.taskId,
      sequence: Number.isFinite(progressTask.sequence) ? progressTask.sequence : undefined,
      status: progressTask.status,
      stage: progressTask.stage,
      progress: resolveTaskProgress(progressTask),
      title: progressTaskSummary.title,
      display: progressTask.display,
    };
    meta.progressTask = progressTaskMeta;
  }
  if (options?.source) {
    meta.source = options.source;
  }
  meta.stageTotals = {
    fetch: {
      total: stageStatusMap.fetch.tasksTotal,
      completed: stageStatusMap.fetch.tasksCompleted,
      failed: stageStatusMap.fetch.tasksFailed,
    },
    transform: {
      total: stageStatusMap.transform.tasksTotal,
      completed: stageStatusMap.transform.tasksCompleted,
      failed: stageStatusMap.transform.tasksFailed,
    },
    vt: {
      total: stageStatusMap.vt.tasksTotal,
      completed: stageStatusMap.vt.tasksCompleted,
      failed: stageStatusMap.vt.tasksFailed,
    },
  };
  return {
    total: summary.total,
    completed: summary.completed,
    failed: summary.failed,
    skipped: summary.skipped,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
};

const isTaskStageValue = (value: unknown): value is TaskQueueRecord['stage'] => (
  value === 'fetch' || value === 'transform' || value === 'vt'
);

const buildStageStatus = (tasks: TaskQueueRecord[], plannedTotal?: number): StageStatus => {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  let recycled = 0;
  let actualTotal = 0;
  tasks.forEach((task) => {
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      recycled += 1;
      return;
    }
    actualTotal += 1;
    if (status === 'failed') {
      failed += 1;
      return;
    }
    if (status === 'completed') {
      if (isTaskSkipped(task.display, task.message)) {
        skipped += 1;
      } else {
        completed += 1;
      }
      return;
    }
    if (status === 'running') {
      running += 1;
    }
  });
  const adjustedPlannedTotal = typeof plannedTotal === 'number'
    ? Math.max(0, plannedTotal - recycled)
    : undefined;
  const total = typeof adjustedPlannedTotal === 'number'
    ? Math.max(adjustedPlannedTotal, actualTotal)
    : actualTotal;
  const doneCount = Math.min(total, completed + skipped + failed);
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const status: StageStatus['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : running > 0
        ? 'running'
        : recycled > 0
          ? 'completed'
          : 'queued';
  return {
    status,
    progress,
    tasksTotal: total,
    tasksCompleted: completed + skipped,
    tasksFailed: failed,
  };
};

const buildStageStatusMap = (
  nodeId: NodeId,
  tasks: TaskQueueRecord[]
): Record<TaskQueueRecord['stage'], StageStatus> => {
  const plan = getStagePlan(nodeId);
  return {
    fetch: buildStageStatus(tasks.filter((task) => task.stage === 'fetch'), plan?.fetchTotal),
    transform: buildStageStatus(tasks.filter((task) => task.stage === 'transform'), plan?.transformTotal),
    vt: buildStageStatus(tasks.filter((task) => task.stage === 'vt')),
  };
};

const resolveSessionStatus = (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
): ShapeBuildSessionRecord['status'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  return summarizeTaskQueueStatus(tasks).status;
};

const resolveSessionLastActivity = (tasks: TaskQueueRecord[]): number => {
  const latest = selectLatestTaskBySequence(tasks);
  const timestamp = latest ? resolveTaskActivityTimestamp(latest) : Date.now();
  return timestamp > 0 ? timestamp : Date.now();
};

const resolveSessionExpiresAt = (lastActivity: number): number => (
  lastActivity + 5 * 60 * 1000
);

const updateBuildSessionFromTasks = async (
  nodeId: NodeId,
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): Promise<void> => {
  try {
    const taskQueue = new VtTaskQueueDb();
    const tasks = await listTasks(taskQueue, nodeId);
    const status = overrides?.status ?? resolveSessionStatus(nodeId, tasks);
    await upsertBuildSessionSnapshot({
      nodeId,
      tasks,
      status,
      stopReason: overrides?.stopReason,
      canResume: overrides?.canResume,
      completedAt: overrides?.completedAt,
    });
  } catch (error) {
    console.warn('[shapeBatchAPI] build session update failed', error);
  }
};

const upsertBuildSessionSnapshot = async (
  input: {
    nodeId: NodeId;
    draftId?: NodeId;
    selectedArrayByCountries?: SelectedArrayByCountries;
    tasks?: TaskQueueRecord[];
    status: ShapeBuildSessionRecord['status'];
    startedAt?: number;
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): Promise<void> => {
  const now = Date.now();
  const existing = await shapeQueryAPIImpl.getBuildSessionRecord(input.nodeId).catch(() => null);
  const progress = input.tasks
    ? await summarizeTaskQueueProgress(input.nodeId, input.tasks, resolveTaskType(input.tasks))
    : (existing?.progress ?? {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    });
  const stages = input.tasks ? buildStageStatusMap(input.nodeId, input.tasks) : (existing?.stages ?? {});
  const startedAt = existing?.startedAt ?? input.startedAt ?? now;
  const lastActivity = input.tasks
    ? resolveSessionLastActivity(input.tasks)
    : (existing?.lastActivity ?? now);
  const expiresAt = input.tasks
    ? resolveSessionExpiresAt(lastActivity)
    : (existing?.expiresAt ?? resolveSessionExpiresAt(lastActivity));
  const record: ShapeBuildSessionRecord = {
    nodeId: input.nodeId,
    draftId: input.draftId ?? existing?.draftId,
    status: input.status,
    selectedArrayByCountries: input.selectedArrayByCountries ?? existing?.selectedArrayByCountries,
    startedAt,
    updatedAt: now,
    completedAt: input.completedAt,
    progress,
    stages,
    stopReason: input.stopReason,
    canResume: input.canResume,
    lastActivity,
    expiresAt,
    inactiveMs: existing?.inactiveMs,
    lastHeartbeatAt: existing?.lastHeartbeatAt,
    stageInactiveMs: existing?.stageInactiveMs,
    stageStartedAt: existing?.stageStartedAt,
    stageHeartbeatAt: existing?.stageHeartbeatAt,
    stageId: existing?.stageId,
  };
  await shapeMutationAPIImpl.upsertBuildSession(record);
};

type BuildSessionUpdateState = {
  timer: ReturnType<typeof setTimeout> | null;
  pending: boolean;
  running: boolean;
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  };
};

const BUILD_SESSION_UPDATE_DEBOUNCE_MS = 1000;
const buildSessionUpdateStates = new Map<string, BuildSessionUpdateState>();

const scheduleBuildSessionUpdate = (
  nodeId: NodeId,
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): void => {
  const key = String(nodeId);
  const state = buildSessionUpdateStates.get(key) ?? {
    timer: null,
    pending: false,
    running: false,
  };
  if (!state.running && state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.pending = true;
  state.overrides = overrides ?? state.overrides;
  const run = async () => {
    if (state.running) return;
    state.timer = null;
    state.running = true;
    try {
      const nextOverrides = state.overrides;
      state.overrides = undefined;
      state.pending = false;
      await updateBuildSessionFromTasks(nodeId, nextOverrides);
    } finally {
      state.running = false;
      if (state.pending) {
        state.timer = setTimeout(run, BUILD_SESSION_UPDATE_DEBOUNCE_MS);
      }
    }
  };
  state.timer = setTimeout(run, BUILD_SESSION_UPDATE_DEBOUNCE_MS);
  buildSessionUpdateStates.set(key, state);
};

const startSessionTracking = (nodeId: NodeId): void => {
  const key = String(nodeId);
  if (sessionSubscriptions.has(key)) return;
  const unsubscribe = onTaskQueueUpdate(nodeId, () => {
    scheduleBuildSessionUpdate(nodeId);
  });
  sessionSubscriptions.set(key, unsubscribe);
};

const stopSessionTracking = (nodeId: NodeId): void => {
  const key = String(nodeId);
  const unsubscribe = sessionSubscriptions.get(key);
  if (unsubscribe) {
    unsubscribe();
  }
  sessionSubscriptions.delete(key);
};

const readPipelineStartedAt = (nodeId: NodeId): number | null => {
  const runId = activePipelineRuns.get(String(nodeId));
  if (!runId) return null;
  const separator = runId.lastIndexOf(':');
  if (separator <= 0 || separator >= runId.length - 1) return null;
  const parsed = Number(runId.slice(separator + 1));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const clearActivePipelineRuntimeState = (nodeId: NodeId): void => {
  const pipelineKey = String(nodeId);
  activePipelines.delete(pipelineKey);
  activePipelineRuns.delete(pipelineKey);
  pauseStates.delete(pipelineKey);
  stopSessionTracking(nodeId);
};

const clearStalePipelineStateIfInactive = async (
  nodeId: NodeId,
  sessionRecord: ShapeBuildSessionRecord | null,
  source: 'startBuildSession' | 'startBatchProcess' | 'resumeBuildSession',
): Promise<boolean> => {
  const pipelineKey = String(nodeId);
  if (!activePipelines.has(pipelineKey)) return false;
  const now = Date.now();
  const pipelineStartedAt = readPipelineStartedAt(nodeId);
  if (pipelineStartedAt !== null && now - pipelineStartedAt < STALE_PIPELINE_GRACE_MS) {
    return false;
  }
  const sessionUpdatedAt = sessionRecord?.updatedAt;
  if (typeof sessionUpdatedAt === 'number' && now - sessionUpdatedAt < STALE_PIPELINE_GRACE_MS) {
    return false;
  }
  const taskQueue = new VtTaskQueueDb();
  const [runningTasks, queuedTasks] = await Promise.all([
    listTasksByStatus(taskQueue, nodeId, 'running'),
    listTasksByStatus(taskQueue, nodeId, 'queued'),
  ]);
  if (runningTasks.length > 0 || queuedTasks.length > 0) return false;
  clearActivePipelineRuntimeState(nodeId);
  console.warn('[shapeBatchAPI] stale pipeline state cleared', {
    nodeId,
    source,
    sessionStatus: sessionRecord?.status ?? null,
    runningTaskCount: runningTasks.length,
    queuedTaskCount: queuedTasks.length,
  });
  return true;
};

type StartBuildSessionScope = 'startBuildSession' | 'startBatchProcess';

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
    console.warn('[shapeBatchAPI] startup', JSON.stringify(payload));
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
      '[shapeBatchAPI] Build has selected inputs but generated 0 fetch tasks.'
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
    console.warn(`[shapeBatchAPI] ${startupScope} pipeline start`, {
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
      console.error('[shapeBatchAPI] vt pipeline failed', error);
      console.error('[shapeBatchAPI] startup', JSON.stringify({
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
          console.error('[shapeBatchAPI] progress payload build failed', error);
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
  console.warn('[shapeBatchAPI][TaskDebug] normalizeTaskQueueStageFields start', {
    tag: debugTag,
    nodeId,
    patchCount: patches.length,
  });
  let waitTimer: ReturnType<typeof setInterval> | null = null;
  waitTimer = setInterval(() => {
    console.warn('[shapeBatchAPI][TaskDebug] normalizeTaskQueueStageFields waiting', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  }, 5000);
  try {
    await Promise.all(patches.map((patch) => taskQueue.tasks.update(patch.taskId, patch.updates)));
    console.warn('[shapeBatchAPI][TaskDebug] normalizeTaskQueueStageFields done', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  } finally {
    if (waitTimer) clearInterval(waitTimer);
  }
};

const getPauseState = (nodeId: NodeId): PauseState => {
  const key = String(nodeId);
  const existing = pauseStates.get(key);
  if (existing) return existing;
  const state: PauseState = { paused: false, waiters: [] };
  pauseStates.set(key, state);
  return state;
};

const waitIfPaused = async (nodeId: NodeId): Promise<void> => {
  const state = getPauseState(nodeId);
  if (!state.paused) return;
  const startedAt = Date.now();
  console.warn('[shapeBatchAPI][PauseTrace] wait-enter', {
    nodeId,
    waitersBefore: state.waiters.length,
  });
  await new Promise<void>((resolve) => {
    state.waiters.push(resolve);
  });
  console.warn('[shapeBatchAPI][PauseTrace] wait-exit', {
    nodeId,
    elapsedMs: Date.now() - startedAt,
    waitersRemaining: state.waiters.length,
  });
};

const setPaused = (nodeId: NodeId, paused: boolean): void => {
  const state = getPauseState(nodeId);
  state.paused = paused;
  console.warn('[shapeBatchAPI][PauseTrace] state-update', {
    nodeId,
    paused,
    waiters: state.waiters.length,
    pipelineActive: activePipelines.has(String(nodeId)),
  });
  if (!paused && state.waiters.length > 0) {
    const pending = [...state.waiters];
    state.waiters.length = 0;
    pending.forEach((resolve) => {resolve()});
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

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): BuildProgressEvent['phase'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  const status = summarizeTaskQueueStatus(tasks).status;
  if (status === 'completed' && activePipelines.has(String(nodeId))) {
    return 'running';
  }
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
};

const emitProgressSnapshot = async (
  nodeId: NodeId,
  message?: string,
): Promise<void> => {
  const sub = progressCallbacks.get(String(nodeId));
  if (!sub?.callback) {
    if (typeof message === 'string' && message.length > 0) {
      console.warn('[shapeBatchAPI] progress snapshot skipped (no subscriber)', JSON.stringify({
        nodeId,
        message,
      }));
    }
    return;
  }
  try {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    const phase = resolveProgressPhase(nodeId, vtTasks);
    const statusSummary = summarizeTaskQueueStatus(vtTasks);
    const payload = await buildProgressPayloadFromTasks(nodeId, vtTasks, { source: 'snapshot' });
    sub.callback({
      nodeId,
      stage: statusSummary.taskType ?? 'fetch',
      phase,
      timestamp: Date.now(),
      message,
      payload,
    });
  } catch (error) {
    console.error('[shapeBatchAPI] progress snapshot build failed', error);
  }
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


export const shapeBatchAPI = {

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return SHAPE_DATA_SOURCES;
  },

  getCountryMetadata: async (nodeId: NodeId, dataSource: DataSourceName): Promise<CountryMetadata[]> => {
    const data = await metadataLoader.loadMetadata(dataSource, nodeId);
    if (Array.isArray(data) && data.length > 0) return data;
    throw new Error(`No country metadata returned for data source: ${dataSource}`);
  },

  generateDownloadTaskPayloads: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    countries: string[],
    adminLevels: number[],
  ): Promise<FetchTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloads');
    // Get country metadata first
    const preferredFormat = getPreferredCountryCodeFormat(resolvedDataSource);
    const normalizedCountries = await Promise.all(
      countries.map((code) => normalizeCountryCodeFormat(code, preferredFormat)),
    );
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(nodeId, resolvedDataSource);
    return generateDownloadTaskPayloads(resolvedDataSource, normalizedCountries, adminLevels, countryMetadata);
  },

  generateDownloadTaskPayloadsFromSelection: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    selectedArrayByCountries: SelectedArrayByCountries,
  ): Promise<FetchTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloadsFromSelection');
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(nodeId, resolvedDataSource);
    const strategy = resolveFetchStageStrategy(resolvedDataSource);
    return strategy.buildFetchTaskPayloads({
      selectedArrayByCountries,
      countryMetadata,
    });
  },

  // ===================================
  // Selection Validation
  // ===================================

  validateSelection: async (
    countries: string[],
    adminLevels: number[],
    dataSource: DataSourceName,
  ): Promise<ShapeStepValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isDataSourceName(dataSource)) {
      errors.push('Invalid data source selected');
    }
    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (countries.length > 10) {
      warnings.push('Large country selection may require significant processing time');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  // ===================================
  // DraftTypes-based Build Processing
  // ===================================

  startBuildSession: async (
    draftId: NodeId,
    buildConfig: ShapeBuildConfig,
    processingConfig: ShapeProcessingConfig | undefined,
    downloadTaskPayloads: FetchTaskPayload[],
    buildContinuationPolicy?: BuildContinuationPolicy,
    progressCallback?: (event: BuildProgressEvent) => void,
  ): Promise<NodeId> => startBuildSessionInternal(
    'startBuildSession',
    draftId,
    buildConfig,
    processingConfig,
    downloadTaskPayloads,
    buildContinuationPolicy,
    progressCallback,
  ),
  pauseBuildSession: async (draftId: NodeId, reason?: string): Promise<void> => {
    await shapeBatchAPI.invokeBatchCommand('session/pause', {
      nodeId: draftId,
      stopReason: reason,
    });
  },
  /** @deprecated Use pauseBuildSession. */
  pauseBatchProcessing: async (draftId: NodeId, reason?: string): Promise<void> => (
    shapeBatchAPI.pauseBuildSession(draftId, reason)
  ),
  resumeBuildSession: async (
    draftId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy,
    buildConfig?: ShapeBuildConfig,
    processingConfig?: ShapeProcessingConfig,
  ): Promise<void> => {
    await shapeBatchAPI.invokeBatchCommand('session/resume', {
      nodeId: draftId,
      buildContinuationPolicy,
      buildConfig,
      processingConfig,
    });
  },
  /** @deprecated Use resumeBuildSession. */
  resumeBatchProcessing: async (
    draftId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy,
  ): Promise<void> => (
    shapeBatchAPI.resumeBuildSession(draftId, buildContinuationPolicy)
  ),
  cancelQueuedSession: async (draftId: NodeId, reason?: string): Promise<void> => {
    await shapeBatchAPI.invokeBatchCommand('session/cancel-queued', {
      nodeId: draftId,
      stopReason: reason,
    });
  },
  /** @deprecated Use cancelQueuedSession. */
  cancelQueuedBatchSession: async (draftId: NodeId, reason?: string): Promise<void> => (
    shapeBatchAPI.cancelQueuedSession(draftId, reason)
  ),
  /** @deprecated Use startBuildSession. */
  startBatchProcess: async (
    draftId: NodeId,
    buildConfig: ShapeBuildConfig,
    processingConfig: ShapeProcessingConfig | undefined,
    downloadTaskPayloads: FetchTaskPayload[],
    buildContinuationPolicy?: BuildContinuationPolicy,
    progressCallback?: (event: BuildProgressEvent) => void,
  ): Promise<NodeId> => startBuildSessionInternal(
    'startBatchProcess',
    draftId,
    buildConfig,
    processingConfig,
    downloadTaskPayloads,
    buildContinuationPolicy,
    progressCallback,
  ),

  invokeBatchCommand: async (command: string, payload: Record<string, unknown>): Promise<void> => {
    if (command === 'session/pause') {
      const nodeId = payload.nodeId as NodeId;
      if (!nodeId) throw new Error('[shapeBatchAPI] session/pause requires nodeId');
      const rawStopReason = typeof payload.stopReason === 'string' ? payload.stopReason : undefined;
      const stopReason = rawStopReason && isStopReason(rawStopReason) ? rawStopReason : undefined;
      console.warn('[shapeBatchAPI][PauseTrace] pause-requested', {
        nodeId,
        stopReason: stopReason ?? null,
      });
      setPaused(nodeId, true);
      void (async () => {
        try {
          await upsertBuildSessionSnapshot({
            nodeId,
            status: 'paused',
            stopReason,
            canResume: true,
          });
          await emitProgressSnapshot(nodeId, 'Pause requested.');
          const drain = await waitForRunningTasksToDrain(nodeId);
          console.warn('[shapeBatchAPI][PauseTrace] pause-settled', {
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
          console.warn('[shapeBatchAPI][PauseTrace] pause-settle-monitor-failed', {
            nodeId,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return;
    }
    if (command === 'session/cancel-queued') {
      const nodeId = payload.nodeId as NodeId;
      if (!nodeId) throw new Error('[shapeBatchAPI] session/cancel-queued requires nodeId');
      const rawStopReason = typeof payload.stopReason === 'string' ? payload.stopReason : undefined;
      const stopReason = rawStopReason && isStopReason(rawStopReason) ? rawStopReason : 'user-pause';
      const pipelineKey = String(nodeId);
      if (activePipelines.has(pipelineKey)) {
        await shapeBatchAPI.invokeBatchCommand('session/pause', { nodeId, stopReason });
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
      if (!nodeId) throw new Error('[shapeBatchAPI] session/resume requires nodeId');
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
        console.warn('[shapeBatchAPI] startup', JSON.stringify({
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
      if (!activePipelines.has(pipelineKey)) {
        const handler = getShapeEntityHandler();
        const draftEntity = await executeResumeStep(
          'load-draft',
          async () => handler.getEntity(nodeId),
        );
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
          throw new Error('[shapeBatchAPI] buildConfig is required to resume build session');
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
        const mergedRuntimeConfig = composeRuntimeBuildConfig(
          mergedBuildConfig,
          normalizedProcessingConfig,
        );
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
          throw new Error('[shapeBatchAPI] Resume requires selected countries/admin levels or existing queued tasks.');
        }
        if (existingTaskCount === 0 && selectedAdminPairCount > 0 && fetchPlan.plannedFetchTotal === 0) {
          throw new Error(
            '[shapeBatchAPI] Resume has selected inputs but generated 0 fetch tasks.'
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
        const emitQueuedProgressSnapshot = async (payload: {
          nodeId: NodeId;
          stage: 'fetch';
          taskCount: number;
          source: 'created' | 'reused';
        }): Promise<void> => {
          if (payload.stage !== 'fetch') return;
          await emitProgressSnapshot(payload.nodeId, 'Fetch task plan prepared.');
        };
        emitResumeStepLog('start', 'pipeline-dispatch', {
          runId: pipelineRunId,
          existingTaskCount,
        });
        startSessionTracking(nodeId);
        activePipelines.add(pipelineKey);
        activePipelineRuns.set(pipelineKey, pipelineRunId);
        console.warn('[shapeBatchAPI] resumeBuildSession pipeline start', {
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
          const taskQueue = new VtTaskQueueDb();
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
          console.error('[shapeBatchAPI] vt pipeline failed', error);
          console.error('[shapeBatchAPI] startup', JSON.stringify({
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
      }
      return;
    }
    throw new Error(`[shapeBatchAPI] Unknown build command: ${command}`);
  },

  getBuildSession: async (nodeId: NodeId): Promise<BuildSession | undefined> => (
    getBuildSessionInternal(nodeId)
  ),
  getBatchSession: async (nodeId: NodeId): Promise<BuildSession | undefined> => (
    getBuildSessionInternal(nodeId)
  ),

  getBuildTasks: async (nodeId: NodeId): Promise<BuildTaskSummary[]> => {
    const taskQueue = new VtTaskQueueDb();
    await ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      return vtTasks.map((task) => mapTaskQueueRecordToTaskSummary(task));
    }
    return [];
  },
  /** @deprecated Use getBuildTasks. */
  getBatchTasks: async (nodeId: NodeId): Promise<BuildTaskSummary[]> => (
    shapeBatchAPI.getBuildTasks(nodeId)
  ),

  getBuildProgress: async (draftId: NodeId): Promise<ProgressInfo> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const nodeId = draftId;
    if (!entity || !nodeId) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }
    const taskQueue = new VtTaskQueueDb();
    await ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(nodeId, vtTasks);
      return summary.progress;
    }
    return {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    };
  },
  /** @deprecated Use getBuildProgress. */
  getBatchProgress: async (draftId: NodeId): Promise<ProgressInfo> => (
    shapeBatchAPI.getBuildProgress(draftId)
  ),

  getBuildStatus: async (
    nodeId: NodeId,
  ): Promise<{
    nodeId: NodeId;
    draftId?: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => {
    const taskQueue = new VtTaskQueueDb();
    await ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(nodeId, vtTasks);
      const paused = getPauseState(nodeId).paused;
      return {
        nodeId,
        status: paused ? 'paused' : summary.status,
        progress: summary.progress.percentage,
        completedTasks: summary.progress.completed,
        totalTasks: summary.progress.total,
      };
    }
    return {
      nodeId,
      status: 'idle',
    };
  },
  /** @deprecated Use getBuildStatus. */
  getBatchStatus: async (
    nodeId: NodeId,
  ): Promise<{
    nodeId: NodeId;
    draftId?: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => (
    shapeBatchAPI.getBuildStatus(nodeId)
  ),

  // ===================================
  // Build Session Recovery
  // ===================================

  findPendingBuildSessions: async (nodeId: NodeId): Promise<BuildSession[]> => {
    console.log(`Finding pending build sessions for node: ${nodeId}`);
    return [];
  },
  /** @deprecated Use findPendingBuildSessions. */
  findPendingBatchSessions: async (nodeId: NodeId): Promise<BuildSession[]> => (
    shapeBatchAPI.findPendingBuildSessions(nodeId)
  ),

  getBuildSessionStatus: async (
    nodeId: NodeId,
  ): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }> => {
    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
    if (sessionRecord) {
      const fallbackLastActivity = sessionRecord.updatedAt ?? Date.now();
      const lastActivity = sessionRecord.lastActivity ?? fallbackLastActivity;
      const expiresAt = sessionRecord.expiresAt ?? resolveSessionExpiresAt(lastActivity);
      return {
        exists: true,
        canResume: Boolean(sessionRecord.canResume ?? sessionRecord.status === 'paused'),
        lastActivity,
        expiresAt,
      };
    }

    const taskQueue = new VtTaskQueueDb();
    const counts = await countTaskQueueStatuses(taskQueue, nodeId);
    if (counts.total > 0) {
      const now = Date.now();
      const firstTask = await taskQueue.tasks
        .where('[nodeId+index]')
        .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
        .first();
      const lastActivity = typeof firstTask?.updatedAt === 'number' ? firstTask.updatedAt : now;
      return {
        exists: true,
        canResume: getPauseState(nodeId).paused,
        lastActivity,
        expiresAt: resolveSessionExpiresAt(lastActivity),
      };
    }
    return {
      exists: false,
      canResume: false,
      lastActivity: 0,
      expiresAt: 0,
    };
  },

  // ===================================
  // Cleanup (mock/no-op placeholder)
  // ===================================

  performCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Performing draft cleanup (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  getCleanupStats: async (): Promise<{
    totalDrafts: number;
    expiredDrafts: number;
    totalBuildSessions: number;
    expiredBuildSessions: number;
    estimatedSpaceUsed: number;
    lastCleanupAt?: number;
  }> => {
    console.log('Getting cleanup statistics (mock)');
    return {
      totalDrafts: 0,
      expiredDrafts: 0,
      totalBuildSessions: 0,
      expiredBuildSessions: 0,
      estimatedSpaceUsed: 0,
      lastCleanupAt: Date.now(),
    };
  },

  // ===================================
  // Real-time Progress Subscription
  // ===================================

  subscribeToProgress: (nodeId: NodeId, callback: (event: BuildProgressEvent) => void): (() => void) => {
    const existing = progressCallbacks.get(String(nodeId));
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    const sequenceByTaskId = new Map<string, number>();
    const readSequence = (sequence: unknown): number | null => (
      typeof sequence === 'number' && Number.isFinite(sequence) ? sequence : null
    );
    const shouldProcessEvent = (taskId: string, sequence: number | null): boolean => {
      if (sequence === null) return true;
      const current = sequenceByTaskId.get(taskId);
      if (current !== undefined && sequence <= current) {
        return false;
      }
      sequenceByTaskId.set(taskId, sequence);
      return true;
    };
    const unsubscribeTaskQueue = onTaskQueueUpdate(nodeId, (event) => {
      if (event.type === 'delete') {
        sequenceByTaskId.delete(event.taskId);
        return;
      }
      if (!shouldProcessEvent(event.task.taskId, readSequence(event.task.sequence))) {
        return;
      }
      void (async () => {
        try {
          const vtTasks = await listTasks(taskQueue, event.nodeId);
          callback({
            nodeId: event.nodeId,
            stage: event.task.stage,
            phase: resolveProgressPhase(event.nodeId, vtTasks),
            timestamp: Date.now(),
            message: event.task.errorMessage,
            payload: await buildProgressPayloadFromTasks(nodeId, vtTasks, {
              eventTask: event.task,
              source: 'event',
            }),
          });
        } catch (error) {
          console.error('[shapeBatchAPI] progress payload build failed', error);
        }
      })();
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
    };
    progressCallbacks.set(String(nodeId), { unsubscribe, callback });

    return () => {
      const active = progressCallbacks.get(String(nodeId));
      active?.unsubscribe?.();
      progressCallbacks.delete(String(nodeId));
    };
  },

  subscribeToTasks: (nodeId: NodeId, callback: (event: BuildTaskUpdateEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = taskCallbacks.get(key);
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    const sequenceByTaskId = new Map<string, number>();
    const readSequence = (taskId: string, sequence: unknown): number => {
      if (typeof sequence === 'number' && Number.isFinite(sequence)) return sequence;
      throw new Error(`[shapeBatchAPI] missing task sequence (taskId=${taskId})`);
    };
    const shouldEmitTask = (taskId: string, sequence: number): boolean => {
      const current = sequenceByTaskId.get(taskId);
      if (current !== undefined && sequence <= current) return false;
      sequenceByTaskId.set(taskId, sequence);
      return true;
    };
    let snapshotInFlight = false;
    const sendSnapshot = async () => {
      if (snapshotInFlight) return;
      snapshotInFlight = true;
      try {
        await ensureTaskQueueSeeded(nodeId, taskQueue);
        let tasks = await buildTaskSummarySnapshot(nodeId, taskQueue);
        tasks.forEach((task) => {
          const sequence = readSequence(task.taskId, task.sequence);
          sequenceByTaskId.set(task.taskId, sequence);
        });
        callback({ type: 'snapshot', nodeId, tasks });
      } catch (error) {
        console.error('[shapeBatchAPI] task snapshot failed', error);
      } finally {
        snapshotInFlight = false;
      }
    };
    void sendSnapshot();
    const unsubscribeTaskQueue = onTaskQueueUpdate(nodeId, (event) => {
      if (event.type === 'delete') {
        sequenceByTaskId.delete(event.taskId);
        callback({ type: 'delete', nodeId: event.nodeId, taskId: event.taskId });
        return;
      }
      void (async () => {
        try {
          const summary = mapTaskQueueRecordToTaskSummary(event.task);
          const sequence = readSequence(summary.taskId, summary.sequence);
          const current = sequenceByTaskId.get(summary.taskId);
          if (current !== undefined && sequence > current + 1) {
            console.warn('[shapeBatchAPI] task sequence gap detected; triggering snapshot resync', {
              nodeId: event.nodeId,
              taskId: summary.taskId,
              currentSequence: current,
              nextSequence: sequence,
            });
            void sendSnapshot();
            return;
          }
          if (!shouldEmitTask(summary.taskId, sequence)) {
            return;
          }
          callback({ type: 'update', nodeId: event.nodeId, task: summary });
        } catch (error) {
          console.error('[shapeBatchAPI] task update failed', error);
        }
      })();
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
    };
    taskCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = taskCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        taskCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  // removed duplicate older getProcessingStatus (migrated to unified shape below)

  forceCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Force cleaning all transient data (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  // ===================================
  // Feature Data Access
  // ===================================

  getProcessedFeatureCount: async (nodeId: NodeId): Promise<number> => {
    return shapeQueryAPIImpl.getProcessedFeatureCount(nodeId);
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileInfo | undefined> => {
    const tile = await shapeQueryAPIImpl.getVectorTileInfo(nodeId, z, x, y);
    if (!tile) return undefined;
    return {
      exists: true,
      size: tile.size,
      features: tile.features,
      layers: (tile.layers ?? []).map((layer) => layer.name),
      generatedAt: tile.generatedAt,
      lastAccessed: tile.lastAccessed,
    };
  },

  // ===================================
  // Status and Monitoring
  // ===================================

  getProcessingStatus: async (nodeId: NodeId): Promise<ProcessingStatus> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(nodeId, vtTasks);
      const paused = getPauseState(nodeId).paused;
      const latestTask = selectLatestTaskBySequence(vtTasks);
      const lastProcessed = latestTask ? resolveTaskProcessingTimestamp(latestTask) : 0;
      return {
        status: paused
          ? 'paused'
          : summary.status === 'running'
          ? 'processing'
          : summary.status === 'completed'
            ? 'completed'
            : summary.status === 'failed'
              ? 'failed'
              : 'idle',
        lastProcessed: lastProcessed || undefined,
        hasErrors: summary.status === 'failed',
        errorMessages: summary.status === 'failed' ? ['Build processing failed'] : [],
        totalFeatures: undefined,
        totalVectorTiles: undefined,
        storageUsed: undefined,
      };
    }

    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
    if (sessionRecord) {
      const status = sessionRecord.status === 'running'
        ? 'processing'
        : sessionRecord.status;
      return {
        status,
        lastProcessed: undefined,
        totalFeatures: undefined,
        totalVectorTiles: undefined,
        storageUsed: undefined,
        hasErrors: status === 'failed',
        errorMessages: status === 'failed' ? ['Build processing failed'] : [],
      };
    }

    return {
      status: 'idle',
      lastProcessed: undefined,
      totalFeatures: undefined,
      totalVectorTiles: undefined,
      storageUsed: undefined,
      hasErrors: false,
      errorMessages: [],
    };
  },

  cleanupProcessingData: async (nodeId: NodeId): Promise<void> => {
    await shapeMutationAPIImpl.cleanupProcessingData(nodeId);
    try {
      await deleteRawDataDataSourceBuffersForNode(nodeId);
    } catch (error) {
      console.warn('[shapeBatchAPI] failed to clean chunk-store relations', error);
    }
  },
};

/** Preferred alias for shapeBatchAPI. */
export const shapeBuildAPI = shapeBatchAPI;
