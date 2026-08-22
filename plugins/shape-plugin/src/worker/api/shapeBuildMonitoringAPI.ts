import type { NodeId } from '@hierarchidb/core-types';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import type { ProcessingStatus, TileInfo } from '~/common/types/index';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { deleteRawDataDataSourceBuffersForNode } from '~/services/utils/chunkStore';
import { shapeBuildRuntime } from './shapeBuildRuntime.js';

export const shapeBuildMonitoringAPI = {
  getProcessedFeatureCount: async (nodeId: NodeId): Promise<number> => {
    return shapeQueryAPIImpl.getProcessedFeatureCount(nodeId);
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
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

  getProcessingStatus: async (nodeId: NodeId): Promise<ProcessingStatus> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await shapeBuildRuntime.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await shapeBuildRuntime.buildTaskQueueSummary(nodeId, vtTasks);
      const paused = shapeBuildRuntime.getPauseState(nodeId).paused;
      const latestTask = shapeBuildRuntime.selectLatestTaskByProgress(vtTasks);
      const lastProcessed = latestTask
        ? shapeBuildRuntime.resolveTaskProcessingTimestamp(latestTask)
        : 0;
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

    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    if (sessionRecord) {
      const status = sessionRecord.status === 'running' ? 'processing' : sessionRecord.status;
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
      console.warn('[shapeBuildAPI] failed to clean chunk-store relations', error);
    }
  },
};
