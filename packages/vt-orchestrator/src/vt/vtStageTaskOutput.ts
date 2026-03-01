import type { StageHandlerResult } from '~/types/types';
import { getHeapSnapshot } from './vtStageCore.js';
import type { VtTileOutputContext } from './vtStageTaskOutputTypes.js';
import { runVtTileOutputWriter } from './vtStageTaskOutputWriterFlow.js';
import { finalizeVtTileOutput } from './vtStageTaskOutputFinalize.js';

type VtTaskOutputFlowInput = VtTileOutputContext;

export const runVtTileOutputFlow = async (
  outputContext: VtTaskOutputFlowInput,
): Promise<StageHandlerResult> => {
  const {
    context,
    input,
    taskContext,
    parent,
    band,
    parentInputMetadata,
    tilesByZoom,
    totalTiles,
    adminFeatureSummary,
  } = outputContext;

  console.info('[tileEmit] encode/store start', JSON.stringify({
    ...taskContext,
    totalTiles,
    bufferCount: input.bufferIds.length,
    heap: getHeapSnapshot(),
  }));

  const tileOutputSession = await runVtTileOutputWriter(outputContext);

  return finalizeVtTileOutput({
    context,
    taskContext,
    parent,
    band,
    totalTiles,
    processedTiles: tileOutputSession.processedTiles,
    generatedTiles: tileOutputSession.generatedTiles,
    totals: tileOutputSession.totals,
    tilingStartedAt: tileOutputSession.tilingStartedAt,
    adminFeatureSummary,
    tilesByZoom,
    parentInputMetadata,
    reportTileProgress: tileOutputSession.reportTileProgress,
  });
};
