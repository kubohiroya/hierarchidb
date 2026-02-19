import type { BuildSessionStatus, TaskStage } from '@hierarchidb/batch-api';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { ephemeralShapeAPIImpl, shapeQueryAPIImpl } from '~/services/batch/ShapeBuildAPIClient';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { countRawDataDataSourceBuffersForNode, deleteRawDataDataSourceBuffersForNode } from '~/services/utils/chunkStore';

export const SHAPE_NODE_TYPE = 'shape' as NodeType;
export const KNOWN_TASK_STAGES: TaskStage[] = ['fetch', 'transform', 'vt'];

export type StageLikeTask = {
  stage: TaskStage;
  type?: TaskStage;
  taskType?: TaskStage;
};

type TaskQueueRecordLike = Partial<StageLikeTask> & {
  taskId?: string;
};

type SessionBridgeLike = {
  initialize: () => Promise<void>;
  getBuildSessionStatus: (nodeType: NodeType, nodeId: NodeId) => Promise<BuildSessionStatus>;
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

export const resolveKnownTaskStage = (task: TaskQueueRecordLike): TaskStage | null => {
  const candidate = task.stage ?? task.taskType ?? task.type;
  if (!candidate) return null;
  return KNOWN_TASK_STAGES.includes(candidate) ? candidate : null;
};

export const resolveTaskStage = (task: StageLikeTask): TaskStage =>
  task.stage ?? task.type ?? task.taskType;

export const isTaskInStages = (task: StageLikeTask, stages: TaskStage[]): boolean =>
  stages.includes(resolveTaskStage(task));

export const normalizeTaskQueueStages = async (taskQueue: VtTaskQueueDb, nodeId: NodeId): Promise<void> => {
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

export const loadCacheCounts = async (args: {
  nodeId: NodeId;
  sessionBridge: SessionBridgeLike;
}): Promise<{
  counts: CacheCounts;
  resultCounts: ResultCounts;
  sessionStatus: BuildSessionStatus['status'] | null;
}> => {
  const { nodeId, sessionBridge } = args;
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

  const sessionStatus = await sessionBridge
    .initialize()
    .then(() => sessionBridge.getBuildSessionStatus(SHAPE_NODE_TYPE, nodeId))
    .catch(() => null);

  return {
    counts: {
      fetchApi: rawCacheCount,
      fetchFiltered: fetchCacheCount,
      transform: transformTaskCount + transformCacheCount + transformErrors.length,
      vt: vtTaskCount + vectorTileSummary.tiles,
    },
    resultCounts: {
      tiles: vectorTileSummary.tiles,
      featureMetadata: featureMetadata.length,
      transformErrors: transformErrors.length,
    },
    sessionStatus: sessionStatus?.status ?? null,
  };
};

export const clearBuildTasksForStages = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stagesToClear: BuildTaskType[],
): Promise<void> => {
  const uniqueTypes = Array.from(new Set(stagesToClear));
  if (uniqueTypes.length === 0) return;

  const taskRows = await Promise.all(
    uniqueTypes.map((taskType) => ephemeralShapeAPIImpl.listBuildTasksByType(nodeId, taskType)),
  );
  const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
  if (taskIds.length > 0) {
    await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
  }

  if (uniqueTypes.includes('transform')) {
    await normalizeTaskQueueStages(taskQueue, nodeId);
  }

  await Promise.all(
    uniqueTypes.map((stage) => (
      taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, stage]).delete()
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
};

export const deleteFetchRawCache = async (nodeId: NodeId): Promise<void> => {
  await deleteRawDataDataSourceBuffersForNode(nodeId);
};
