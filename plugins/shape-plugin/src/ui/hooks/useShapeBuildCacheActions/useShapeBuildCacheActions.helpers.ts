import type { BuildSessionStatus, TaskStage } from '@hierarchidb/build-api';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { ephemeralShapeAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { VtTaskQueueDb as TileEmitTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { countRawDataDataSourceBuffersForNode, deleteRawDataDataSourceBuffersForNode } from '~/services/utils/chunkStore';

export const SHAPE_NODE_TYPE = 'shape' as NodeType;
export const KNOWN_TASK_STAGES: TaskStage[] = ['source', 'geometry', 'tileEmit'];

export type StageLikeTask = {
  stage: TaskStage;
  type?: TaskStage;
};

type TaskQueueRecordLike = Partial<StageLikeTask> & {
  taskId?: string;
};

type SessionBridgeLike = {
  initialize: () => Promise<void>;
  getBuildSessionStatus: (nodeType: NodeType, nodeId: NodeId) => Promise<BuildSessionStatus>;
};

export type CacheCounts = {
  sourceApi: number;
  sourceFiltered: number;
  geometry: number;
  tileEmit: number;
};

export type ResultCounts = {
  tiles: number;
  featureMetadata: number;
  geometryErrors: number;
};

export const isTaskInStages = (task: StageLikeTask, stages: TaskStage[]): boolean =>
  stages.includes(task.stage);

const verifyTaskQueueStages = async (taskQueue: TileEmitTaskQueueDb, nodeId: NodeId): Promise<void> => {
  const recordCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
  if (recordCount > 0) {
    console.debug('[shapeBuildCache][TaskDebug] task queue stage verification', {
      nodeId,
      recordCount,
    });
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
  const taskQueue = new TileEmitTaskQueueDb();
  const [
    sourceCacheCount,
    rawCacheCount,
    geometryTaskCount,
    tileEmitTaskCount,
    geometryCacheCount,
    vectorTileSummary,
    featureMetadata,
    geometryErrors,
  ] = await Promise.all([
    ephemeralShapeAPIImpl.countSourceCaches(nodeId),
    countRawDataDataSourceBuffersForNode(nodeId),
    taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'geometry']).count(),
    taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'tileEmit']).count(),
    ephemeralShapeAPIImpl.countGeometryCaches(nodeId),
    shapeQueryAPIImpl.getVectorTileSummary(nodeId),
    shapeQueryAPIImpl.listFeatureMetadata(nodeId),
    shapeQueryAPIImpl.listGeometryErrorRecords(nodeId),
  ]);

  const sessionStatus = await sessionBridge
    .initialize()
    .then(() => sessionBridge.getBuildSessionStatus(SHAPE_NODE_TYPE, nodeId))
    .catch(() => null);

  return {
    counts: {
      sourceApi: rawCacheCount,
      sourceFiltered: sourceCacheCount,
      geometry: geometryTaskCount + geometryCacheCount + geometryErrors.length,
      tileEmit: tileEmitTaskCount + vectorTileSummary.tiles,
    },
    resultCounts: {
      tiles: vectorTileSummary.tiles,
      featureMetadata: featureMetadata.length,
      geometryErrors: geometryErrors.length,
    },
    sessionStatus: sessionStatus?.status ?? null,
  };
};

export const clearBuildTasksForStages = async (
  taskQueue: TileEmitTaskQueueDb,
  nodeId: NodeId,
  stagesToClear: BuildTaskType[],
): Promise<void> => {
  const uniqueTypes = Array.from(new Set(stagesToClear));
  if (uniqueTypes.length === 0) return;

  const taskRows = await Promise.all(
    uniqueTypes.map((stage) => ephemeralShapeAPIImpl.listBuildTasksByStage(nodeId, stage)),
  );
  const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
  if (taskIds.length > 0) {
    await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
  }

  if (uniqueTypes.includes('geometry')) {
    await verifyTaskQueueStages(taskQueue, nodeId);
  }

  await Promise.all(
    uniqueTypes.map((stage) => (
      taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, stage]).delete()
    )),
  );

  if (uniqueTypes.includes('geometry')) {
    await taskQueue.tasks
      .where('nodeId')
      .equals(nodeId)
      .and((task) => {
        const stage = (task as TaskQueueRecordLike).stage;
        if (!stage) return false;
        return !KNOWN_TASK_STAGES.includes(stage);
      })
      .delete();
  }
};

export const deleteSourceRawCache = async (nodeId: NodeId): Promise<void> => {
  await deleteRawDataDataSourceBuffersForNode(nodeId);
};
