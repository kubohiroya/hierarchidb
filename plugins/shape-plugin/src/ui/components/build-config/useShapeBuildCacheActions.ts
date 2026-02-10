import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShapeEntity } from '../../../common/types/index.js';
import type { BuildSessionStatus, TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { notify } from '@hierarchidb/components';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { persistedTasksAtom, tasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';
import {
  countRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNode,
} from '../../../services/utils/chunkStore.js';
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';

type StageLikeTask = {
  stage: TaskStage;
  type?: TaskStage;
  taskType?: TaskStage;
};

type TaskQueueRecordLike = Partial<StageLikeTask> & {
  taskId?: string;
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const KNOWN_TASK_STAGES: TaskStage[] = ['fetch', 'transform', 'vt'];

const resolveTaskStage = (task: StageLikeTask): TaskStage =>
  task.stage ?? task.type ?? task.taskType;

const isTaskInStages = (task: StageLikeTask, stages: TaskStage[]): boolean =>
  stages.includes(resolveTaskStage(task));

const resolveKnownTaskStage = (task: TaskQueueRecordLike): TaskStage | null => {
  const candidate = task.stage ?? task.taskType ?? task.type;
  if (!candidate) return null;
  return KNOWN_TASK_STAGES.includes(candidate) ? candidate : null;
};

const normalizeTaskQueueStages = async (taskQueue: VtTaskQueueDb, nodeId: NodeId): Promise<void> => {
  const records = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
  const patches: Array<{ taskId: string; updates: { stage?: TaskStage; taskType?: TaskStage } }> = [];
  records.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const taskId = (record as TaskQueueRecordLike).taskId;
    if (typeof taskId !== 'string' || taskId.length === 0) return;
    const resolvedStage = resolveKnownTaskStage(record as TaskQueueRecordLike);
    if (!resolvedStage) return;
    const currentStage = (record as TaskQueueRecordLike).stage;
    const currentTaskType = (record as TaskQueueRecordLike).taskType;
    const updates: { stage?: TaskStage; taskType?: TaskStage } = {};
    if (currentStage !== resolvedStage) updates.stage = resolvedStage;
    if (currentTaskType !== resolvedStage) updates.taskType = resolvedStage;
    if (Object.keys(updates).length > 0) {
      patches.push({ taskId, updates });
    }
  });
  if (patches.length === 0) return;
  const debugTag = 'normalize-task-queue-ui-2026-02-09-0334';
  const startedAt = Date.now();
  console.warn('[shapeBuildCache][TaskDebug] normalizeTaskQueueStages start', {
    tag: debugTag,
    nodeId,
    patchCount: patches.length,
  });
  let waitTimer: ReturnType<typeof setInterval> | null = null;
  waitTimer = setInterval(() => {
    console.warn('[shapeBuildCache][TaskDebug] normalizeTaskQueueStages waiting', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  }, 5000);
  try {
    await taskQueue.transaction('rw', taskQueue.tasks, async () => {
      await Promise.all(patches.map((patch) => taskQueue.tasks.update(patch.taskId, patch.updates)));
    });
    console.warn('[shapeBuildCache][TaskDebug] normalizeTaskQueueStages done', {
      tag: debugTag,
      nodeId,
      elapsedMs: Date.now() - startedAt,
    });
  } finally {
    if (waitTimer) clearInterval(waitTimer);
  }
};

export type CacheCounts = {
  fetchApi: number;
  fetchFiltered: number;
  transform: number;
  vt: number;
};

export type ResultCounts = {
  tiles: number;
  featureMetadata: number;
  transformErrors: number;
};

export type DeleteLoadingState = {
  fetchApi: boolean;
  fetchFiltered: boolean;
  transform: boolean;
  vt: boolean;
  metadata: boolean;
  resetSession: boolean;
};

type Args = {
  nodeId?: NodeId;
  draft?: Partial<ShapeEntity>;
  disabled?: boolean;
  onResetSession?: () => void;
};

export const useShapeBuildCacheActions = ({ nodeId, draft, disabled, onResetSession }: Args) => {
  const bridgeRef = useMemo(() => getWorkerBridge(), []);
  const [countsLoading, setCountsLoading] = useState(false);
  const [counts, setCounts] = useState<CacheCounts>({
    fetchApi: 0,
    fetchFiltered: 0,
    transform: 0,
    vt: 0,
  });
  const [resultCounts, setResultCounts] = useState<ResultCounts>({
    tiles: 0,
    featureMetadata: 0,
    transformErrors: 0,
  });
  const [deleteLoading, setDeleteLoading] = useState<DeleteLoadingState>({
    fetchApi: false,
    fetchFiltered: false,
    transform: false,
    vt: false,
    metadata: false,
    resetSession: false,
  });
  const [sessionStatus, setSessionStatus] = useState<BuildSessionStatus['status'] | null>(null);
  const setBuildTasks = useSetAtom(tasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetchApi: 0, fetchFiltered: 0, transform: 0, vt: 0 });
      setResultCounts({ tiles: 0, featureMetadata: 0, transformErrors: 0 });
      setSessionStatus(null);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const taskQueue = new VtTaskQueueDb();
      const [
        fetchCacheCount,
        rawCacheCount,
        transformTaskCount,
        vtTaskCount,
        transformCacheCount,
        vectorTileSummary,
        featureMetadata,
        transformErrors,
      ] = await Promise.all([
        ephemeralShapeAPIImpl.countFetchCaches(nodeId),
        countRawDataDataSourceBuffersForNode(nodeId),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'transform']).count(),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'vt']).count(),
        ephemeralShapeAPIImpl.countTransformCaches(nodeId),
        shapeQueryAPIImpl.getVectorTileSummary(nodeId),
        shapeQueryAPIImpl.listFeatureMetadata(nodeId),
        shapeQueryAPIImpl.listTransformErrorRecords(nodeId),
      ]);
      const featureMetadataCount = featureMetadata.length;
      const transformErrorCount = transformErrors.length;
      const transformCount = transformTaskCount + transformCacheCount + transformErrorCount;
      const tileCount = vtTaskCount + vectorTileSummary.tiles;

      const sessionStatus = await bridgeRef
        .initialize()
        .then(() => bridgeRef.getBuildSessionStatus(SHAPE_NODE_TYPE, nodeId))
        .catch(() => null);

      setSessionStatus(sessionStatus?.status ?? null);

      setCounts({
        fetchApi: rawCacheCount,
        fetchFiltered: fetchCacheCount,
        transform: transformCount,
        vt: tileCount,
      });
      setResultCounts({
        tiles: vectorTileSummary.tiles,
        featureMetadata: featureMetadataCount,
        transformErrors: transformErrorCount,
      });
    } finally {
      setCountsLoading(false);
    }
  }, [bridgeRef, nodeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadCounts();
      if (cancelled) return;
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCounts]);

  const runDelete = useCallback(async (key: keyof DeleteLoadingState, action: () => Promise<void>): Promise<void> => {
    setDeleteLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } finally {
      setDeleteLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const clearBuildTasksForStages = useCallback(async (taskTypes: BuildTaskType[]) => {
    if (!nodeId) return;
    const uniqueTypes = Array.from(new Set(taskTypes));
    if (uniqueTypes.length === 0) return;
    const taskRows = await Promise.all(
      uniqueTypes.map((taskType) => ephemeralShapeAPIImpl.listBuildTasksByType(nodeId, taskType))
    );
    const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
    if (taskIds.length > 0) {
      await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
    }
    const taskQueue = new VtTaskQueueDb();
    if (uniqueTypes.includes('transform')) {
      await normalizeTaskQueueStages(taskQueue, nodeId);
    }
    await Promise.all(
      uniqueTypes.map((stage) => (
        taskQueue.tasks
          .where('[nodeId+stage]')
          .equals([nodeId, stage])
          .delete()
      )),
    );
    if (uniqueTypes.includes('transform')) {
      await taskQueue.tasks
        .where('nodeId')
        .equals(nodeId)
        .and((task) => {
          const stage = resolveKnownTaskStage(task as TaskQueueRecordLike);
          if (!stage) return false;
          return !KNOWN_TASK_STAGES.includes(stage);
        })
        .delete();
    }
  }, [nodeId]);

  const clearTileData = useCallback(async () => {
    if (!nodeId) return;
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
  }, [nodeId]);

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      const node = await updater.getTreeNode(nodeId);
      const currentDraftData = (
        node?.draftData && typeof node.draftData === 'object'
          ? (node.draftData as Record<string, unknown>)
          : {}
      );
      const sessionResetPatch = {
        processingStatus: 'idle',
        buildStartedAt: undefined,
        buildFinishedAt: undefined,
        buildElapsedMs: 0,
        buildResumedAt: undefined,
        stageElapsedMs: 0,
        stageResumedAt: undefined,
        stageElapsedStageId: undefined,
        stageElapsedByStage: {},
        stageTimingByStage: {},
      } as Record<string, unknown>;
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        // updateTreeNode(save-draft) can replace draftData, so preserve current values explicitly.
        draftData: {
          ...sanitizeShapeDraftData(currentDraftData),
          ...sessionResetPatch,
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [bridgeRef, nodeId]);

  const hasPersistedOutputs = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    const [summary, featureMetadata, transformErrors] = await Promise.all([
      shapeQueryAPIImpl.getVectorTileSummary(nodeId),
      shapeQueryAPIImpl.listFeatureMetadata(nodeId),
      shapeQueryAPIImpl.listTransformErrorRecords(nodeId),
    ]);
    return summary.tiles > 0 || featureMetadata.length > 0 || transformErrors.length > 0;
  }, [nodeId]);

  const hasRunningBuildSession = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    try {
      await bridgeRef.initialize();
      const status = await bridgeRef.getBuildSessionStatus(SHAPE_NODE_TYPE, nodeId);
      return status.status === 'running';
    } catch {
      return false;
    }
  }, [bridgeRef, nodeId]);

  const resetStaleProcessingSessionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (draft?.processingStatus !== 'processing') return false;
    const running = await hasRunningBuildSession();
    if (running) return false;
    onResetSession?.();
    await persistSessionReset();
    return true;
  }, [
    draft?.processingStatus,
    hasRunningBuildSession,
    onResetSession,
    persistSessionReset,
  ]);

  const handleDeleteFetchApiCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchApi', async () => {
      await deleteRawDataDataSourceBuffersForNode(nodeId);
      await clearBuildTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await resetStaleProcessingSessionIfNeeded();
      await loadCounts();
      notify.success('Deleted API cache');
    });
  }, [
    clearBuildTasksForStages,
    loadCounts,
    nodeId,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteFetchFilteredCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchFiltered', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
      await clearBuildTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      const resetByStaleProcessing = await resetStaleProcessingSessionIfNeeded();
      const shouldPreserveSession = draft?.processingStatus === 'completed' || await hasPersistedOutputs();
      if (!shouldPreserveSession && !resetByStaleProcessing) {
        onResetSession?.();
        await persistSessionReset();
      }
      await loadCounts();
      notify.success('Deleted filtered cache');
    });
  }, [
    clearBuildTasksForStages,
    draft?.processingStatus,
    hasPersistedOutputs,
    loadCounts,
    nodeId,
    onResetSession,
    persistSessionReset,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteTransformCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['transform', 'vt'];
    await runDelete('transform', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
      await clearBuildTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await resetStaleProcessingSessionIfNeeded();
      await loadCounts();
      notify.success('Deleted transform cache');
    });
  }, [
    clearBuildTasksForStages,
    loadCounts,
    nodeId,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteVTCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['vt'];
    await runDelete('vt', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'vt');
      await clearBuildTasksForStages(stagesToClear);
      await clearTileData();
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      const resetByStaleProcessing = await resetStaleProcessingSessionIfNeeded();
      const shouldPreserveSession = draft?.processingStatus === 'completed' || await hasPersistedOutputs();
      if (!shouldPreserveSession && !resetByStaleProcessing) {
        onResetSession?.();
        await persistSessionReset();
      }
      await loadCounts();
      notify.success('Deleted tile data');
    });
  }, [
    clearBuildTasksForStages,
    clearTileData,
    draft?.processingStatus,
    hasPersistedOutputs,
    loadCounts,
    nodeId,
    onResetSession,
    persistSessionReset,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteFeatureMetadata = useCallback(async () => {
    if (!nodeId) return;
    await runDelete('metadata', async () => {
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
      await loadCounts();
      notify.success('Deleted feature metadata');
    });
  }, [loadCounts, nodeId, runDelete]);

  const handleResetSession = useCallback(async () => {
    if (!nodeId) return;
    await runDelete('resetSession', async () => {
      await deleteRawDataDataSourceBuffersForNode(nodeId);
      await shapeMutationAPIImpl.clearShapeArtifacts(nodeId);
      await Promise.all([
        shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId),
        shapeMutationAPIImpl.deleteDataSourceMetadataByNode(nodeId),
      ]);
      setBuildTasks([]);
      setPersistedTasks([]);
      onResetSession?.();
      await persistSessionReset();
      await loadCounts();
      notify.success('Reset session data');
    });
  }, [
    loadCounts,
    nodeId,
    onResetSession,
    persistSessionReset,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const draftStatus = draft?.processingStatus ?? null;
  const allowDeleteWhileBusy = (
    (sessionStatus !== null && ['running', 'paused', 'failed', 'queued'].includes(sessionStatus))
    || (draftStatus !== null && ['processing', 'paused', 'failed'].includes(draftStatus))
  );
  const deleteEnabled = allowDeleteWhileBusy || !disabled;
  const canDeleteFetchApiCache = deleteEnabled && counts.fetchApi > 0;
  const canDeleteFetchFilteredCache = deleteEnabled && counts.fetchFiltered > 0;
  const canDeleteTransformCache = deleteEnabled && counts.transform > 0;
  const canDeleteVTCache = deleteEnabled && counts.vt > 0;
  const canDeleteMetadata = deleteEnabled && resultCounts.featureMetadata > 0;

  return {
    counts,
    resultCounts,
    countsLoading,
    deleteLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata: handleDeleteFeatureMetadata,
    handleResetSession,
  };
};
