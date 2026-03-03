import type { VtTileOutputContext } from './vtStageTaskOutputTypes.js';
import { createVtTileOutputSession } from './createVtTileOutputSession.js';
import { writeVtTileOutputs } from './writeVtTileOutputs.js';
import type { VtTileOutputAggregates } from './vtStageTaskOutputStats.js';
import type { VtTileProgressReporter } from './vtStageTaskOutputTypes.js';

type VtTileOutputSessionResult = {
  totals: VtTileOutputAggregates;
  reportTileProgress: VtTileProgressReporter;
  tilingStartedAt: number;
};

export const runVtTileOutputWriter = async (
  context: VtTileOutputContext,
): Promise<{
  processedTiles: number;
  generatedTiles: number;
} & VtTileOutputSessionResult> => {
  const {
    context: vtContext,
    taskContext,
    parent,
    band,
    featureStats,
    bufferSizes,
    tilesByZoom,
    totalTiles,
    aggregatedLayersByTileId,
    indexes,
    vtpbf,
    debugCollect,
    parentInputMetadata,
  } = context;

  const {
    totals,
    startedAt,
    bufferSetHash,
    reportTileProgress,
  } = await createVtTileOutputSession({
    taskId: String(context.task.taskId),
    nodeId: context.task.nodeId,
    totalTiles,
    parentInputMetadata,
    bufferIds: context.input.bufferIds,
  });

  const tileOutputs = await writeVtTileOutputs({
    context: vtContext,
    taskContext,
    parent,
    band,
    featureStats,
    bufferSizes,
    tilesByZoom,
    totalTiles,
    aggregatedLayersByTileId,
    indexes,
    tileEmitConfig: vtContext.tileEmitConfig,
    tileWriter: vtContext.tileWriter,
    vtpbf,
    debugCollect,
    bufferSetHash,
    reportTileProgress,
    totals,
  });

  return {
    ...tileOutputs,
    totals,
    reportTileProgress,
    tilingStartedAt: startedAt,
  };
};
