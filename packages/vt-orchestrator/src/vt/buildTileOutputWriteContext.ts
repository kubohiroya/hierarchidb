import type { VTStageContext } from '~/contextTypes';
import type { VtTaskInput } from '~/types/types';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import type { VtTileOutputContext } from './vtStageTaskOutputTypes.js';
import type { VtCollectionResult, VtTaskRunInput } from './vtStageTaskTypes.js';

export type VtTaskOutputWriteInput = {
  context: VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
  };
  input: VtTaskInput;
  runInput: VtTaskRunInput;
  collection: VtCollectionResult;
  layerResult: Extract<VtLayerBuildResult, { kind: 'ready' }>;
};

export type VtTaskOutputWriteContext = Omit<VtTileOutputContext, 'vtpbf'>;

export const buildTileOutputWriteContext = ({
  context,
  task,
  input,
  runInput,
  collection,
  layerResult,
}: VtTaskOutputWriteInput): VtTaskOutputWriteContext => {
  return {
    context,
    task,
    input,
    taskContext: runInput.taskContext,
    parent: runInput.parent,
    band: {
      zMin: runInput.band.zMin,
      zMax: runInput.band.zMax,
    },
    parentInputMetadata: collection.parentInputMetadata,
    featureStats: collection.featureStats,
    bufferSizes: collection.bufferSizes,
    tilesByZoom: collection.tilesByZoom,
    totalTiles: collection.totalTiles,
    adminFeatureSummary: collection.adminFeatureSummary,
    aggregatedLayersByTileId: layerResult.aggregatedLayersByTileId,
    indexes: layerResult.indexes,
    debugCollect: runInput.debugCollect,
  };
};
